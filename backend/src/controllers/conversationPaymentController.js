const { ApiError, asyncHandler, ok } = require('../utils/http');
const conversationModel = require('../models/conversationModel');
const paymentModel = require('../models/conversationPaymentModel');

/** Loads the conversation and asserts the user is a participant. */
async function participant(conversationId, userId) {
  const conv = await conversationModel.findById(conversationId);
  if (!conv) throw new ApiError(404, 'Conversation not found');
  if (conv.student_id !== userId && conv.tutor_id !== userId) {
    throw new ApiError(403, 'You are not part of this conversation');
  }
  return conv;
}

/** POST /api/conversations/:id/payments — the student sends proof of payment. */
const createPayment = asyncHandler(async (req, res) => {
  const conv = await participant(Number(req.params.id), req.user.id);
  if (conv.student_id !== req.user.id) {
    throw new ApiError(403, 'Only the student can send a payment in this conversation');
  }
  const { amount, reference } = req.body;
  const cleanAmount = amount === undefined || amount === null || amount === '' ? null : Number(amount);
  if (cleanAmount !== null && (!Number.isFinite(cleanAmount) || cleanAmount <= 0)) {
    throw new ApiError(400, 'Validation failed', ['amount: must be a positive number']);
  }
  if (reference !== undefined && reference !== null && String(reference).trim().length > 150) {
    throw new ApiError(400, 'Validation failed', ['reference: must be at most 150 characters']);
  }
  if (await paymentModel.hasPending(conv.id)) {
    throw new ApiError(409, 'You already have a pending payment in this conversation — wait for the tutor to confirm it');
  }
  const payment = await paymentModel.create({
    conversationId: conv.id,
    studentId: req.user.id,
    tutorId: conv.tutor_id,
    amount: cleanAmount,
    reference: reference && String(reference).trim() ? String(reference).trim() : null
  });
  ok(res, 201, payment, 'Payment sent — waiting for the tutor to confirm');
});

/** GET /api/conversations/:id/payments — payment history for the chat. */
const listPayments = asyncHandler(async (req, res) => {
  await participant(Number(req.params.id), req.user.id);
  ok(res, 200, await paymentModel.listByConversation(Number(req.params.id)));
});

/** Loads the conversation and asserts the user is the tutor. */
async function tutorGate(conversationId, userId) {
  const conv = await participant(conversationId, userId);
  if (conv.tutor_id !== userId) throw new ApiError(403, 'Only the tutor can confirm payments');
  return conv;
}

async function pendingPayment(conversationId, paymentId) {
  const payment = await paymentModel.findById(paymentId);
  if (!payment || payment.conversation_id !== Number(conversationId)) {
    throw new ApiError(404, 'Payment not found in this conversation');
  }
  if (payment.status !== 'pending') {
    throw new ApiError(400, `This payment was already ${payment.status}`);
  }
  return payment;
}

/** POST /api/conversations/:id/payments/:pid/accept — tutor clears the payment. */
const acceptPayment = asyncHandler(async (req, res) => {
  await tutorGate(Number(req.params.id), req.user.id);
  const payment = await pendingPayment(req.params.id, Number(req.params.pid));
  await paymentModel.setStatus(payment.id, 'accepted');
  ok(res, 200, await paymentModel.findById(payment.id), 'Payment confirmed — clearance complete');
});

/** POST /api/conversations/:id/payments/:pid/reject — tutor rejects; student can repay. */
const rejectPayment = asyncHandler(async (req, res) => {
  await tutorGate(Number(req.params.id), req.user.id);
  const payment = await pendingPayment(req.params.id, Number(req.params.pid));
  const { reason } = req.body || {};
  const cleanReason = reason && String(reason).trim() ? String(reason).trim().slice(0, 300) : null;
  await paymentModel.setStatus(payment.id, 'rejected', cleanReason);
  ok(res, 200, await paymentModel.findById(payment.id), 'Payment rejected — the student can send a new one');
});

module.exports = { createPayment, listPayments, acceptPayment, rejectPayment };