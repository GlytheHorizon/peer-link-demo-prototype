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

/** GET /api/users/:id — view a user (faculty + admin). */
const getUser = asyncHandler(async (req, res) => {
  const user = await userModel.findById(Number(req.params.id));
  if (!user) throw new ApiError(404, 'User not found');
  ok(res, 200, user);
});

module.exports = { getMe, updateMe, listUsers, getUser };