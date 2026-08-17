const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const studentModel = require('../models/studentModel');
const subjectModel = require('../models/subjectModel');
const log = require('../services/activityLogService').log;

/** GET /api/students/me — own profile with subjects. */
const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await studentModel.getProfileWithSubjects(req.user.id);
  if (!profile) throw new ApiError(404, 'Student profile not found');
  ok(res, 200, profile);
});

/** PUT /api/students/me — update profile fields. */
const updateMyProfile = asyncHandler(async (req, res) => {
  const { year_level, course, bio } = req.body;
  validate({
    year_level: [v.intRange(1, 10, 'year level')],
    course: [v.maxLen(150)],
    bio: [v.maxLen(2000)]
  }, req.body);
  const profile = await studentModel.findProfileByUserId(req.user.id);
  if (!profile) throw new ApiError(404, 'Student profile not found');
  await studentModel.updateProfile(req.user.id, { year_level, course, bio });
  log(req, 'student.profile_update', 'student_profile', profile.id);
  ok(res, 200, await studentModel.getProfileWithSubjects(req.user.id), 'Profile updated');
});

/** PUT /api/students/me/subjects — replace subjects needing help. */
const setMySubjects = asyncHandler(async (req, res) => {
  const { subject_ids } = req.body;
  if (!Array.isArray(subject_ids) || subject_ids.length === 0) {
    throw new ApiError(400, 'Validation failed', ['subject_ids: must be a non-empty array of subject ids']);
  }
  const unique = [...new Set(subject_ids.map(Number))];
  for (const sid of unique) {
    if (!Number.isInteger(sid)) throw new ApiError(400, 'Validation failed', ['subject_ids: all values must be integers']);
    if (!(await subjectModel.findById(sid))) throw new ApiError(400, `Subject id ${sid} does not exist`);
  }
  const profile = await studentModel.findProfileByUserId(req.user.id);
  if (!profile) throw new ApiError(404, 'Student profile not found');
  await studentModel.replaceSubjects(profile.id, unique);
  log(req, 'student.subjects_update', 'student_profile', profile.id, { subject_ids: unique });
  ok(res, 200, await studentModel.getProfileWithSubjects(req.user.id), 'Subjects updated');
});

/** GET /api/students/me/subjects */
const getMySubjects = asyncHandler(async (req, res) => {
  const profile = await studentModel.getProfileWithSubjects(req.user.id);
  if (!profile) throw new ApiError(404, 'Student profile not found');
  ok(res, 200, profile.subjects);
});

module.exports = { getMyProfile, updateMyProfile, setMySubjects, getMySubjects };