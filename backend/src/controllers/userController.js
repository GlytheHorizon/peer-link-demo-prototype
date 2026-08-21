const bcrypt = require('bcryptjs');
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

/** PATCH /api/users/me/name — change display name (max 2 times per month). */
const changeName = asyncHandler(async (req, res) => {
  const { first_name, last_name } = req.body;
  validate({
    first_name: [v.required('first_name'), v.maxLen(100)],
    last_name:  [v.required('last_name'),  v.maxLen(100)]
  }, req.body);
  const result = await userModel.changeName(req.user.id, first_name.trim(), last_name.trim());
  if (!result.ok) throw new ApiError(429, result.message);
  const updated = await userModel.findById(req.user.id);
  log(req, 'users.change_name', 'user', req.user.id);
  ok(res, 200, updated, `Name updated (${result.changesUsed}/2 changes this month)`);
});

/** PATCH /api/users/me/email — change email address. */
const changeEmail = asyncHandler(async (req, res) => {
  const { current_email, new_email, confirm_new_email } = req.body;
  if (!current_email || !new_email || !confirm_new_email) throw new ApiError(400, 'All email fields are required');
  const user = await userModel.findByEmail(current_email.trim().toLowerCase());
  if (!user || user.id !== req.user.id) throw new ApiError(400, 'Current email does not match your account');
  if (new_email.trim().toLowerCase() !== confirm_new_email.trim().toLowerCase()) throw new ApiError(400, 'New email and confirmation do not match');
  const result = await userModel.changeEmail(req.user.id, new_email.trim().toLowerCase());
  if (!result.ok) throw new ApiError(400, result.message);
  const updated = await userModel.findById(req.user.id);
  log(req, 'users.change_email', 'user', req.user.id);
  ok(res, 200, updated, 'Email updated successfully');
});

/** PATCH /api/users/me/password — change own password. */
const changeUserPassword = asyncHandler(async (req, res) => {
  const { current_password, new_password, confirm_new_password } = req.body;
  if (!current_password || !new_password || !confirm_new_password) throw new ApiError(400, 'All password fields are required');
  if (new_password.length < 8) throw new ApiError(400, 'New password must be at least 8 characters');
  if (new_password !== confirm_new_password) throw new ApiError(400, 'New passwords do not match');
  const userRow = await userModel.findByEmail(req.user.email);
  const match = await bcrypt.compare(current_password, userRow.password_hash);
  if (!match) throw new ApiError(401, 'Current password is incorrect');
  const newHash = await bcrypt.hash(new_password, 10);
  await userModel.changePassword(req.user.id, newHash);
  log(req, 'users.change_password', 'user', req.user.id);
  ok(res, 200, null, 'Password changed successfully');
});

module.exports = { getMe, updateMe, heartbeat, listUsers, getUser, getWarnings, acknowledgeWarning, changeName, changeEmail, changeUserPassword };