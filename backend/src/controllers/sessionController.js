const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const sessionModel = require('../models/sessionModel');
const subjectModel = require('../models/subjectModel');
const tutorModel = require('../models/tutorModel');
const conversationModel = require('../models/conversationModel');
const paymentModel = require('../models/paymentModel');
const log = require('../services/activityLogService').log;

const MIN_DURATION_MS = 15 * 60 * 1000;
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;
const RATE_PER_HOUR = 100;
const PAY_METHODS = ['gcash', 'maya', 'bank_card'];

/** GET /api/sessions — my sessions (student or tutor roles). */
const listMine = asyncHandler(async (req, res) => {
  const sessions = req.user.role === 'tutor' || req.user.role === 'faculty'
    ? await sessionModel.listForTutor(req.user.id)
    : await sessionModel.listForStudent(req.user.id);
  ok(res, 200, sessions);
});

/** GET /api/sessions/:id — participant only. */
const getOne = asyncHandler(async (req, res) => {
  const session = await sessionModel.findById(Number(req.params.id));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.student_id !== req.user.id && session.tutor_id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError(403, 'You do not have access to this session');
  }
  ok(res, 200, { ...session, can_evaluate: session.student_id === req.user.id && session.status === 'completed' && !session.evaluation_id });
});

/** POST /api/sessions — student creates a session request. */
const createRequest = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new ApiError(403, 'Only students can create session requests');

  const { tutor_id, subject_id, scheduled_start, scheduled_end, topic, notes } = req.body;
  validate({
    tutor_id: [v.required('tutor_id'), v.intRange(1, 1000000, 'tutor id')],
    subject_id: [v.required('subject_id'), v.intRange(1, 1000000, 'subject id')],
    scheduled_start: [v.required('scheduled_start'), v.date('start')],
    scheduled_end: [v.required('scheduled_end'), v.date('end')],
    topic: [v.maxLen(255)],
    notes: [v.maxLen(2000)]
  }, req.body);

  const start = new Date(scheduled_start);
  const end = new Date(scheduled_end);
  if (end.getTime() - start.getTime() < MIN_DURATION_MS) throw new ApiError(400, 'Sessions must be at least 15 minutes long');
  if (end.getTime() - start.getTime() > MAX_DURATION_MS) throw new ApiError(400, 'Sessions cannot exceed 4 hours');
  if (start.getTime() <= Date.now()) throw new ApiError(400, 'Sessions must be scheduled in the future');

  if (!(await subjectModel.findById(subject_id))) throw new ApiError(404, 'Subject not found');
  const tutorProfile = await tutorModel.findProfileByUserId(tutor_id);
  if (!tutorProfile) throw new ApiError(404, 'Tutor not found');

  const startIso = start.toISOString().slice(0, 19).replace('T', ' ');
  const endIso = end.toISOString().slice(0, 19).replace('T', ' ');

  if (await sessionModel.hasOverlap({ userId: req.user.id, start: startIso, end: endIso })) {
    throw new ApiError(409, 'This conflicts with one of your existing sessions');
  }
  if (await sessionModel.hasOverlap({ userId: tutor_id, start: startIso, end: endIso })) {
    throw new ApiError(409, 'The tutor has an overlapping session at that time');
  }

  const conversation = await conversationModel.findOrCreate({
    studentId: req.user.id,
    tutorId: tutor_id,
    subjectId: subject_id
  });

  const session = await sessionModel.create({
    studentId: req.user.id,
    tutorId: tutor_id,
    subjectId: subject_id,
    conversationId: conversation.id,
    scheduledStart: startIso,
    scheduledEnd: endIso,
    topic,
    notes
  });
  log(req, 'session.request', 'session', session.id, { tutor_id });
  ok(res, 201, session, 'Session request created — waiting for tutor response');
});

/** PATCH /api/sessions/:id/respond — tutor accepts or rejects. */
const respond = asyncHandler(async (req, res) => {
  const { decision } = req.body;
  validate({ decision: [v.required('decision'), v.isIn(['accepted', 'rejected'])] }, req.body);
  const session = await sessionModel.findById(Number(req.params.id));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.tutor_id !== req.user.id) throw new ApiError(403, 'Only the assigned tutor can respond');
  if (session.status !== 'pending') throw new ApiError(409, `Session is already ${session.status}`);

  if (decision === 'accepted') {
    const startIso = session.scheduled_start.toISOString().slice(0, 19).replace('T', ' ');
    const endIso = session.scheduled_end.toISOString().slice(0, 19).replace('T', ' ');
    if (await sessionModel.hasOverlap({ userId: req.user.id, start: startIso, end: endIso, excludeSessionId: session.id })) {
      throw new ApiError(409, 'You have an overlapping session at that time; reject or cancel it first');
    }
  }
  await sessionModel.updateStatus(session.id, decision);
  log(req, 'session.respond', 'session', session.id, { decision });
  ok(res, 200, await sessionModel.findById(session.id), decision === 'accepted' ? 'Session confirmed' : 'Session rejected');
});

