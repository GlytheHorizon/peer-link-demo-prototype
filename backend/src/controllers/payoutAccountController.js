const { ApiError, asyncHandler, ok } = require('../utils/http');
const payoutAccountModel = require('../models/payoutAccountModel');

/** Strips spaces/dashes and keeps digits only. */
const cleanAccountNumber = (value) => String(value == null ? '' : value).replace(/[\s-]/g, '');

/**
 * GET /api/stripe/payout-account
 * The signed-in tutor's saved payout account (masked).
 */
const getAccount = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tutor') throw new ApiError(403, 'Only tutors have a payout account');
  ok(res, 200, await payoutAccountModel.findByUser(req.user.id), 'Payout account');
});

/**
 * PUT /api/stripe/payout-account
 * Create or update the payout account number.
 * Body: { account_number, account_name }
 */
const saveAccount = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tutor') throw new ApiError(403, 'Only tutors have a payout account');

  const { account_number: accountNumber, account_name: accountName } = req.body || {};
  const cleaned = cleanAccountNumber(accountNumber);

  if (!/^\d{6,24}$/.test(cleaned)) {
    throw new ApiError(400, 'Validation failed', [
      'account_number: use 6 to 24 digits (spaces and dashes are allowed)'
    ]);
  }
  if (accountName != null && String(accountName).trim().length > 120) {
    throw new ApiError(400, 'Validation failed', ['account_name: must be at most 120 characters']);
  }

  const saved = await payoutAccountModel.upsert(req.user.id, {
    accountNumber: cleaned,
    accountName: accountName && String(accountName).trim() ? String(accountName).trim() : null
  });

  ok(res, 200, saved, 'Payout account saved');
});

/**
 * DELETE /api/stripe/payout-account
 * Removes the saved payout account.
 */
const deleteAccount = asyncHandler(async (req, res) => {
  if (req.user.role !== 'tutor') throw new ApiError(403, 'Only tutors have a payout account');
  ok(res, 200, await payoutAccountModel.remove(req.user.id), 'Payout account removed');
});

module.exports = { getAccount, saveAccount, deleteAccount };
