const { asyncHandler, ok, ApiError } = require('../utils/http');
const { query } = require('../config/db');
const log = require('../services/activityLogService').log;
const userModel = require('../models/userModel');

/** GET /api/reports/overview — headline metrics. Faculty + admin. */
const overview = asyncHandler(async (req, res) => {
  const [users, byRole, sessions, byStatus, evaluations, matches, completedLast30] = await Promise.all([
    query('SELECT COUNT(*) AS total FROM users WHERE is_active = TRUE'),
    query('SELECT role, COUNT(*) AS total FROM users WHERE is_active = TRUE GROUP BY role'),
    query('SELECT COUNT(*) AS total FROM sessions'),
    query('SELECT status, COUNT(*) AS total FROM sessions GROUP BY status'),
    query('SELECT COUNT(*) AS total, ROUND(AVG(rating), 2) AS avg_rating FROM evaluations'),
    query('SELECT COUNT(*) AS total FROM matches'),
    query("SELECT COUNT(*) AS total FROM sessions WHERE status = 'completed' AND created_at >= NOW() - INTERVAL 30 DAY")
  ]);
  log(req, 'report.overview', 'report');
  ok(res, 200, {
    users: users[0].total,
    users_by_role: byRole,
    sessions: sessions[0].total,
    sessions_by_status: byStatus,
    evaluations: evaluations[0].total,
    avg_rating: Number(evaluations[0].avg_rating || 0),
    matches: matches[0].total,
    completed_last_30_days: completedLast30[0].total
  });
});

/** GET /api/reports/sessions — sessions grouped by subject and per-tutor completion. */
const sessionsReport = asyncHandler(async (req, res) => {
  const [bySubject, perTutor] = await Promise.all([
    query(
      `SELECT sub.code, sub.name, s.status, COUNT(*) AS total
       FROM sessions s JOIN subjects sub ON sub.id = s.subject_id
       GROUP BY sub.id, s.status ORDER BY sub.name, s.status`
    ),
    query(
      `SELECT u.id AS tutor_id, CONCAT(u.first_name, ' ', u.last_name) AS tutor_name,
              COUNT(s.id) AS total_sessions,
              SUM(s.status = 'completed') AS completed,
              SUM(s.status = 'pending') AS pending
       FROM users u
       LEFT JOIN sessions s ON s.tutor_id = u.id
       WHERE u.role = 'tutor'
       GROUP BY u.id ORDER BY total_sessions DESC`
    )
  ]);
  log(req, 'report.sessions', 'report');
  ok(res, 200, { by_subject: bySubject, per_tutor: perTutor });
});

/** GET /api/reports/tutors — tutor performance with ratings. */
const tutorsReport = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT u.id AS tutor_id, CONCAT(u.first_name, ' ', u.last_name) AS tutor_name,
            u.email, tp.course, tp.max_year_level,
            (SELECT COUNT(*) FROM tutor_subjects ts WHERE ts.tutor_profile_id = tp.id) AS subject_count,
            COUNT(DISTINCT s.id) AS session_count,
            ROUND(AVG(e.rating), 2) AS avg_rating,
            COUNT(DISTINCT e.id) AS rating_count
     FROM users u
     JOIN tutor_profiles tp ON tp.user_id = u.id
     LEFT JOIN sessions s ON s.tutor_id = u.id
     LEFT JOIN evaluations e ON e.tutor_id = u.id
     WHERE u.role = 'tutor'
     GROUP BY u.id, tp.id
     ORDER BY avg_rating DESC, session_count DESC`
  );
  log(req, 'report.tutors', 'report');
  ok(res, 200, rows);
});

/** GET /api/reports/students — student activity. */
const studentsReport = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT u.id AS student_id, CONCAT(u.first_name, ' ', u.last_name) AS student_name,
            u.email, sp.year_level, sp.course,
            (SELECT COUNT(*) FROM student_subjects ss WHERE ss.student_profile_id = sp.id) AS subject_count,
            COUNT(DISTINCT s.id) AS session_count,
            COUNT(DISTINCT e.id) AS evaluations_given
     FROM users u
     JOIN student_profiles sp ON sp.user_id = u.id
     LEFT JOIN sessions s ON s.student_id = u.id
     LEFT JOIN evaluations e ON e.student_id = u.id
     WHERE u.role = 'student'
     GROUP BY u.id, sp.id
     ORDER BY session_count DESC`
  );
  log(req, 'report.students', 'report');
  ok(res, 200, rows);
});

