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
  const { course, max_year_level, bio, availability } = req.body;
  validate({
    course: [v.maxLen(150)],
    max_year_level: [v.intRange(1, 10, 'max year level')],
    bio: [v.maxLen(2000)],
    availability: [v.object('weekly availability')]
  }, req.body);
  const profile = await tutorModel.findProfileByUserId(req.user.id);
  if (!profile) throw new ApiError(404, 'Tutor profile not found');
  await tutorModel.updateProfile(req.user.id, { course, max_year_level, bio, availability });
  log(req, 'tutor.profile_update', 'tutor_profile', profile.id);
  const updated = await tutorModel.getProfileWithSubjects(req.user.id);
  const ratings = await evaluationModel.ratingSummaryByTutor();
  const mine = ratings.find((r) => r.user_id === req.user.id) || { avg_rating: 0, rating_count: 0 };
  ok(res, 200, { ...updated, ...mine }, 'Profile updated');
});

/** PUT /api/tutors/me/subjects — replace subjects taught (with proficiency 1-5). */
const setMySubjects = asyncHandler(async (req, res) => {
  const { subjects } = req.body;
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new ApiError(400, 'Validation failed', ['subjects: must be a non-empty array of { subject_id, proficiency }']);
  }
  const items = [];
  for (const item of subjects) {
    const sid = Number(item.subject_id);
    const prof = Number(item.proficiency || 3);
    if (!Number.isInteger(sid) || !(await subjectModel.findById(sid))) {
      throw new ApiError(400, 'Validation failed', [`subjects: subject_id ${item.subject_id} is not a known subject`]);
    }
    if (!Number.isInteger(prof) || prof < 1 || prof > 5) {
      throw new ApiError(400, 'Validation failed', ['subjects: proficiency must be an integer between 1 and 5']);
    }
    items.push({ subject_id: sid, proficiency: prof });
  }
  const profile = await tutorModel.findProfileByUserId(req.user.id);
  if (!profile) throw new ApiError(404, 'Tutor profile not found');
  await tutorModel.replaceSubjects(profile.id, items);
  log(req, 'tutor.subjects_update', 'tutor_profile', profile.id);
  ok(res, 200, await tutorModel.getProfileWithSubjects(req.user.id), 'Subjects updated');
});

/** GET /api/tutors/me/subjects */
const getMySubjects = asyncHandler(async (req, res) => {
  const profile = await tutorModel.getProfileWithSubjects(req.user.id);
  if (!profile) throw new ApiError(404, 'Tutor profile not found');
  ok(res, 200, profile.subjects);
});

/** POST /api/tutors/me/subjects — tutor creates their own subject and adds it to their profile. */
const addMySubject = asyncHandler(async (req, res) => {
  const { code, name, description, proficiency } = req.body;
  validate({
    code: [v.required('code'), v.maxLen(20)],
    name: [v.required('name'), v.maxLen(150)],
    description: [v.maxLen(500)],
    proficiency: [v.intRange(1, 5, 'proficiency')]
  }, req.body);
  const profile = await tutorModel.findProfileByUserId(req.user.id);
  if (!profile) throw new ApiError(404, 'Tutor profile not found');
  let subject = await subjectModel.findByCode(code.trim().toUpperCase());
  let created = false;
  if (!subject) {
    subject = await subjectModel.create({ code: code.trim().toUpperCase(), name: name.trim(), description });
    created = true;
    log(req, 'subject.create', 'subject', subject.id);
  }
  await tutorModel.addSubjectToProfile(profile.id, subject.id, proficiency || 3);
  log(req, 'tutor.subject_add', 'tutor_profile', profile.id);
  ok(res, created ? 201 : 200, {
    subject,
    profile: await tutorModel.getProfileWithSubjects(req.user.id)
  }, created
    ? `Subject ${subject.name} created and added to your profile`
    : `${subject.name} already exists — added to your profile`);
});

/** GET /api/tutors/:id — public tutor profile view. */
const getPublicTutor = asyncHandler(async (req, res) => {
  const tutor = await tutorModel.getPublicTutor(Number(req.params.id));
  if (!tutor) throw new ApiError(404, 'Tutor not found');
  const ratings = await evaluationModel.ratingSummaryByTutor();
  const mine = ratings.find((r) => r.user_id === tutor.user_id) || { avg_rating: 0, rating_count: 0 };
  ok(res, 200, { ...tutor, avg_rating: mine.avg_rating, rating_count: mine.rating_count });
});

module.exports = { getMyProfile, updateMyProfile, setMySubjects, getMySubjects, addMySubject, getPublicTutor };