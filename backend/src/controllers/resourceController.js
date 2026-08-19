const fs = require('fs');
const path = require('path');
const { ApiError, asyncHandler, ok } = require('../utils/http');
const resourceModel = require('../models/resourceModel');
const tutorModel = require('../models/tutorModel');
const { query } = require('../config/db');
const log = require('../services/activityLogService').log;

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'resources');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_BYTES = 500 * 1024 * 1024;

const TYPE_BY_EXT = {
  pdf: 'PDF',
  doc: 'DOC', docx: 'DOC',
  xls: 'SHEET', xlsx: 'SHEET', csv: 'SHEET',
  ppt: 'SLIDES', pptx: 'SLIDES',
  mp4: 'VIDEO', mov: 'VIDEO', webm: 'VIDEO', mkv: 'VIDEO',
  mp3: 'AUDIO', wav: 'AUDIO',
  jpg: 'IMAGE', jpeg: 'IMAGE', png: 'IMAGE', gif: 'IMAGE', webp: 'IMAGE',
  txt: 'TEXT', md: 'TEXT'
};

const ALLOWED_TYPES = new Set(Object.values(TYPE_BY_EXT));

/** Keeps only safe filename characters; used for the on-disk name. */
function sanitizeName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.').slice(0, 200);
}

function diskPathFor(resource) {
  return path.join(UPLOAD_DIR, `${resource.id}_${sanitizeName(resource.file_name || resource.title)}`);
}

/** GET /api/resources — every resource with its tutor (any authenticated role). */
const list = asyncHandler(async (req, res) => {
  ok(res, 200, await resourceModel.listAll());
});

/**
 * GET /api/resources/folders — the Resources page payload.
 * Students only get folders for tutors they have a confirmed and paid session
 * with (accepted + payment, or completed); tutors get their own folder;
 * faculty and admins get everything.
 */
const folders = asyncHandler(async (req, res) => {
  const role = req.user.role;
  let tutorUserIds = null;
  if (role === 'student') {
    const rows = await query(
      `SELECT DISTINCT s.tutor_id
       FROM sessions s
       WHERE s.student_id = ?
         AND (
           s.status = 'completed'
           OR (
             s.status = 'accepted'
             AND (
               EXISTS (SELECT 1 FROM payments p WHERE p.session_id = s.id)
               OR EXISTS (
                 SELECT 1 FROM conversation_payments cp
                 WHERE cp.conversation_id = s.conversation_id AND cp.status = 'accepted'
               )
             )
           )
         )`,
      [req.user.id]
    );
    tutorUserIds = new Set(rows.map((r) => Number(r.tutor_id)));
  } else if (role === 'tutor') {
    tutorUserIds = new Set([Number(req.user.id)]);
  }

  const allTutors = await tutorModel.getAllTutorsWithSubjects();
  const tutors = tutorUserIds
    ? allTutors.filter((t) => tutorUserIds.has(Number(t.user_id)))
    : allTutors;

  ok(res, 200, { tutors, resources: await resourceModel.listAll() });
});

/** POST /api/resources — tutor uploads a resource (JSON body: title, file_name, data[base64], subject_id?, file_type?, description?). */
const upload = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tutor') throw new ApiError(403, 'Only tutors can upload resources');

  const { title, file_name, data, subject_id, file_type, description } = req.body;
  if (!title || typeof title !== 'string') throw new ApiError(400, 'Resource title is required');
  if (!data || typeof data !== 'string') throw new ApiError(400, 'File data is required');

  const fileName = (file_name && String(file_name)) || title;
  const ext = path.extname(fileName).replace('.', '').toLowerCase();
  const derivedType = TYPE_BY_EXT[ext];
  if (!derivedType) throw new ApiError(400, `Unsupported file type "${ext || 'none'}"`);

  let fileType = file_type && String(file_type).toUpperCase();
  if (fileType) {
    if (!ALLOWED_TYPES.has(fileType)) throw new ApiError(400, `Unsupported resource type "${fileType}"`);
  } else {
    fileType = derivedType;
  }

  const base64 = data.includes('base64,') ? data.split('base64,')[1] : data;
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw new ApiError(400, 'File data is empty');
  if (buffer.length > MAX_BYTES) throw new ApiError(413, 'Files are limited to 500 MB');

  if (subject_id != null && subject_id !== '') {
    const profile = await tutorModel.findProfileByUserId(req.user.id);
    const keys = profile ? await tutorModel.getSubjectKeys(profile.id) : [];
    if (!keys.some((k) => Number(k) === Number(subject_id))) {
      throw new ApiError(400, 'You can only attach resources to subjects you teach');
    }
  }

  const resource = await resourceModel.create({
    tutorId: req.user.id,
    subjectId: subject_id ? Number(subject_id) : null,
    title: title.slice(0, 255),
    fileName: fileName.slice(0, 255),
    fileType,
    sizeBytes: buffer.length,
    description: description ? String(description).slice(0, 500) : null
  });

  try {
    fs.writeFileSync(diskPathFor(resource), buffer);
  } catch (err) {
    await resourceModel.remove(resource.id);
    throw new ApiError(500, 'Could not save the file on disk');
  }

  log(req, 'resource.upload', 'resource', resource.id, { title: resource.title, fileName: resource.file_name, size: buffer.length });
  ok(res, 201, resource, 'Resource uploaded');
});

/** GET /api/resources/:id/file — streams the actual file (auth only). */
const getFile = asyncHandler(async (req, res) => {
  const resource = await resourceModel.findById(Number(req.params.id));
  if (!resource) throw new ApiError(404, 'Resource not found');
  const file = diskPathFor(resource);
  if (!fs.existsSync(file)) throw new ApiError(404, 'File is missing on disk');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.title)}"`);
  res.sendFile(file);
});

/** DELETE /api/resources/:id — the tutor who uploaded removes it. */
const remove = asyncHandler(async (req, res) => {
  const resource = await resourceModel.findById(Number(req.params.id));
  if (!resource) throw new ApiError(404, 'Resource not found');
  if (resource.tutor_id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only the uploading tutor can remove this resource');
  }
  await resourceModel.remove(resource.id);
  try {
    if (fs.existsSync(diskPathFor(resource))) fs.unlinkSync(diskPathFor(resource));
  } catch (err) { /* best-effort cleanup */ }
  log(req, 'resource.remove', 'resource', resource.id, { title: resource.title });
  ok(res, 200, null, 'Resource removed');
});

module.exports = { list, folders, upload, getFile, remove };