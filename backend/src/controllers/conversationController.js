const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const conversationModel = require('../models/conversationModel');
const messageModel = require('../models/messageModel');
const tutorModel = require('../models/tutorModel');
const subjectModel = require('../models/subjectModel');
const log = require('../services/activityLogService').log;

/** GET /api/conversations — my conversations with unread counts. */
const listMine = asyncHandler(async (req, res) => {
  const conversations = await conversationModel.listForUser(req.user.id);
  ok(res, 200, conversations);
});

/** POST /api/conversations — start/find a conversation with a tutor on a subject. */
const start = asyncHandler(async (req, res) => {
  const { tutor_id, subject_id } = req.body;
  validate({
    tutor_id: [v.required('tutor_id'), v.intRange(1, 1000000, 'tutor id')],
    subject_id: [v.required('subject_id'), v.intRange(1, 1000000, 'subject id')]
  }, req.body);

  if (req.user.role !== 'student') {
    throw new ApiError(403, 'Only students can start conversations');
  }
  if (tutor_id === req.user.id) throw new ApiError(400, 'You cannot message yourself');
  const tutor = await tutorModel.findProfileByUserId(tutor_id);
  if (!tutor) throw new ApiError(404, 'Tutor not found');
  if (!(await subjectModel.findById(subject_id))) throw new ApiError(404, 'Subject not found');

  const conversation = await conversationModel.findOrCreate({
    studentId: req.user.id,
    tutorId: tutor_id,
    subjectId: subject_id
  });
  log(req, 'conversation.start', 'conversation', conversation.id);
  ok(res, 201, await conversationModel.findById(conversation.id), 'Conversation ready');
});

/** GET /api/conversations/:id — single conversation (participants only). */
const getOne = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await conversationModel.isParticipant(id, req.user.id))) {
    throw new ApiError(403, 'You are not part of this conversation');
  }
  ok(res, 200, await conversationModel.findById(id));
});

module.exports = { listMine, start, getOne };