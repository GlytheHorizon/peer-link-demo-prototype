const fs = require('fs');
const path = require('path');
const { ApiError, asyncHandler, ok } = require('../utils/http');
const studentModel = require('../models/studentModel');
const tutorModel = require('../models/tutorModel');
const log = require('../services/activityLogService').log;

const UPLOAD_ROOT = path.join(__dirname, '..', '..', '..', 'uploads');

/** Only students and tutors get profile pictures, each stored in their own folder. */
const ROLE_DIRS = {
  student: path.join(UPLOAD_ROOT, 'students', 'profile_picture'),
  tutor: path.join(UPLOAD_ROOT, 'tutors', 'profile_picture')
};

const ROLE_URLS = {
  student: '/api/uploads/students/profile_picture',
  tutor: '/api/uploads/tutors/profile_picture'
};

for (const dir of Object.values(ROLE_DIRS)) {
  fs.mkdirSync(dir, { recursive: true });
}

const MAX_BYTES = 2 * 1024 * 1024;

/** Verifies the file signature so only real JPG/PNG/WEBP images are saved. */
function detectImageExt(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/** Resolves a stored `/api/uploads/...` URL to its on-disk path (within the uploads folder). */
function diskPathForUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = /^\/api\/uploads\/(students|tutors)\/profile_picture\/([^/]+)$/.exec(url);
  if (!match) return null;
  return path.join(UPLOAD_ROOT, match[1], 'profile_picture', path.basename(match[2]));
}

function findProfile(role, userId) {
  return role === 'student'
    ? studentModel.findProfileByUserId(userId)
    : tutorModel.findProfileByUserId(userId);
}

function updateProfile(role, userId, fields) {
  return role === 'student'
    ? studentModel.updateProfile(userId, fields)
    : tutorModel.updateProfile(userId, fields);
}

function deleteStoredFile(url) {
  const file = diskPathForUrl(url);
  if (!file) return;
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* best-effort cleanup */
  }
}

/** POST /api/users/me/profile-picture — upload/replace own photo (JSON body: data[base64], file_name?). */
const upload = asyncHandler(async (req, res) => {
  const role = req.user.role;
  if (role !== 'student' && role !== 'tutor') {
    throw new ApiError(403, 'Only student and tutor accounts can have a profile picture');
  }

  const { data } = req.body;
  if (!data || typeof data !== 'string') throw new ApiError(400, 'Image data is required');

  let base64 = data;
  const dataUrl = /^data:[^;]+;base64,(.*)$/s.exec(data);
  if (dataUrl) base64 = dataUrl[1];

  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw new ApiError(400, 'Image data is empty');
  if (buffer.length > MAX_BYTES) throw new ApiError(413, 'Profile pictures must be 2 MB or smaller');

  const ext = detectImageExt(buffer);
  if (!ext) throw new ApiError(400, 'Profile pictures must be JPG, PNG, or WEBP images');

  const profile = await findProfile(role, req.user.id);
  if (!profile) throw new ApiError(404, 'Profile not found');

  const filename = `${req.user.id}_${Date.now()}.${ext}`;
  const target = path.join(ROLE_DIRS[role], filename);
  try {
    fs.writeFileSync(target, buffer);
  } catch {
    throw new ApiError(500, 'Could not save the profile picture');
  }

  const url = `${ROLE_URLS[role]}/${filename}`;
  try {
    await updateProfile(role, req.user.id, { profile_picture: url });
  } catch (err) {
    deleteStoredFile(url);
    throw err;
  }

  deleteStoredFile(profile.profile_picture);
  log(req, 'user.profile_picture', 'user', req.user.id, { profile_picture: url });
  ok(res, 200, { profile_picture: url }, 'Profile picture updated');
});

/** DELETE /api/users/me/profile-picture — remove own photo and revert to initials. */
const remove = asyncHandler(async (req, res) => {
  const role = req.user.role;
  if (role !== 'student' && role !== 'tutor') {
    throw new ApiError(403, 'Only student and tutor accounts can have a profile picture');
  }

  const profile = await findProfile(role, req.user.id);
  if (!profile) throw new ApiError(404, 'Profile not found');

  if (profile.profile_picture) {
    await updateProfile(role, req.user.id, { profile_picture: null });
    deleteStoredFile(profile.profile_picture);
    log(req, 'user.profile_picture_remove', 'user', req.user.id);
  }

  ok(res, 200, { profile_picture: null }, 'Profile picture removed');
});

module.exports = { upload, remove };
