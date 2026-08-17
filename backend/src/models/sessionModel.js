const { query } = require('../config/db');

const SESSION_SELECT = `
  SELECT s.*, sub.code AS subject_code, sub.name AS subject_name,
         CONCAT(stu.first_name, ' ', stu.last_name) AS student_name, stu.email AS student_email,
         CONCAT(tut.first_name, ' ', tut.last_name) AS tutor_name, tut.email AS tutor_email,
         e.id AS evaluation_id, e.rating AS evaluation_rating,
         p.id AS payment_id, p.method AS payment_method, p.amount AS payment_amount, p.created_at AS paid_at
  FROM sessions s
  JOIN subjects sub ON sub.id = s.subject_id
  JOIN users stu ON stu.id = s.student_id
  JOIN users tut ON tut.id = s.tutor_id
  LEFT JOIN evaluations e ON e.session_id = s.id
  LEFT JOIN payments p ON p.session_id = s.id`;

async function findById(id) {
  const rows = await query(`${SESSION_SELECT} WHERE s.id = ?`, [id]);
  return rows[0] || null;
}

async function create({ studentId, tutorId, subjectId, conversationId, scheduledStart, scheduledEnd, topic, notes }) {
  const result = await query(
    `INSERT INTO sessions (student_id, tutor_id, subject_id, conversation_id, scheduled_start, scheduled_end, topic, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [studentId, tutorId, subjectId, conversationId || null, scheduledStart, scheduledEnd, topic || null, notes || null]
  );
  return findById(result.insertId);
}

async function listForStudent(studentId) {
  return query(
    `${SESSION_SELECT} WHERE s.student_id = ? ORDER BY s.scheduled_start DESC`,
    [studentId]
  );
}

async function listForTutor(tutorId) {
  return query(
    `${SESSION_SELECT} WHERE s.tutor_id = ? ORDER BY s.scheduled_start DESC`,
    [tutorId]
  );
}

async function updateStatus(id, status) {
  await query('UPDATE sessions SET status = ? WHERE id = ?', [status, id]);
}

async function updateSchedule(id, scheduledStart, scheduledEnd) {
  await query('UPDATE sessions SET scheduled_start = ?, scheduled_end = ? WHERE id = ?', [scheduledStart, scheduledEnd, id]);
}

/** True when a session overlaps another active session of the same user within a status scope. */
async function hasOverlap({ userId, start, end, excludeSessionId = null }) {
  const params = [userId, userId, end, start];
  let exclude = '';
  if (excludeSessionId) {
    exclude = ' AND id <> ?';
    params.push(excludeSessionId);
  }
  const rows = await query(
    `SELECT id FROM sessions
     WHERE (student_id = ? OR tutor_id = ?)
       AND status IN ('pending','accepted')
       AND scheduled_start < ? AND scheduled_end > ?
       ${exclude}
     LIMIT 1`,
    params
  );
  return rows.length > 0;
}

async function countByStatus() {
  return query(
    `SELECT status, COUNT(*) AS total FROM sessions
     GROUP BY status ORDER BY total DESC`
  );
}

async function countBetween(start, end) {
  const rows = await query(
    'SELECT COUNT(*) AS total FROM sessions WHERE created_at >= ? AND created_at <= ?',
    [start, end]
  );
  return rows[0].total;
}

module.exports = { findById, create, listForStudent, listForTutor, updateStatus, updateSchedule, hasOverlap, countByStatus, countBetween };