/** POST /api/reports/user — student/tutor submits a report on another user. */
const createUserReport = asyncHandler(async (req, res) => {
  const { reported_id, reason, session_id, details } = req.body;
  const reporter_id = req.user.id;

  if (!reported_id || !reason) {
    return res.status(400).json({ message: 'Reported user and reason are required' });
  }

  if (reporter_id === Number(reported_id)) {
    return res.status(400).json({ message: 'You cannot report yourself' });
  }

  const reportedUsers = await query('SELECT id FROM users WHERE id = ?', [reported_id]);
  if (!reportedUsers.length) {
    return res.status(404).json({ message: 'Reported user not found' });
  }

  let sessionId = null;
  if (session_id) {
    const sessions = await query('SELECT id FROM sessions WHERE id = ?', [session_id]);
    if (!sessions.length) {
      return res.status(404).json({ message: 'Session not found' });
    }
    sessionId = session_id;
  }

  const result = await query(
    `INSERT INTO user_reports (reporter_id, reported_id, reason, session_id, details)
     VALUES (?, ?, ?, ?, ?)`,
    [reporter_id, reported_id, reason, sessionId, details || null]
  );

  const reportId = result.insertId;
  log(req, 'report.create_user', 'user_report', reportId, { report_id: reportId });
  ok(res, 201, { id: reportId, reporter_id, reported_id, reason, session_id: sessionId, details });
});

/** GET /api/reports/user — admin lists all user reports. */
const listUserReports = asyncHandler(async (req, res) => {
  const { status } = req.query;
  let where = '';
  const params = [];
  if (status) {
    where = 'WHERE ur.status = ?';
    params.push(status);
  }

  const reports = await query(
    `SELECT ur.*, 
            CONCAT(r.first_name, ' ', r.last_name) AS reporter_name,
            r.role AS reporter_role,
            CONCAT(rep.first_name, ' ', rep.last_name) AS reported_name,
            rep.role AS reported_role,
            s.topic AS session_topic,
            s.scheduled_start AS session_start
     FROM user_reports ur
     JOIN users r ON r.id = ur.reporter_id
     JOIN users rep ON rep.id = ur.reported_id
     LEFT JOIN sessions s ON s.id = ur.session_id
     ${where}
     ORDER BY ur.created_at DESC`,
    params
  );

  log(req, 'report.list_user', 'user_report');
  ok(res, 200, reports);
});

/** PATCH /api/reports/user/:id — admin resolves a user report. */
const resolveUserReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, reason, duration_days, end_date } = req.body;

  const validActions = ['dismiss', 'warn', 'suspend', 'ban'];
  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ message: 'Invalid action' });
  }

  const rows = await query('SELECT * FROM user_reports WHERE id = ?', [id]);
  if (!rows.length) {
    return res.status(404).json({ message: 'Report not found' });
  }
  const report = rows[0];

  if (report.status === 'resolved') {
    return res.status(400).json({ message: 'Report already resolved' });
  }

  const actionReason = (reason && reason.trim()) ? reason.trim() : `Report resolution: ${report.reason}`;

  if (action === 'warn') {
    await userModel.warnUser({ userId: report.reported_id, adminId: req.user.id, reason: actionReason });
  } else if (action === 'suspend') {
    let suspendedUntil;
    if (end_date) {
      suspendedUntil = new Date(end_date);
    } else if (duration_days) {
      suspendedUntil = new Date(Date.now() + Number(duration_days) * 24 * 60 * 60 * 1000);
    } else {
      suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days if unspecified
    }
    await userModel.suspendUser({ userId: report.reported_id, suspendedUntil, reason: actionReason });
  } else if (action === 'ban') {
    await userModel.banUser({ userId: report.reported_id, reason: actionReason });
  }

  await query(
    `UPDATE user_reports SET status = 'resolved', action_taken = ?, resolved_at = NOW() WHERE id = ?`,
    [action, id]
  );

  log(req, 'report.resolve_user', 'user_report', id, { report_id: id, action, reason: actionReason });
  ok(res, 200, { message: `Report resolved — ${action}` });
});

module.exports = { overview, sessionsReport, tutorsReport, studentsReport, createUserReport, listUserReports, resolveUserReport };