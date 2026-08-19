const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const conversationModel = require('../models/conversationModel');
const messageModel = require('../models/messageModel');
const tutorModel = require('../models/tutorModel');
const studentModel = require('../models/studentModel');
const subjectModel = require('../models/subjectModel');
const log = require('../services/activityLogService').log;

/** GET /api/conversations — my conversations with unread counts. */
const listMine = asyncHandler(async (req, res) => {
  const conversations = await conversationModel.listForUser(req.user.id);
  ok(res, 200, conversations);
});

/** POST /api/conversations — start/find a conversation.
 *  Students pass tutor_id; tutors pass student_id.
 *  subject_id is optional (chats started from a profile have no subject). */
const start = asyncHandler(async (req, res) => {
  const { tutor_id, student_id, subject_id } = req.body;
  if (subject_id) {
    validate({ subject_id: [v.intRange(1, 1000000, 'subject id')] }, req.body);
    if (!(await subjectModel.findById(subject_id))) throw new ApiError(404, 'Subject not found');
  }
  if (!['student', 'tutor'].includes(req.user.role)) {
    throw new ApiError(403, 'Only students and tutors can start conversations');
  }

  let studentId;
  let tutorId;
  if (req.user.role === 'tutor') {
    validate({ student_id: [v.required('student_id'), v.intRange(1, 1000000, 'student id')] }, req.body);
    if (student_id === req.user.id) throw new ApiError(400, 'You cannot message yourself');
    const student = await studentModel.findProfileByUserId(student_id);
    if (!student) throw new ApiError(404, 'Student not found');
    studentId = student_id;
    tutorId = req.user.id;
  } else {
    validate({ tutor_id: [v.required('tutor_id'), v.intRange(1, 1000000, 'tutor id')] }, req.body);
    if (tutor_id === req.user.id) throw new ApiError(400, 'You cannot message yourself');
    const tutor = await tutorModel.findProfileByUserId(tutor_id);
    if (!tutor) throw new ApiError(404, 'Tutor not found');
    studentId = req.user.id;
    tutorId = tutor_id;
  }

  const conversation = await conversationModel.findOrCreate({
    studentId,
    tutorId,
    subjectId: subject_id
  });
  if (conversation.deleted_by === req.user.id) {
    await conversationModel.restoreForUser(conversation.id, req.user.id);
  }
  log(req, 'conversation.start', 'conversation', conversation.id);
  ok(res, 201, await conversationModel.findById(conversation.id), 'Conversation ready');
});

/** GET /api/conversations/:id — single conversation (participants only).
 *  Reopening a conversation the caller had deleted brings it back into their list. */
const getOne = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await conversationModel.isParticipant(id, req.user.id))) {
    throw new ApiError(403, 'You are not part of this conversation');
  }
  const conversation = await conversationModel.findById(id);
  if (conversation && conversation.deleted_by === req.user.id) {
    await conversationModel.restoreForUser(id, req.user.id);
  }
  ok(res, 200, conversation);
});

/** DELETE /api/conversations/:id — hides the conversation for the caller only. */
const deleteOne = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await conversationModel.isParticipant(id, req.user.id))) {
    throw new ApiError(403, 'You are not part of this conversation');
  }
  const result = await conversationModel.removeForUser(id, req.user.id);
  if (!result.deleted) throw new ApiError(404, 'Conversation not found');
  log(req, 'conversation.delete', 'conversation', id);
  ok(
    res,
    200,
    { id },
    result.hard
      ? 'Conversation deleted for both participants'
      : 'Conversation deleted — the other participant can still see it'
  );
});

module.exports = { listMine, start, getOne, deleteOne };