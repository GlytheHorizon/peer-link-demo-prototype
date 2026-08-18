const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const tutorModel = require('../models/tutorModel');
const subjectModel = require('../models/subjectModel');
const evaluationModel = require('../models/evaluationModel');
const log = require('../services/activityLogService').log;

/** GET /api/tutors/me — own profile with subjects + ratings. */
const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await tutorModel.getProfileWithSubjects(req.user.id);
  if (!profile) throw new ApiError(404, 'Tutor profile not found');
  const ratings = await evaluationModel.ratingSummaryByTutor();
  const mine = ratings.find((r) => r.user_id === req.user.id) || { avg_rating: 0, rating_count: 0 };
  ok(res, 200, { ...profile, ...mine });
});

/** PUT /api/tutors/me — update profile fields. */
const updateMyProfile = asyncHandler(async (req, res) => {
  const {
    course, max_year_level, bio, availability, tags, age, grade_level, school, strand,
    subjects_teach, learning_mode, preferred_schedule, preferred_time
  } = req.body;
  req.body.strand = req.body.strand === 'JHS (Grade 7-10)' ? 'JHS' : req.body.strand;
  validate({
    course: [v.maxLen(150)],
    max_year_level: [v.intRange(1, 10, 'max year level')],
    bio: [v.maxLen(2000)],
    availability: [v.object('weekly availability')],
    age: [v.intRange(10, 100, 'age')],
    grade_level: [v.maxLen(50)],
    school: [v.maxLen(150)],
    strand: [v.isIn(['STEM', 'GAS', 'ICT', 'ABM', 'HUMSS', 'JHS'])],
    learning_mode: [v.isIn(['online', 'face-to-face', 'both'])],
    preferred_time: [v.maxLen(60)]
  }, req.body);
  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.length > 12) {
      throw new ApiError(400, 'Validation failed', ['tags: must be an array of at most 12 tags']);
    }
    for (const tag of tags) {
      if (typeof tag !== 'string' || !tag.trim() || tag.trim().length > 30) {
        throw new ApiError(400, 'Validation failed', ['tags: each tag must be a non-empty string of at most 30 characters']);
      }
    }
  }
  const profile = await tutorModel.findProfileByUserId(req.user.id);
  if (!profile) throw new ApiError(404, 'Tutor profile not found');
  await tutorModel.updateProfile(req.user.id, {
    course, max_year_level, bio, availability, tags, age, grade_level, school, strand,
    subjects_teach, learning_mode, preferred_schedule, preferred_time
  });
  log(req, 'tutor.profile_update', 'tutor_profile', profile.id);
  const updated = await tutorModel.getProfileWithSubjects(req.user.id);
  const ratings = await evaluationModel.ratingSummaryByTutor();
  const mine = ratings.find((r) => r.user_id === req.user.id) || { avg_rating: 0, rating_count: 0 };
  ok(res, 200, { ...updated, ...mine }, 'Profile updated');
});

/** GET /api/tutors/me/subjects */
const getMySubjects = asyncHandler(async (req, res) => {
  const profile = await tutorModel.getProfileWithSubjects(req.user.id);
  if (!profile) throw new ApiError(404, 'Tutor profile not found');
  ok(res, 200, profile.subjects);
});

/** PUT /api/tutors/me/subjects — replace the subjects a tutor teaches. */
const setMySubjects = asyncHandler(async (req, res) => {
  const { subjects } = req.body;
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new ApiError(400, 'Validation failed', ['subjects: must be a non-empty array of subjects']);
  }
  const items = subjects.map((s) => (
    typeof s === 'object'
      ? { subject_id: Number(s.subject_id), proficiency: Number(s.proficiency) || 3, rate_per_hour: s.rate_per_hour }
      : { subject_id: Number(s), proficiency: 3 }
  ));
  const unique = [...new Map(items.map((s) => [s.subject_id, s])).values()];
  for (const item of unique) {
    if (!Number.isInteger(item.subject_id)) throw new ApiError(400, 'Validation failed', ['subjects: all subject ids must be integers']);
    if (!(await subjectModel.findById(item.subject_id))) throw new ApiError(400, `Subject id ${item.subject_id} does not exist`);
  }
  const profile = await tutorModel.findProfileByUserId(req.user.id);
  if (!profile) throw new ApiError(404, 'Tutor profile not found');
  await tutorModel.replaceSubjects(profile.id, unique);
  log(req, 'tutor.subjects_update', 'tutor_profile', profile.id, { subject_ids: unique.map((s) => s.subject_id) });
  ok(res, 200, await tutorModel.getProfileWithSubjects(req.user.id), 'Subjects updated');
});

/** GET /api/tutors — all active tutors with their subjects (folder browsing). */
const listTutors = asyncHandler(async (req, res) => {
  ok(res, 200, await tutorModel.getAllTutorsWithSubjects());
});

/** GET /api/tutors/:id — public tutor profile view. */
const getPublicTutor = asyncHandler(async (req, res) => {
  const tutor = await tutorModel.getPublicTutor(Number(req.params.id));
  if (!tutor) throw new ApiError(404, 'Tutor not found');
  const ratings = await evaluationModel.ratingSummaryByTutor();
  const mine = ratings.find((r) => r.user_id === tutor.user_id) || { avg_rating: 0, rating_count: 0 };
  ok(res, 200, { ...tutor, avg_rating: mine.avg_rating, rating_count: mine.rating_count });
});

module.exports = { getMyProfile, updateMyProfile, getMySubjects, setMySubjects, listTutors, getPublicTutor };