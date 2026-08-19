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

/**
 * Live summary for a student's Payment tab:
 * stats (total spent, pending total, completed count) and a combined
 * payment history: per-session payments + conversation clearance payments.
 */
async function studentSummary(studentId) {
  const [spent, pending, paidCount, convSpent, convCount] = await Promise.all([
    query(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE student_id = ? AND status = 'paid'`, [studentId]),
    query(`SELECT COALESCE(SUM(amount), 0) AS total FROM conversation_payments WHERE student_id = ? AND status = 'pending'`, [studentId]),
    query(`SELECT COUNT(*) AS total FROM payments WHERE student_id = ? AND status = 'paid'`, [studentId]),
    query(`SELECT COALESCE(SUM(amount), 0) AS total FROM conversation_payments WHERE student_id = ? AND status = 'accepted'`, [studentId]),
    query(`SELECT COUNT(*) AS total FROM conversation_payments WHERE student_id = ? AND status = 'accepted'`, [studentId])
  ]);
  const history = await query(
    `SELECT * FROM (
       SELECT p.id, p.created_at AS "date", p.amount, p.status, 'session' AS kind, NULL AS conversation_id,
              CONCAT(tut.first_name, ' ', tut.last_name) AS tutor_name
       FROM payments p
       JOIN sessions s ON s.id = p.session_id
       JOIN users tut ON tut.id = s.tutor_id
       WHERE p.student_id = ?
       UNION ALL
       SELECT cp.id, cp.created_at AS "date", cp.amount, cp.status, 'conversation' AS kind, cp.conversation_id,
              CONCAT(u.first_name, ' ', u.last_name) AS tutor_name
       FROM conversation_payments cp
       JOIN users u ON u.id = cp.tutor_id
       WHERE cp.student_id = ?
     ) all_payments
     ORDER BY "date" DESC, id DESC`,
    [studentId, studentId]
  );
  return {
    stats: {
      total_spent: (Number(spent[0].total) || 0) + (Number(convSpent[0].total) || 0),
      pending_total: Number(pending[0].total) || 0,
      completed_count: Number(paidCount[0].total) + Number(convCount[0].total)
    },
    history
  };
}

module.exports = { findById, findBySessionId, create, studentSummary };