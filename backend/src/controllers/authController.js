const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ApiError, asyncHandler, ok } = require('../utils/http');
const { signToken } = require('../utils/jwt');
const { validate, v } = require('../validators/validate');
const userModel = require('../models/userModel');
const studentModel = require('../models/studentModel');
const tutorModel = require('../models/tutorModel');
const appModel = require('../models/tutorApplicationModel');
const { withTransaction, query } = require('../config/db');
const log = require('../services/activityLogService').log;
const { sendPasswordResetEmail } = require('../services/emailService');

const ROLE_LABELS = { student: 'Student', tutor: 'Tutor', faculty: 'Faculty', admin: 'Administrator' };
const RESET_TOKEN_EXPIRY_MINUTES = 10;

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
    const profile = await tutorModel.findProfileByUserId(user.id);
    let status = profile ? profile.verification_status : null;

    if (status !== 'approved') {
      const app = await appModel.findByEmail(user.email);
      if (app && app.status === 'approved') {
        status = 'approved';
        if (profile && profile.verification_status !== 'approved') {
          await tutorModel.updateProfile(user.id, { verification_status: 'approved' });
        }
      }
    }

    base.verification_status = status || 'pending';
  }
  return base;
}

/** POST /api/auth/register */
const register = asyncHandler(async (req, res) => {
  const {
    email, password, first_name, last_name, year_level, course,
    age, grade_level, school, strand, subjects_needed,
    learning_mode, preferred_schedule, preferred_time
  } = req.body;
  req.body.strand = req.body.strand === 'JHS (Grade 7-10)' ? 'JHS' : req.body.strand;
  validate({
    email: [v.required('email'), v.email()],
    password: [v.required('password'), v.minLen(8, 'min 8 characters')],
    first_name: [v.required('first_name'), v.maxLen(100)],
    last_name: [v.required('last_name'), v.maxLen(100)],
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
  const role = 'student';
  const userId = await withTransaction(async (conn) => {
    const uid = await userModel.create({ email, password_hash: passwordHash, first_name, last_name, role }, conn);
    await studentModel.createProfile({
      userId: uid, year_level, course,
      age, grade_level, school, strand, subjects_needed,
      learning_mode, preferred_schedule, preferred_time
    }, conn);
    return uid;
  });

  log(req, 'auth.register', 'user', userId, { role }, userId);
  const token = signToken({ sub: String(userId), role });
  ok(res, 201, { token, user: { id: userId, email, first_name, last_name, role: ROLE_LABELS[role], role_key: role } }, 'Registration successful');
});

async function checkUserAccountStatus(user) {
  if (user.is_banned) {
    throw new ApiError(403, `Your account has been permanently banned. Reason: ${user.ban_reason || 'Violation of rules.'}`);
  }
  if (user.suspended_until) {
    const suspendedUntil = new Date(user.suspended_until);
    if (suspendedUntil > new Date()) {
      const formattedEndDate = suspendedUntil.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      throw new ApiError(403, `Your account has been suspended until ${formattedEndDate}. Reason: ${user.suspension_reason || 'Violation of rules.'}`);
    } else {
      await userModel.clearSuspension(user.id);
      user.is_active = true;
      user.suspended_until = null;
      user.suspension_reason = null;
    }
  }
  if (!user.is_active) {
    throw new ApiError(403, 'This account has been deactivated. Contact an administrator.');
  }
}

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
  await checkUserAccountStatus(user);

  log(req, 'auth.login', 'user', user.id, null, user.id);
  const token = signToken({ sub: String(user.id), role: user.role });
  const userWithVerification = await withVerification(user);
  ok(res, 200, {
    token,
    user: userWithVerification
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
  await checkUserAccountStatus(user);

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
  const userWithVerification = await withVerification(req.user);
  ok(res, 200, userWithVerification);
});

/** GET /api/auth/email-exists — used by registration to block existing emails early. */
const emailExists = asyncHandler(async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  validate({ email: [v.required('email'), v.email()] }, { email });
  const user = await userModel.findByEmail(email);
  ok(res, 200, { exists: Boolean(user) });
});

/** POST /api/auth/forgot-password — sends a password reset email if the email exists. */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  validate({ email: [v.required('email'), v.email()] }, req.body);

  const user = await userModel.findByEmail(email.trim().toLowerCase());
  // Always return success to prevent email enumeration
  if (!user) {
    ok(res, 200, null, 'If an account with that email exists, a password reset link has been sent.');
    return;
  }

  // Generate secure token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

  // Store token hash in database
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
    [user.id, tokenHash, expiresAt]
  );

  // Build reset URL
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;

  // Send email
  const emailResult = await sendPasswordResetEmail({
    email: user.email,
    firstName: user.first_name,
    resetUrl,
    expiresMinutes: RESET_TOKEN_EXPIRY_MINUTES
  });

  if (!emailResult.success && !emailResult.dev) {
    console.error('[auth] Failed to send reset email:', emailResult.error);
    // Don't expose email failures to the user
  }

  log(req, 'auth.forgot_password', 'user', user.id, { email: user.email }, user.id);
  ok(res, 200, null, 'If an account with that email exists, a password reset link has been sent.');
});

/** POST /api/auth/reset-password — validates token and resets password. */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  validate({
    token: [v.required('token')],
    password: [v.required('password'), v.minLen(8, 'min 8 characters')]
  }, req.body);

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Find valid, unused token
  const rows = await query(
    `SELECT prt.*, u.email, u.first_name, u.last_name, u.password_hash
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = ? AND prt.used_at IS NULL AND prt.expires_at > now()`,
    [tokenHash]
  );

  if (!rows.length) {
    throw new ApiError(400, 'Invalid or expired reset token. Please request a new one.');
  }

  const resetToken = rows[0];

  // Check if password is same as current
  const samePassword = await bcrypt.compare(password, resetToken.password_hash);
  if (samePassword) {
    throw new ApiError(400, 'New password must be different from your current password.');
  }

  // Hash new password
  const newHash = await bcrypt.hash(password, 10);

  // Update password and mark token as used
  await withTransaction(async (conn) => {
    await userModel.changePassword(resetToken.user_id, newHash, conn);
    await query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE id = ?`,
      [resetToken.id],
      conn
    );
  });

  log(req, 'auth.reset_password', 'user', resetToken.user_id, { email: resetToken.email }, resetToken.user_id);
  ok(res, 200, null, 'Password has been reset successfully. You can now log in with your new password.');
});

module.exports = { register, login, adminLogin, logout, me, emailExists, forgotPassword, resetPassword, ROLE_LABELS };