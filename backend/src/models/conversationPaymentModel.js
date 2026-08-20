const { query } = require('../config/db');

function selectWithNames() {
  return `SELECT p.*, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                 CONCAT(t.first_name, ' ', t.last_name) AS tutor_name
            FROM conversation_payments p
            JOIN users s ON s.id = p.student_id
            JOIN users t ON t.id = p.tutor_id`;
}

async function create({ conversationId, sessionId = null, studentId, tutorId, amount, reference }) {
  const result = await query(
    'INSERT INTO conversation_payments (conversation_id, session_id, student_id, tutor_id, amount, reference) VALUES (?, ?, ?, ?, ?, ?)',
    [conversationId, sessionId, studentId, tutorId, amount, reference || null]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const rows = await query(`${selectWithNames()} WHERE p.id = ?`, [id]);
  return rows[0] || null;
}

async function listByConversation(conversationId) {
  return query(
    `${selectWithNames()} WHERE p.conversation_id = ? ORDER BY p.created_at DESC, p.id DESC`,
    [conversationId]
  );
}

/** Payments attached to one specific session (excludes payments of other sessions in the same conversation). */
async function listBySession(sessionId) {
  return query(
    `${selectWithNames()} WHERE p.session_id = ? ORDER BY p.created_at DESC, p.id DESC`,
    [sessionId]
  );
}

async function hasPending(conversationId) {
  const rows = await query(
    'SELECT id FROM conversation_payments WHERE conversation_id = ? AND status = \'pending\' LIMIT 1',
    [conversationId]
  );
  return rows.length > 0;
}

async function setStatus(id, status, reason = null) {
  await query(
    'UPDATE conversation_payments SET status = ?, reject_reason = ?, reviewed_at = now() WHERE id = ?',
    [status, reason, id]
  );
}

module.exports = { create, findById, listByConversation, listBySession, hasPending, setStatus };