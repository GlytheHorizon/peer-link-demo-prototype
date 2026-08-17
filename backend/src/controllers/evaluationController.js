const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const evaluationModel = require('../models/evaluationModel');
const sessionModel = require('../models/sessionModel');
const log = require('../services/activityLogService').log;

/** POST /api/evaluations — student evaluates a completed session (once only). */
const create = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new ApiError(403, 'Only students can evaluate sessions');
  const { session_id, rating, comment } = req.body;
  validate({
    session_id: [v.required('session_id'), v.intRange(1, 1000000, 'session id')],
    rating: [v.required('rating'), v.intRange(1, 5, 'rating 1-5')],
    comment: [v.maxLen(2000)]
  }, req.body);

  const session = await sessionModel.findById(session_id);
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.student_id !== req.user.id) throw new ApiError(403, 'You can only evaluate your own sessions');
  if (session.status !== 'completed') throw new ApiError(400, 'Sessions can only be evaluated after completion');
  if (await evaluationModel.findBySession(session_id)) {
    throw new ApiError(409, 'This session has already been evaluated');
  }

  await evaluationModel.create({
    sessionId: session_id,
    studentId: req.user.id,
    tutorId: session.tutor_id,
    rating: Number(rating),
    comment
  });
  log(req, 'evaluation.create', 'evaluation', session.id, { session_id, rating: Number(rating) });
  ok(res, 201, await evaluationModel.findBySession(session_id), 'Evaluation submitted — thank you!');
});

/** GET /api/evaluations/mine — evaluations I gave (student) or received (tutor). */
const listMine = asyncHandler(async (req, res) => {
  const data = req.user.role === 'tutor' || req.user.role === 'faculty'
    ? await evaluationModel.listReceivedByTutor(req.user.id)
    : await evaluationModel.listGivenByStudent(req.user.id);
  ok(res, 200, data);
});

/** GET /api/evaluations/:sessionId — evaluation for a session (participants + admin). */
const getForSession = asyncHandler(async (req, res) => {
  const session = await sessionModel.findById(Number(req.params.sessionId));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.student_id !== req.user.id && session.tutor_id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError(403, 'You do not have access to this evaluation');
  }
  ok(res, 200, await evaluationModel.findBySession(session.id));
});

module.exports = { create, listMine, getForSession };