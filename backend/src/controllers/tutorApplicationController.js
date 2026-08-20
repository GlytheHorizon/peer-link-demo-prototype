const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const { withTransaction } = require('../config/db');
const userModel = require('../models/userModel');
const tutorModel = require('../models/tutorModel');
const appModel = require('../models/tutorApplicationModel');
const log = require('../services/activityLogService').log;

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'registrations_data');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_BYTES = 10 * 1024 * 1024;

/** Keeps only safe filename characters; used for the on-disk name. */
function sanitizeName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.').slice(0, 120);
}

function saveBase64File(dataUrl, suggestedName, prefix) {
  const data = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length) throw new ApiError(400, 'File data is empty');
  if (buffer.length > MAX_BYTES) throw new ApiError(413, 'Files are limited to 10 MB');
  const ext = path.extname(suggestedName || '').replace('.', '').toLowerCase() || 'jpg';
  const name = `${prefix}.${sanitizeName(suggestedName || `file.${ext}`)}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
  return name;
}

/** POST /api/auth/tutor-apply — public tutor registration application. */
const apply = asyncHandler(async (req, res) => {
  const {
    full_name, email, phone, address, hourly_rate, subjects,
    license_number, institution, specialization, years_teaching,
    license_file, license_file_name, id_file, id_file_name
  } = req.body;

  validate({
    full_name: [v.required('full_name'), v.maxLen(200)],
    email: [v.required('email'), v.email()],
    phone: [v.required('phone'), v.maxLen(30)]
  }, req.body);

  if (!Number.isFinite(Number(hourly_rate)) || Number(hourly_rate) <= 0) {
    throw new ApiError(400, 'hourly_rate: must be a positive number');
  }
  if (!Array.isArray(subjects)) throw new ApiError(400, 'subjects: must be an array');
  if (!license_file || !id_file) throw new ApiError(400, 'Both a teaching license and a government ID are required');

  const app = await appModel.create({
    full_name: String(full_name).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone).trim(),
    address: address ? String(address).trim() : null,
    hourly_rate: Number(hourly_rate),
    subjects: subjects.map((s) => String(s)).filter(Boolean),
    license_number: license_number ? String(license_number).trim() : null,
    institution: institution ? String(institution).trim() : null,
    specialization: specialization ? String(specialization).trim() : null,
    years_teaching: years_teaching != null && years_teaching !== '' ? Number(years_teaching) : null
  });

  let licenseName = null;
  let idName = null;
  try {
    licenseName = saveBase64File(license_file, license_file_name, `license_${app.id}`);
    idName = saveBase64File(id_file, id_file_name, `id_${app.id}`);
  } catch (err) {
    await appModel.remove(app.id);
    throw err;
  }
  await appModel.updateFiles(app.id, { license_file: licenseName, id_file: idName });

  log(req, 'tutor.application_submitted', 'tutor_application', app.id, { email: app.email });
  ok(res, 201, await appModel.findById(app.id), 'Application submitted for review');
});

/** GET /api/admin/tutor-applications — list applications (admin only). */
const list = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  ok(res, 200, await appModel.list({
    status,
    page: Number(page) || 1,
    limit: Math.min(Number(limit) || 50, 100)
  }));
});

/** GET /api/auth/tutor-application — the signed-in user's own application (tutor only). */
const myStatus = asyncHandler(async (req, res) => {
  const app = await appModel.findByEmail(req.user.email);
  if (!app) throw new ApiError(404, 'No tutor application found for this account');
  ok(res, 200, app);
});

/** GET /api/admin/tutor-applications/:id — full application detail (admin only). */
const get = asyncHandler(async (req, res) => {
  const app = await appModel.findById(Number(req.params.id));
  if (!app) throw new ApiError(404, 'Application not found');
  ok(res, 200, app);
});

/** POST /api/admin/tutor-applications/:id/approve — creates the tutor account (admin only). */
const approve = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const app = await appModel.findById(id);
  if (!app) throw new ApiError(404, 'Application not found');
  if (app.status !== 'pending') throw new ApiError(409, `Application is already ${app.status}`);

  const userId = await withTransaction(async (conn) => {
    const exists = await userModel.findByEmail(app.email);
    if (exists) throw new ApiError(409, 'An account with this email already exists');

    const nameParts = String(app.full_name).split(/\s+/).filter(Boolean);
    const passwordHash = await bcrypt.hash('Tutor@123', 10);
    const uid = await userModel.create({
      email: app.email,
      password_hash: passwordHash,
      first_name: nameParts.shift(),
      last_name: nameParts.join(' ') || nameParts.shift() || 'Tutor',
      role: 'tutor'
    }, conn);
    await tutorModel.createProfile({
      userId: uid,
      course: app.specialization || null,
      school: app.address || null,
      contact_no: app.phone,
      subjects_teach: app.subjects,
      tags: app.subjects
    }, conn);
    return uid;
  });

  await appModel.setStatus(id, 'approved');
  log(req, 'tutor.application_approved', 'tutor_application', id, { email: app.email });
  ok(res, 200, await appModel.findById(id), 'Application approved — tutor account created');
});

/** POST /api/admin/tutor-applications/:id/reject (admin only). */
const reject = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const app = await appModel.findById(id);
  if (!app) throw new ApiError(404, 'Application not found');
  if (app.status !== 'pending') throw new ApiError(409, `Application is already ${app.status}`);
  await appModel.setStatus(id, 'rejected');
  log(req, 'tutor.application_rejected', 'tutor_application', id, { email: app.email });
  ok(res, 200, await appModel.findById(id), 'Application rejected');
});

const MIME = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

/** GET /api/admin/tutor-applications/:id/file/:field — streams an uploaded document (admin only). */
const getFile = asyncHandler(async (req, res) => {
  const app = await appModel.findById(Number(req.params.id));
  if (!app) throw new ApiError(404, 'Application not found');
  const field = req.params.field;
  const fileName = field === 'license' ? app.license_file : field === 'id' ? app.id_file : null;
  if (!fileName) throw new ApiError(404, 'File not found');
  const filePath = path.join(UPLOAD_DIR, path.basename(fileName));
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'File is missing on disk');
  const ext = path.extname(fileName).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
  res.sendFile(filePath);
});

module.exports = { apply, list, get, approve, reject, getFile, myStatus };