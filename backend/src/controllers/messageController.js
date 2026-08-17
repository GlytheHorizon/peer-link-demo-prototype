const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const conversationModel = require('../models/conversationModel');
const messageModel = require('../models/messageModel');
const log = require('../services/activityLogService').log;

/** GET /api/conversations/:id/messages — participant only; marks received as read. */
const listMessages = asyncHandler(async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!(await conversationModel.isParticipant(conversationId, req.user.id))) {
    throw new ApiError(403, 'You are not part of this conversation');
  }
  await messageModel.markConversationRead(conversationId, req.user.id);
  ok(res, 200, await messageModel.listByConversation(conversationId));
});

/** POST /api/conversations/:id/messages — participant only. */
const sendMessage = asyncHandler(async (req, res) => {
  const conversationId = Number(req.params.id);
  const { body } = req.body;
  validate({ body: [v.required('body'), v.maxLen(5000)] }, req.body);
  if (!(await conversationModel.isParticipant(conversationId, req.user.id))) {
    throw new ApiError(403, 'You are not part of this conversation');
  }
  const messageId = await messageModel.create({ conversationId, senderId: req.user.id, body: body.trim() });
  const messages = await messageModel.listByConversation(conversationId);
  const created = messages.find((m) => m.id === messageId);
  log(req, 'message.send', 'message', messageId, { conversation_id: conversationId });
  ok(res, 201, created, 'Message sent');
});

/** GET /api/messages/unread-count */
const unreadCount = asyncHandler(async (req, res) => {
  ok(res, 200, { unread: await messageModel.countUnreadForUser(req.user.id) });
});

/** DELETE /api/conversations/:id/messages/:messageId — sender unsends a message. */
const deleteMessage = asyncHandler(async (req, res) => {
  const conversationId = Number(req.params.id);
  const messageId = Number(req.params.messageId);
  if (!Number.isInteger(messageId) || messageId < 1) {
    throw new ApiError(400, 'Validation failed', ['messageId: must be a positive integer']);
  }
  const message = await messageModel.findById(messageId);
  if (!message || message.conversation_id !== conversationId) {
    throw new ApiError(404, 'Message not found');
  }
  if (message.sender_id !== req.user.id) {
    throw new ApiError(403, 'You can only unsend your own messages');
  }
  await messageModel.remove(messageId);
  log(req, 'message.delete', 'message', messageId, { conversation_id: conversationId });
  ok(res, 200, { id: messageId }, 'Message deleted');
});

module.exports = { listMessages, sendMessage, deleteMessage, unreadCount };