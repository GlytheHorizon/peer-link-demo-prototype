const { query } = require('../config/db');

async function create({ sessionId, studentId, tutorId, rating, comment }) {
  const result = await query(
    'INSERT INTO evaluations (session_id, student_id, tutor_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
    [sessionId, studentId, tutorId, rating, comment || null]
  );
  return result.insertId;
}

async function findBySession(sessionId) {
  const rows = await query(
    `SELECT e.*, CONCAT(u.first_name, ' ', u.last_name) AS student_name
     FROM evaluations e
     JOIN users u ON u.id = e.student_id
     WHERE e.session_id = ?`,
    [sessionId]
  );
  return rows[0] || null;
}

async function listReceivedByTutor(tutorId) {
  return query(
    `SELECT e.*, s.subject_id, sub.code AS subject_code, sub.name AS subject_name,
            CONCAT(u.first_name, ' ', u.last_name) AS student_name,
            s.scheduled_start
     FROM evaluations e
     JOIN sessions s ON s.id = e.session_id
     JOIN subjects sub ON sub.id = s.subject_id
     JOIN users u ON u.id = e.student_id
     WHERE e.tutor_id = ?
     ORDER BY e.created_at DESC`,
    [tutorId]
  );
}

async function listGivenByStudent(studentId) {
  return query(
    `SELECT e.*, sub.code AS subject_code, sub.name AS subject_name,
            CONCAT(u.first_name, ' ', u.last_name) AS tutor_name,
            s.scheduled_start
     FROM evaluations e
     JOIN sessions s ON s.id = e.session_id
     JOIN subjects sub ON sub.id = s.subject_id
     JOIN users u ON u.id = e.tutor_id
     WHERE e.student_id = ?
     ORDER BY e.created_at DESC`,
    [studentId]
  );
}

/** Average rating + count per tutor, keyed by tutor user id. */
async function ratingSummaryByTutor() {
  return query(
    `SELECT tutor_id AS user_id, ROUND(AVG(rating), 2) AS avg_rating, COUNT(*) AS rating_count
     FROM evaluations
     GROUP BY tutor_id`
  );
}

async function listAll() {
  return query(
    `SELECT e.*, sub.name AS subject_name,
            CONCAT(ts.first_name, ' ', ts.last_name) AS tutor_name,
            CONCAT(su.first_name, ' ', su.last_name) AS student_name
     FROM evaluations e
     JOIN subjects sub ON sub.id = (SELECT s.subject_id FROM sessions s WHERE s.id = e.session_id)
     JOIN users ts ON ts.id = e.tutor_id
     JOIN users su ON su.id = e.student_id
     ORDER BY e.created_at DESC`
  );
}

module.exports = { create, findBySession, listReceivedByTutor, listGivenByStudent, ratingSummaryByTutor, listAll };