const { asyncHandler, ok } = require('../utils/http');
const { query } = require('../config/db');
const log = require('../services/activityLogService').log;

/** GET /api/reports/overview — headline metrics. Faculty + admin. */
const overview = asyncHandler(async (req, res) => {
  const [users, byRole, sessions, byStatus, evaluations, matches, completedLast30] = await Promise.all([
    query('SELECT COUNT(*) AS total FROM users WHERE is_active = TRUE'),
    query('SELECT role, COUNT(*) AS total FROM users WHERE is_active = TRUE GROUP BY role'),
    query('SELECT COUNT(*) AS total FROM sessions'),
    query('SELECT status, COUNT(*) AS total FROM sessions GROUP BY status'),
    query('SELECT COUNT(*) AS total, ROUND(AVG(rating), 2) AS avg_rating FROM evaluations'),
    query('SELECT COUNT(*) AS total FROM matches'),
    query("SELECT COUNT(*) AS total FROM sessions WHERE status = 'completed' AND created_at >= now() - INTERVAL '30 days'")
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
              SUM((s.status = 'completed')::int) AS completed,
              SUM((s.status = 'pending')::int) AS pending
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

module.exports = { overview, sessionsReport, tutorsReport, studentsReport };