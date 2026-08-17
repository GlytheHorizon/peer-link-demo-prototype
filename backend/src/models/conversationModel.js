const { query } = require('../config/db');

async function findOrCreate({ studentId, tutorId, subjectId }) {
  const existing = await query(
    `SELECT * FROM conversations WHERE student_id = ? AND tutor_id = ? AND subject_id = ?`,
    [studentId, tutorId, subjectId]
  );
  if (existing[0]) return existing[0];
  const result = await query(
    'INSERT INTO conversations (student_id, tutor_id, subject_id) VALUES (?, ?, ?)',
    [studentId, tutorId, subjectId]
  );
  const rows = await query('SELECT * FROM conversations WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function findById(id) {
  const rows = await query(
    `SELECT c.*, s.code AS subject_code, s.name AS subject_name,
            CONCAT(st.first_name, ' ', st.last_name) AS student_name,
            CONCAT(tt.first_name, ' ', tt.last_name) AS tutor_name
     FROM conversations c
     JOIN subjects s ON s.id = c.subject_id
     JOIN users st ON st.id = c.student_id
     JOIN users tt ON tt.id = c.tutor_id
     WHERE c.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function listForUser(userId) {
  return query(
    `SELECT c.id, c.subject_id, c.student_id, c.tutor_id, c.created_at, c.updated_at,
            s.code AS subject_code, s.name AS subject_name,
            CONCAT(st.first_name, ' ', st.last_name) AS student_name,
            CONCAT(tt.first_name, ' ', tt.last_name) AS tutor_name,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id <> ? AND m.is_read = FALSE) AS unread_count,
            (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message
     FROM conversations c
     JOIN subjects s ON s.id = c.subject_id
     JOIN users st ON st.id = c.student_id
     JOIN users tt ON tt.id = c.tutor_id
     WHERE c.student_id = ? OR c.tutor_id = ?
     ORDER BY c.updated_at DESC`,
    [userId, userId, userId]
  );
}

async function isParticipant(conversationId, userId) {
  const rows = await query(
    'SELECT id FROM conversations WHERE id = ? AND (student_id = ? OR tutor_id = ?)',
    [conversationId, userId, userId]
  );
  return rows.length > 0;
}

module.exports = { findOrCreate, findById, listForUser, isParticipant };