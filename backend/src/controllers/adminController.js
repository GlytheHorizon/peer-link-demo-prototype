const bcrypt = require('bcryptjs');
const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const userModel = require('../models/userModel');
const subjectModel = require('../models/subjectModel');
const sessionModel = require('../models/sessionModel');
const studentModel = require('../models/studentModel');
const tutorModel = require('../models/tutorModel');
const { withTransaction } = require('../config/db');
const log = require('../services/activityLogService').log;

/** GET /api/admin/users — list all users (admin only). */
const listUsers = asyncHandler(async (req, res) => {
  const { role, search, page, limit } = req.query;
  const data = await userModel.list({ role, search, page: Number(page) || 1, limit: Math.min(Number(limit) || 50, 100) });
  ok(res, 200, data);
});

/** POST /api/admin/users — create any user including faculty/admin (admin only). */
const createUser = asyncHandler(async (req, res) => {
  const { email, password, first_name, last_name, role, year_level, course } = req.body;
  validate({
    email: [v.required('email'), v.email()],
    password: [v.required('password'), v.minLen(8, 'min 8 characters')],
    first_name: [v.required('first_name'), v.maxLen(100)],
    last_name: [v.required('last_name'), v.maxLen(100)],
    role: [v.required('role'), v.isIn(['student', 'tutor', 'faculty', 'admin'])]
  }, req.body);

  if (await userModel.findByEmail(email)) throw new ApiError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await withTransaction(async (conn) => {
    const uid = await userModel.create({ email, password_hash: passwordHash, first_name, last_name, role }, conn);
    if (role === 'student') await studentModel.createProfile({ userId: uid, year_level, course }, conn);
    if (role === 'tutor') await tutorModel.createProfile({ userId: uid, course }, conn);
    return uid;
  });
  log(req, 'admin.user_create', 'user', userId, { role });
  ok(res, 201, await userModel.findById(userId), 'User created');
});

/** PATCH /api/admin/users/:id — deactivate/activate or update a user (admin only). */
const updateUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const user = await userModel.findById(id);
  if (!user) throw new ApiError(404, 'User not found');
  if (id === req.user.id) throw new ApiError(400, 'You cannot modify your own account here');

  const { is_active, first_name, last_name } = req.body;
  if (is_active !== undefined) {
    validate({ is_active: [v.bool('is_active')] }, req.body);
  }

  const updateFields = {};
  if (first_name !== undefined) updateFields.first_name = first_name;
  if (last_name !== undefined) updateFields.last_name = last_name;

  if (is_active !== undefined) {
    const isActiveBool = Boolean(is_active);
    updateFields.is_active = isActiveBool;
    // If activating the user, also lift any active suspension or ban
    if (isActiveBool) {
      updateFields.suspended_until = null;
      updateFields.suspension_reason = null;
      updateFields.is_banned = false;
      updateFields.ban_reason = null;
    }
  }

  await userModel.update(id, updateFields);
  log(req, 'admin.user_update', 'user', id, { is_active: updateFields.is_active });
  ok(res, 200, await userModel.findById(id), 'User updated');
});

/** DELETE /api/admin/users/:id — hard delete (admin only). */
const deleteUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const user = await userModel.findById(id);
  if (!user) throw new ApiError(404, 'User not found');
  if (id === req.user.id) throw new ApiError(400, 'You cannot delete your own account');
  const { query } = require('../config/db');
  await query('DELETE FROM users WHERE id = ?', [id]);
  log(req, 'admin.user_delete', 'user', id);
  ok(res, 200, null, 'User deleted');
});

/** GET /api/admin/subjects — subject management list with usage stats (admin only). */
const listSubjects = asyncHandler(async (req, res) => {
  const { query } = require('../config/db');
  const rows = await query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM student_subjects ss WHERE ss.subject_id = s.id) AS student_count,
            (SELECT COUNT(*) FROM tutor_subjects ts WHERE ts.subject_id = s.id) AS tutor_count,
            (SELECT COUNT(*) FROM sessions ses WHERE ses.subject_id = s.id) AS session_count
     FROM subjects s ORDER BY s.name`
  );
  ok(res, 200, rows);
});

/** GET /api/admin/sessions — monitor all sessions (admin only). */
const listSessions = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const { query } = require('../config/db');
  const where = [];
  const params = [];
  if (status) {
    where.push('s.status = ?');
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (Math.max(1, Number(page)) - 1) * Math.min(Number(limit), 100);
  const rows = await query(
    `SELECT s.id, s.status, s.learning_mode, s.scheduled_start, s.scheduled_end, s.topic, s.created_at,
            sub.code AS subject_code, sub.name AS subject_name,
            CONCAT(stu.first_name, ' ', stu.last_name) AS student_name,
            CONCAT(tut.first_name, ' ', tut.last_name) AS tutor_name
     FROM sessions s
     JOIN subjects sub ON sub.id = s.subject_id
     JOIN users stu ON stu.id = s.student_id
     JOIN users tut ON tut.id = s.tutor_id
     ${whereSql}
     ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Math.min(Number(limit), 100), offset]
  );
  const count = await query(`SELECT COUNT(*) AS total FROM sessions s ${whereSql}`, params);
  ok(res, 200, { rows, total: count[0].total });
});

