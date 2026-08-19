const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const sessionModel = require('../models/sessionModel');
const subjectModel = require('../models/subjectModel');
const tutorModel = require('../models/tutorModel');
const conversationModel = require('../models/conversationModel');
const paymentModel = require('../models/paymentModel');
const conversationPaymentModel = require('../models/conversationPaymentModel');
const rescheduleRequestModel = require('../models/rescheduleRequestModel');
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

/** GET /api/sessions/conflicts?start&end&other_id&exclude_session_id — live overlap check for scheduling (booleans only, no private data). */
const checkConflicts = asyncHandler(async (req, res) => {
  const { start, end, other_id, exclude_session_id } = req.query;
  validate({
    start: [v.required('start'), v.date('start')],
    end: [v.required('end'), v.date('end')]
  }, req.query);

  const startIso = new Date(start).toISOString().slice(0, 19).replace('T', ' ');
  const endIso = new Date(end).toISOString().slice(0, 19).replace('T', ' ');
  const excludeId = Number(exclude_session_id);
  const exclude = Number.isInteger(excludeId) && excludeId > 0 ? excludeId : null;

  const mine = await sessionModel.hasOverlap({ userId: req.user.id, start: startIso, end: endIso, excludeSessionId: exclude });
  let otherBusy = false;
  const otherId = Number(other_id);
  if (Number.isInteger(otherId) && otherId > 0 && otherId !== req.user.id) {
    otherBusy = await sessionModel.hasOverlap({ userId: otherId, start: startIso, end: endIso, excludeSessionId: exclude });
  }
  ok(res, 200, { mine, other_busy: otherBusy, conflict: mine || otherBusy });
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

  if (await sessionModel.hasActiveBooking({ studentId: req.user.id, tutorId: tutor_id, subjectId: subject_id })) {
    throw new ApiError(409, 'You already have an active session with this tutor for this subject');
  }

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

/** PATCH /api/sessions/:id/respond — tutor accepts or rejects (with optional reason). */
const respond = asyncHandler(async (req, res) => {
  const { decision, reason } = req.body;
  validate({
    decision: [v.required('decision'), v.isIn(['accepted', 'rejected'])],
    reason: [v.maxLen(300)]
  }, req.body);
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
  const reasonText = decision === 'rejected' && reason != null ? String(reason).trim().slice(0, 300) || null : null;
  await sessionModel.updateStatus(session.id, decision, reasonText);
  log(req, 'session.respond', 'session', session.id, { decision, ...(reasonText ? { reason: reasonText } : {}) });
  ok(res, 200, await sessionModel.findById(session.id), decision === 'accepted' ? 'Session confirmed' : 'Session rejected');
});

/** POST /api/sessions/:id/complete-confirm — a participant confirms the session
 *  was completed. The session only becomes 'completed' once BOTH the student
 *  and the tutor have confirmed; students can then rate/evaluate the tutor. */
const confirmComplete = asyncHandler(async (req, res) => {
  const session = await sessionModel.findById(Number(req.params.id));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.student_id !== req.user.id && session.tutor_id !== req.user.id) {
    throw new ApiError(403, 'You are not part of this session');
  }
  if (session.status === 'completed') throw new ApiError(409, 'Session is already completed');
  if (session.status !== 'accepted') throw new ApiError(409, `Only confirmed sessions can be completed — this session is ${session.status}`);
  if (!session.payment_id) {
    throw new ApiError(409, 'This session has not been paid yet — completion unlocks once the payment is confirmed');
  }

  const isStudent = session.student_id === req.user.id;
  if (isStudent && session.student_complete_confirmed_at) {
    throw new ApiError(409, 'You already confirmed this session — waiting for the tutor');
  }
  if (!isStudent && session.tutor_complete_confirmed_at) {
    throw new ApiError(409, 'You already confirmed this session — waiting for the student');
  }

  await sessionModel.confirmCompletion(session.id, isStudent ? 'student' : 'tutor');
  const updated = await sessionModel.findById(session.id);
  const completedNow = updated.status === 'completed';
  log(req, completedNow ? 'session.complete' : 'session.complete_confirm', 'session', session.id, { by: isStudent ? 'student' : 'tutor' });
  ok(res, 200, updated, completedNow
    ? 'Session completed — the student can now rate your session'
    : 'Completion confirmed — waiting for the other participant to confirm');
});

/** PATCH /api/sessions/:id/cancel — student or tutor cancels a non-completed session.
 *  The student may only cancel within 5 minutes of booking (free-cancel window). */
const cancel = asyncHandler(async (req, res) => {
  const SESSION_CANCEL_WINDOW_MS = 5 * 60 * 1000;
  const { reason } = req.body;
  validate({ reason: [v.maxLen(300)] }, req.body);

  const session = await sessionModel.findById(Number(req.params.id));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.student_id !== req.user.id && session.tutor_id !== req.user.id) {
    throw new ApiError(403, 'You are not part of this session');
  }
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw new ApiError(409, `Session is already ${session.status}`);
  }
  if (req.user.id === session.student_id) {
    const windowMs = new Date(session.created_at).getTime() + SESSION_CANCEL_WINDOW_MS - Date.now();
    if (windowMs <= 0) {
      throw new ApiError(409, 'The 5-minute free-cancel window has expired — you can no longer cancel this session');
    }
  }
  const reasonText = reason != null ? String(reason).trim().slice(0, 300) || null : null;
  await sessionModel.cancel(session.id, reasonText);
  log(req, 'session.cancel', 'session', session.id, { ...(reasonText ? { reason: reasonText } : {}) });
  ok(res, 200, await sessionModel.findById(session.id), 'Session cancelled');
});

