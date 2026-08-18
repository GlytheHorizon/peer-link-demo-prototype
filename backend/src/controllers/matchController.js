const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const studentModel = require('../models/studentModel');
const matchModel = require('../models/matchModel');
const matchingService = require('../services/matchingService');
const log = require('../services/activityLogService').log;

/** POST /api/matches/generate — run the matching algorithm for my student profile. */
const generate = asyncHandler(async (req, res) => {
  const { subject_id } = req.body;
  if (subject_id !== undefined && subject_id !== null && subject_id !== '') {
    validate({ subject_id: [v.intRange(1, 1000000, 'subject id')] }, { subject_id });
  }
  const profile = await studentModel.findProfileByUserId(req.user.id);
  if (!profile) throw new ApiError(404, 'Student profile not found. Complete your profile first.');

  const results = await matchingService.generateMatches(profile.id, subject_id ? Number(subject_id) : null);
  log(req, 'match.generate', 'student_profile', profile.id, { subject_id: subject_id ?? null, matches: results.length });
  ok(res, 200, results, `Matching complete — ${results.length} tutor(s) found`);
});

/** GET /api/matches — my stored match results (sorted by score desc). */
const listMyMatches = asyncHandler(async (req, res) => {
  const profile = await studentModel.findProfileByUserId(req.user.id);
  if (!profile) throw new ApiError(404, 'Student profile not found');
  const { subject_id } = req.query;
  let matches;
  if (subject_id) {
    matches = await matchModel.findForStudentAndSubject(profile.id, Number(subject_id));
  } else {
    matches = await matchModel.findByStudent(profile.id);
  }
  ok(res, 200, matches);
});

/** GET /api/matches/search?q=&subject_id= — free-text search across all tutors/subjects. */
const search = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) throw new ApiError(400, 'Query parameter q is required');
  const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;
  if (subjectId) {
    validate({ subject_id: [v.intRange(1, 1000000, 'subject id')] }, { subject_id });
  }
  const results = await matchingService.searchTutors(q, subjectId);
  ok(res, 200, results);
});

/** GET /api/matches/browse?subject_id= — every tutor and the subjects they teach. */
const browse = asyncHandler(async (req, res) => {
  const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;
  if (subjectId) {
    validate({ subject_id: [v.intRange(1, 1000000, 'subject id')] }, { subject_id });
  }
  const results = await matchingService.browseTutors(subjectId ? [subjectId] : null, null);
  ok(res, 200, results);
});

/** GET /api/matches/:id — single match (own only). */
const getMatch = asyncHandler(async (req, res) => {
  const match = await matchModel.findById(Number(req.params.id));
  if (!match) throw new ApiError(404, 'Match not found');
  const profile = await studentModel.findProfileByUserId(req.user.id);
  if (!profile || match.student_profile_id !== profile.id) {
    throw new ApiError(403, 'You can only view your own matches');
  }
  ok(res, 200, match);
});

module.exports = { generate, listMyMatches, search, browse, getMatch };