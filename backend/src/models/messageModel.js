const { query } = require('../config/db');

async function listByConversation(conversationId) {
  return query(
    `SELECT m.id, m.conversation_id, m.sender_id, m.body, m.is_read, m.is_system, m.created_at,
            CASE WHEN m.sender_id IS NULL THEN NULL
                 ELSE CONCAT(u.first_name, ' ', u.last_name) END AS sender_name
     FROM messages m
     LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ?
     ORDER BY m.created_at ASC, m.id ASC`,
    [conversationId]
  );
}

async function create({ conversationId, senderId = null, body, isSystem = false }) {
  const result = await query(
    'INSERT INTO messages (conversation_id, sender_id, body, is_system) VALUES (?, ?, ?, ?)',
    [conversationId, senderId, body, isSystem]
  );
  return result.insertId;
}

async function markConversationRead(conversationId, userId) {
  await query(
    'UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id <> ? AND is_read = FALSE',
    [conversationId, userId]
  );
}

async function countUnreadForUser(userId) {
  const rows = await query(
    `SELECT COUNT(*) AS total FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE (c.student_id = ? OR c.tutor_id = ?) AND m.sender_id <> ? AND m.is_read = FALSE`,
    [userId, userId, userId]
  );
  return rows[0].total;
}

async function findById(id) {
  const rows = await query('SELECT * FROM messages WHERE id = ?', [id]);
  return rows[0] || null;
}

/** Deletes a message; returns affected row count. */
async function remove(id) {
  const result = await query('DELETE FROM messages WHERE id = ?', [id]);
  return result.affectedRows;
}

/** True when a "Session Completed" system message already exists for the conversation. */
async function hasCompletionMessage(conversationId) {
  const rows = await query(
    'SELECT id FROM messages WHERE conversation_id = ? AND is_system = TRUE AND body LIKE \'Session Completed%\' LIMIT 1',
    [conversationId]
  );
  return rows.length > 0;
}

module.exports = { listByConversation, create, markConversationRead, countUnreadForUser, findById, remove, hasCompletionMessage };