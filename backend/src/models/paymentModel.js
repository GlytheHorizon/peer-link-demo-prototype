const { query } = require('../config/db');

async function findById(id) {
  const rows = await query('SELECT * FROM payments WHERE id = ?', [id]);
  return rows[0] || null;
}

async function findBySessionId(sessionId) {
  const rows = await query('SELECT * FROM payments WHERE session_id = ?', [sessionId]);
  return rows[0] || null;
}

async function create({ sessionId, studentId, method, amount }) {
  const result = await query(
    `INSERT INTO payments (session_id, student_id, method, amount, status)
     VALUES (?, ?, ?, ?, 'paid')`,
    [sessionId, studentId, method, amount]
  );
  return findById(result.insertId);
}

module.exports = { findById, findBySessionId, create };