/** PATCH /api/sessions/:id/reschedule — student or tutor moves a non-completed session. */
const reschedule = asyncHandler(async (req, res) => {
  const { scheduled_start, scheduled_end, reason } = req.body;
  validate({
    scheduled_start: [v.required('scheduled_start'), v.date('start')],
    scheduled_end: [v.required('scheduled_end'), v.date('end')],
    reason: [v.maxLen(500)]
  }, req.body);

  const session = await sessionModel.findById(Number(req.params.id));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.student_id !== req.user.id && session.tutor_id !== req.user.id) {
    throw new ApiError(403, 'You are not part of this session');
  }
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw new ApiError(409, `Session is already ${session.status}`);
  }
  if (await rescheduleRequestModel.findPendingBySession(session.id)) {
    throw new ApiError(409, 'A reschedule request is already pending for this session');
  }

  const start = new Date(scheduled_start);
  const end = new Date(scheduled_end);
  if (end.getTime() - start.getTime() < MIN_DURATION_MS) throw new ApiError(400, 'Sessions must be at least 15 minutes long');
  if (end.getTime() - start.getTime() > MAX_DURATION_MS) throw new ApiError(400, 'Sessions cannot exceed 4 hours');
  if (start.getTime() <= Date.now()) throw new ApiError(400, 'Sessions must be scheduled in the future');

  const originalDuration = new Date(session.scheduled_end).getTime() - new Date(session.scheduled_start).getTime();
  if (Math.abs(end.getTime() - start.getTime() - originalDuration) > 60 * 1000) {
    throw new ApiError(400, 'Reschedules must keep the same duration as the paid schedule — no more, no less');
  }

  const startIso = start.toISOString().slice(0, 19).replace('T', ' ');
  const endIso = end.toISOString().slice(0, 19).replace('T', ' ');
  if (await sessionModel.hasOverlap({ userId: req.user.id, start: startIso, end: endIso, excludeSessionId: session.id })) {
    throw new ApiError(409, 'This conflicts with one of your existing sessions');
  }
  if (await sessionModel.hasOverlap({ userId: session.tutor_id, start: startIso, end: endIso, excludeSessionId: session.id })) {
    throw new ApiError(409, 'The tutor has an overlapping session at that time');
  }

  const request = await rescheduleRequestModel.create({
    sessionId: session.id,
    requesterId: req.user.id,
    proposedStart: startIso,
    proposedEnd: endIso,
    reason: reason || 'I would like to move this session to a different schedule.'
  });
  log(req, 'session.reschedule_request', 'session', session.id, { request_id: request.id });
  ok(res, 201, request, 'Reschedule request sent — waiting for the other party to confirm');
});

/** GET /api/sessions/:id/reschedule-requests — request history for a session (participants only). */
const listRescheduleRequests = asyncHandler(async (req, res) => {
  const session = await sessionModel.findById(Number(req.params.id));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.student_id !== req.user.id && session.tutor_id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError(403, 'You do not have access to this session');
  }
  const requests = await rescheduleRequestModel.listBySession(session.id);
  ok(res, 200, requests);
});

