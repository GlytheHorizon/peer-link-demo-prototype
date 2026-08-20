const bcrypt = require('bcryptjs');
const { ApiError, asyncHandler, ok } = require('../utils/http');
const { signToken } = require('../utils/jwt');
const { validate, v } = require('../validators/validate');
const userModel = require('../models/userModel');
const studentModel = require('../models/studentModel');
const tutorModel = require('../models/tutorModel');
const appModel = require('../models/tutorApplicationModel');
const { withTransaction, query } = require('../config/db');
const log = require('../services/activityLogService').log;

const ROLE_LABELS = { student: 'Student', tutor: 'Tutor', faculty: 'Faculty', admin: 'Administrator' };

/** Adds the tutor verification status (approved/pending/rejected/null) to a user object. */
async function withVerification(user) {
  const base = {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: ROLE_LABELS[user.role] || user.role,
    role_key: user.role
  };
  if (user.role === 'tutor') {
    const app = await appModel.findByEmail(user.email);
    base.verification_status = app ? app.status : null;
  }
  return base;
}

/** POST /api/auth/register */
const register = asyncHandler(async (req, res) => {
  const {
    email, password, first_name, last_name, role, year_level, course,
    age, grade_level, school, strand, subjects_needed, subjects_teach,
    learning_mode, preferred_schedule, preferred_time
  } = req.body;
  req.body.strand = req.body.strand === 'JHS (Grade 7-10)' ? 'JHS' : req.body.strand;
  validate({
    email: [v.required('email'), v.email()],
    password: [v.required('password'), v.minLen(8, 'min 8 characters')],
    first_name: [v.required('first_name'), v.maxLen(100)],
    last_name: [v.required('last_name'), v.maxLen(100)],
    role: [v.required('role'), v.isIn(['student', 'tutor'])],
    age: [v.intRange(10, 100, 'age')],
    grade_level: [v.maxLen(50)],
    school: [v.maxLen(150)],
    strand: [v.isIn(['STEM', 'GAS', 'ICT', 'ABM', 'HUMSS', 'JHS'])],
    learning_mode: [v.isIn(['online', 'face-to-face', 'both'])],
    preferred_time: [v.maxLen(60)]
  }, req.body);

  if (await userModel.findByEmail(email)) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await withTransaction(async (conn) => {
    const uid = await userModel.create({ email, password_hash: passwordHash, first_name, last_name, role }, conn);
    if (role === 'student') {
      await studentModel.createProfile({
        userId: uid, year_level, course,
        age, grade_level, school, strand, subjects_needed,
        learning_mode, preferred_schedule, preferred_time
      }, conn);
    } else {
      await tutorModel.createProfile({
        userId: uid, course,
        age, grade_level, school, strand, subjects_teach,
        learning_mode, preferred_schedule, preferred_time
      }, conn);
    }
    return uid;
  });

  log(req, 'auth.register', 'user', userId, { role }, userId);
  const token = signToken({ sub: String(userId), role });
  ok(res, 201, { token, user: { id: userId, email, first_name, last_name, role: ROLE_LABELS[role], role_key: role } }, 'Registration successful');
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  validate({
    email: [v.required('email'), v.email()],
    password: [v.required('password')]
  }, req.body);

  const user = await userModel.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (user.role === 'admin') {
    throw new ApiError(403, 'Admins must sign in through the admin portal.');
  }
  if (!user.is_active) {
    throw new ApiError(403, 'This account has been deactivated. Contact an administrator.');
  }

  log(req, 'auth.login', 'user', user.id, null, user.id);
  const token = signToken({ sub: String(user.id), role: user.role });
  ok(res, 200, {
    token,
    user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: ROLE_LABELS[user.role], role_key: user.role }
  }, 'Login successful');
});

/** POST /api/auth/admin-login — restricted to administrators. */
const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  validate({
    email: [v.required('email'), v.email()],
    password: [v.required('password')]
  }, req.body);

  const user = await userModel.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (user.role !== 'admin') {
    throw new ApiError(403, 'This portal is for administrators only');
  }
  if (!user.is_active) {
    throw new ApiError(403, 'This account has been deactivated. Contact an administrator.');
  }

  log(req, 'auth.login', 'user', user.id, null, user.id);
  const token = signToken({ sub: String(user.id), role: user.role });
  ok(res, 200, {
    token,
    user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: ROLE_LABELS[user.role], role_key: user.role }
  }, 'Login successful');
});

/** POST /api/auth/logout — stateless JWT, client discards the token. */
const logout = asyncHandler(async (req, res) => {
  log(req, 'auth.logout', 'user', req.user ? req.user.id : null, null, req.user ? req.user.id : null);
  ok(res, 200, null, 'Logged out successfully');
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  log(req, 'auth.me', 'user', req.user ? req.user.id : null, null, req.user ? req.user.id : null);
  ok(res, 200, {
    id: req.user.id,
    email: req.user.email,
    first_name: req.user.first_name,
    last_name: req.user.last_name,
    role: ROLE_LABELS[req.user.role],
    role_key: req.user.role
  });
});

/** GET /api/auth/email-exists — used by registration to block existing emails early. */
const emailExists = asyncHandler(async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  validate({ email: [v.required('email'), v.email()] }, { email });
  const user = await userModel.findByEmail(email);
  ok(res, 200, { exists: Boolean(user) });
});

module.exports = { register, login, adminLogin, logout, me, emailExists, ROLE_LABELS };