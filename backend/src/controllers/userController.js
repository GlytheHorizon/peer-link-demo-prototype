const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const userModel = require('../models/userModel');
const log = require('../services/activityLogService').log;

/** GET /api/users/me */
const getMe = asyncHandler(async (req, res) => {
  ok(res, 200, userModel.findById ? await userModel.findById(req.user.id) : req.user);
});

/** PUT /api/users/me — update own basic profile (name). */
const updateMe = asyncHandler(async (req, res) => {
  const { first_name, last_name } = req.body;
  validate({
    first_name: [v.required('first_name'), v.maxLen(100)],
    last_name: [v.required('last_name'), v.maxLen(100)]
  }, req.body);
  await userModel.update(req.user.id, { first_name, last_name });
  log(req, 'users.update_self', 'user', req.user.id);
  ok(res, 200, await userModel.findById(req.user.id), 'Profile updated');
});

/** GET /api/users — list users (faculty + admin). */
const listUsers = asyncHandler(async (req, res) => {
  const { role, search, page, limit } = req.query;
  const data = await userModel.list({ role, search, page: Number(page) || 1, limit: Math.min(Number(limit) || 50, 100) });
  ok(res, 200, data);
});

/** POST /api/users/heartbeat — presence ping while the app is open. */
const heartbeat = asyncHandler(async (req, res) => {
  await userModel.touchLastSeen(req.user.id);
  ok(res, 200, { last_seen_at: new Date().toISOString() });
});

/** GET /api/users/:id — view a user (faculty + admin). */
const getUser = asyncHandler(async (req, res) => {
  const user = await userModel.findById(Number(req.params.id));
  if (!user) throw new ApiError(404, 'User not found');
  ok(res, 200, user);
});

/** GET /api/users/me/warnings/unacknowledged — fetch unacknowledged warnings for current user. */
const getWarnings = asyncHandler(async (req, res) => {
  const warnings = await userModel.getUnacknowledgedWarnings(req.user.id);
  ok(res, 200, warnings);
});

/** POST /api/users/warnings/:id/acknowledge — acknowledge a specific warning. */
const acknowledgeWarning = asyncHandler(async (req, res) => {
  const warningId = Number(req.params.id);
  const success = await userModel.acknowledgeWarning({ warningId, userId: req.user.id });
  if (!success) throw new ApiError(404, 'Warning not found or already acknowledged');
  log(req, 'users.acknowledge_warning', 'user_warning', warningId);
  ok(res, 200, null, 'Warning acknowledged');
});

module.exports = { getMe, updateMe, heartbeat, listUsers, getUser, getWarnings, acknowledgeWarning };