/** POST /api/sessions/:id/reschedule-requests/:requestId/respond — the other party accepts or rejects. */
const respondRescheduleRequest = asyncHandler(async (req, res) => {
  const { decision } = req.body;
  validate({ decision: [v.required('decision'), v.isIn(['accepted', 'rejected'])] }, req.body);

  const session = await sessionModel.findById(Number(req.params.id));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.student_id !== req.user.id && session.tutor_id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError(403, 'You do not have access to this session');
  }

  const request = await rescheduleRequestModel.findById(Number(req.params.requestId));
  if (!request || request.session_id !== session.id) throw new ApiError(404, 'Reschedule request not found');
  if (request.requester_id === req.user.id) throw new ApiError(403, 'You cannot respond to your own reschedule request');
  if (request.status !== 'pending') throw new ApiError(409, `Request is already ${request.status}`);
  if (session.status === 'completed' || session.status === 'cancelled') {
    throw new ApiError(409, `Session is already ${session.status}`);
  }

  if (decision === 'accepted') {
    if (new Date(request.proposed_start).getTime() <= Date.now()) {
      throw new ApiError(400, 'The proposed time has already passed — ask for a new reschedule');
    }
    const originalDuration = new Date(session.scheduled_end).getTime() - new Date(session.scheduled_start).getTime();
    const proposedDuration = new Date(request.proposed_end).getTime() - new Date(request.proposed_start).getTime();
    if (Math.abs(proposedDuration - originalDuration) > 60 * 1000) {
      throw new ApiError(400, 'The proposed reschedule does not match the paid duration — ask for a new reschedule');
    }
    const startIso = request.proposed_start.toISOString().slice(0, 19).replace('T', ' ');
    const endIso = request.proposed_end.toISOString().slice(0, 19).replace('T', ' ');
    if (await sessionModel.hasOverlap({ userId: session.student_id, start: startIso, end: endIso, excludeSessionId: session.id })) {
      throw new ApiError(409, 'The new schedule conflicts with the student\'s other sessions');
    }
    if (await sessionModel.hasOverlap({ userId: session.tutor_id, start: startIso, end: endIso, excludeSessionId: session.id })) {
      throw new ApiError(409, 'The new schedule conflicts with the tutor\'s other sessions');
    }
  }

  await rescheduleRequestModel.setStatus(request.id, decision);

  if (decision === 'accepted') {
    const startIso = request.proposed_start.toISOString().slice(0, 19).replace('T', ' ');
    const endIso = request.proposed_end.toISOString().slice(0, 19).replace('T', ' ');
    await sessionModel.updateSchedule(session.id, startIso, endIso);
  }

  log(req, 'session.reschedule_respond', 'session', session.id, { request_id: request.id, decision });
  const msg = decision === 'accepted'
    ? 'Reschedule confirmed — the session has been moved'
    : 'Reschedule request declined — the session keeps its original schedule';
  ok(res, 200, await rescheduleRequestModel.findById(request.id), msg);
});

/** DELETE /api/sessions/:id — the student who booked removes a session request the tutor has not confirmed yet. */
const deleteRequest = asyncHandler(async (req, res) => {
  const session = await sessionModel.findById(Number(req.params.id));
  if (!session) throw new ApiError(404, 'Session not found');
  if (session.student_id !== req.user.id) {
    throw new ApiError(403, 'Only the student who booked this session can delete it');
  }
  if (session.status !== 'pending') {
    throw new ApiError(409, 'Only session requests that are not yet confirmed can be deleted');
  }
  await sessionModel.remove(session.id);
  log(req, 'session.delete', 'session', session.id);
  ok(res, 200, null, 'Session request deleted');
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

  if (session.conversation_id) {
    const convPayments = await conversationPaymentModel.listByConversation(session.conversation_id);
    if (convPayments.some((p) => p.status === 'accepted')) {
      throw new ApiError(409, 'Session is already paid');
    }
  }

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
  const rate = session.rate_per_hour != null ? Number(session.rate_per_hour) : RATE_PER_HOUR;
  const amount = Math.round(hours * rate);

  let payment;
  let message = 'Payment recorded — your session is confirmed';
  if (session.conversation_id) {
    if (await conversationPaymentModel.hasPending(session.conversation_id)) {
      throw new ApiError(409, 'You already have a pending payment in the conversation — wait for the tutor to confirm it');
    }
    payment = await conversationPaymentModel.create({
      conversationId: session.conversation_id,
      studentId: req.user.id,
      tutorId: session.tutor_id,
      amount,
      reference: `Session payment via ${method}`
    });
    message = 'Payment sent — waiting for the tutor to confirm in your conversation';
  } else {
    payment = await paymentModel.create({ sessionId: session.id, studentId: req.user.id, method, amount });
  }
  log(req, 'session.pay', 'session', session.id, { method, amount });
  ok(res, 201, payment, message);
});

module.exports = {
  listMine, getOne, createRequest, respond, confirmComplete, cancel,
  reschedule, listRescheduleRequests, respondRescheduleRequest, deleteRequest, pay, checkConflicts
};