/** PATCH /api/sessions/:id/complete — tutor marks the session completed. */
const complete = asyncHandler(async (req, res) => {
  const session = await sessionModel.findById(Number(req.params.id));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.tutor_id !== req.user.id) throw new ApiError(403, 'Only the tutor can mark a session completed');
  if (session.status !== 'accepted') throw new ApiError(409, 'Only accepted sessions can be completed');
  await sessionModel.updateStatus(session.id, 'completed');
  log(req, 'session.complete', 'session', session.id);
  ok(res, 200, await sessionModel.findById(session.id), 'Session completed — the student can now evaluate');
});

/** PATCH /api/sessions/:id/cancel — student or tutor cancels a non-completed session. */
const cancel = asyncHandler(async (req, res) => {
  const session = await sessionModel.findById(Number(req.params.id));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.student_id !== req.user.id && session.tutor_id !== req.user.id) {
    throw new ApiError(403, 'You are not part of this session');
  }
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw new ApiError(409, `Session is already ${session.status}`);
  }
  await sessionModel.updateStatus(session.id, 'cancelled');
  log(req, 'session.cancel', 'session', session.id);
  ok(res, 200, await sessionModel.findById(session.id), 'Session cancelled');
});

/** POST /api/sessions/:id/pay — student pays for an accepted session (may set the date/time here). */
const pay = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new ApiError(403, 'Only students can pay for sessions');

  const { method, scheduled_start, scheduled_end } = req.body;
  validate({ method: [v.required('method'), v.isIn(PAY_METHODS)] }, req.body);

  const session = await sessionModel.findById(Number(req.params.id));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.student_id !== req.user.id) throw new ApiError(403, 'Only the booking student can pay');
  if (session.status !== 'accepted') throw new ApiError(409, 'Only accepted sessions can be paid');

  const existing = await paymentModel.findBySessionId(session.id);
  if (existing) throw new ApiError(409, 'Session is already paid');

  let start = new Date(session.scheduled_start);
  let end = new Date(session.scheduled_end);

  if (scheduled_start !== undefined || scheduled_end !== undefined) {
    validate({
      scheduled_start: [v.required('scheduled_start'), v.date('start')],
      scheduled_end: [v.required('scheduled_end'), v.date('end')]
    }, req.body);

    start = new Date(scheduled_start);
    end = new Date(scheduled_end);
    if (end.getTime() - start.getTime() < MIN_DURATION_MS) throw new ApiError(400, 'Sessions must be at least 15 minutes long');
    if (end.getTime() - start.getTime() > MAX_DURATION_MS) throw new ApiError(400, 'Sessions cannot exceed 4 hours');
    if (start.getTime() <= Date.now()) throw new ApiError(400, 'Sessions must be scheduled in the future');

    const startIso = start.toISOString().slice(0, 19).replace('T', ' ');
    const endIso = end.toISOString().slice(0, 19).replace('T', ' ');
    if (await sessionModel.hasOverlap({ userId: req.user.id, start: startIso, end: endIso, excludeSessionId: session.id })) {
      throw new ApiError(409, 'This conflicts with one of your existing sessions');
    }
    if (await sessionModel.hasOverlap({ userId: session.tutor_id, start: startIso, end: endIso, excludeSessionId: session.id })) {
      throw new ApiError(409, 'The tutor has an overlapping session at that time');
    }
    await sessionModel.updateSchedule(session.id, startIso, endIso);
  }

  const hours = Math.max((end.getTime() - start.getTime()) / 3600000, 15 / 60);
  const amount = Math.round(hours * RATE_PER_HOUR);

  const payment = await paymentModel.create({ sessionId: session.id, studentId: req.user.id, method, amount });
  log(req, 'session.pay', 'session', session.id, { method, amount });
  ok(res, 201, payment, 'Payment recorded — your session is confirmed');
});

module.exports = { listMine, getOne, createRequest, respond, complete, cancel, pay };