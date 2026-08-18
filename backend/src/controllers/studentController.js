const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const studentModel = require('../models/studentModel');
const subjectModel = require('../models/subjectModel');
const matchingService = require('../services/matchingService');
const log = require('../services/activityLogService').log;

/** GET /api/students/me — own profile with subjects. */
const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await studentModel.getProfileWithSubjects(req.user.id);
  if (!profile) throw new ApiError(404, 'Student profile not found');
  ok(res, 200, profile);
});

/** PUT /api/students/me — update profile fields. */
const updateMyProfile = asyncHandler(async (req, res) => {
  const {
    year_level, course, bio, age, grade_level, school, strand,
    subjects_needed, learning_mode, preferred_schedule, preferred_time
  } = req.body;
  req.body.strand = req.body.strand === 'JHS (Grade 7-10)' ? 'JHS' : req.body.strand;
  validate({
    year_level: [v.intRange(1, 10, 'year level')],
    course: [v.maxLen(150)],
    bio: [v.maxLen(2000)],
    age: [v.intRange(10, 100, 'age')],
    grade_level: [v.maxLen(50)],
    school: [v.maxLen(150)],
    strand: [v.isIn(['STEM', 'GAS', 'ICT', 'ABM', 'HUMSS', 'JHS'])],
    learning_mode: [v.isIn(['online', 'face-to-face', 'both'])],
    preferred_time: [v.maxLen(60)]
  }, req.body);
  const profile = await studentModel.findProfileByUserId(req.user.id);
  if (!profile) throw new ApiError(404, 'Student profile not found');
  await studentModel.updateProfile(req.user.id, {
    year_level, course, bio, age, grade_level, school, strand,
    subjects_needed, learning_mode, preferred_schedule, preferred_time
  });
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
  try {
    await matchingService.generateMatches(profile.id);
  } catch (err) {
    console.error('Auto-regeneration of matches failed after subject update:', err.message);
  }
  log(req, 'student.subjects_update', 'student_profile', profile.id, { subject_ids: unique });
  ok(res, 200, await studentModel.getProfileWithSubjects(req.user.id), 'Subjects updated');
});

/** GET /api/students/me/subjects */
const getMySubjects = asyncHandler(async (req, res) => {
  const profile = await studentModel.getProfileWithSubjects(req.user.id);
  if (!profile) throw new ApiError(404, 'Student profile not found');
  ok(res, 200, profile.subjects);
});

/** GET /api/students/:id — public student profile view (any logged-in user). */
const getPublicStudent = asyncHandler(async (req, res) => {
  const profile = await studentModel.getProfileWithSubjects(Number(req.params.id));
  if (!profile) throw new ApiError(404, 'Student not found');
  ok(res, 200, profile);
});

module.exports = { getMyProfile, updateMyProfile, setMySubjects, getMySubjects, getPublicStudent };