/** GET /api/admin/stats — platform overview numbers (admin only). */
const stats = asyncHandler(async (req, res) => {
  const { query } = require('../config/db');
  const [users, subjects, sessions, evaluations, conversations, messages, logs, inactive] = await Promise.all([
    query('SELECT COUNT(*) AS total FROM users'),
    query('SELECT COUNT(*) AS total FROM subjects'),
    query('SELECT COUNT(*) AS total FROM sessions'),
    query('SELECT COUNT(*) AS total FROM evaluations'),
    query('SELECT COUNT(*) AS total FROM conversations'),
    query('SELECT COUNT(*) AS total FROM messages'),
    query('SELECT COUNT(*) AS total FROM activity_logs'),
    query('SELECT COUNT(*) AS total FROM users WHERE is_active = FALSE')
  ]);
  ok(res, 200, {
    users: users[0].total,
    subjects: subjects[0].total,
    sessions: sessions[0].total,
    evaluations: evaluations[0].total,
    conversations: conversations[0].total,
    messages: messages[0].total,
    activity_logs: logs[0].total,
    inactive_users: inactive[0].total
  });
});

/** POST /api/admin/users/:id/warn — issue warning to user (admin only). */
const warnUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body;
  validate({ reason: [v.required('reason')] }, req.body);

  const user = await userModel.findById(id);
  if (!user) throw new ApiError(404, 'User not found');
  if (id === req.user.id) throw new ApiError(400, 'You cannot warn yourself');

  const warningId = await userModel.warnUser({ userId: id, adminId: req.user.id, reason: reason.trim() });
  log(req, 'admin.user_warn', 'user', id, { reason });
  ok(res, 201, { id: warningId, user_id: id, reason: reason.trim() }, 'Warning issued successfully');
});

/** POST /api/admin/users/:id/suspend — suspend user account (admin only). */
const suspendUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { reason, duration_days, end_date } = req.body;
  validate({ reason: [v.required('reason')] }, req.body);

  const user = await userModel.findById(id);
  if (!user) throw new ApiError(404, 'User not found');
  if (id === req.user.id) throw new ApiError(400, 'You cannot suspend your own account');

  let suspendedUntil;
  if (end_date) {
    suspendedUntil = new Date(end_date);
  } else if (duration_days) {
    suspendedUntil = new Date(Date.now() + Number(duration_days) * 24 * 60 * 60 * 1000);
  } else {
    throw new ApiError(400, 'A suspension duration or end date is required');
  }

  if (isNaN(suspendedUntil.getTime()) || suspendedUntil <= new Date()) {
    throw new ApiError(400, 'Suspension end date must be a valid future date');
  }

  await userModel.suspendUser({ userId: id, suspendedUntil, reason: reason.trim() });
  log(req, 'admin.user_suspend', 'user', id, { reason, suspendedUntil });
  ok(res, 200, await userModel.findById(id), 'User account suspended');
});

/** POST /api/admin/users/:id/ban — permanently ban user account (admin only). */
const banUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body;
  validate({ reason: [v.required('reason')] }, req.body);

  const user = await userModel.findById(id);
  if (!user) throw new ApiError(404, 'User not found');
  if (id === req.user.id) throw new ApiError(400, 'You cannot ban your own account');

  await userModel.banUser({ userId: id, reason: reason.trim() });
  log(req, 'admin.user_ban', 'user', id, { reason });
  ok(res, 200, await userModel.findById(id), 'User account banned permanently');
});

module.exports = { listUsers, createUser, updateUser, deleteUser, listSubjects, listSessions, stats, warnUser, suspendUser, banUser };