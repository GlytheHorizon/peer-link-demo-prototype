const { query } = require('../config/db');

async function create({ sessionId, requesterId, proposedStart, proposedEnd, reason }) {
  const result = await query(
    `INSERT INTO reschedule_requests (session_id, requester_id, proposed_start, proposed_end, reason, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [sessionId, requesterId, proposedStart, proposedEnd, reason || null]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const rows = await query(
    `SELECT rr.*, CONCAT(u.first_name, ' ', u.last_name) AS requester_name
     FROM reschedule_requests rr
     JOIN users u ON u.id = rr.requester_id
     WHERE rr.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function listBySession(sessionId) {
  return query(
    `SELECT rr.*, CONCAT(u.first_name, ' ', u.last_name) AS requester_name
     FROM reschedule_requests rr
     JOIN users u ON u.id = rr.requester_id
     WHERE rr.session_id = ?
     ORDER BY rr.created_at DESC`,
    [sessionId]
  );
}

async function findPendingBySession(sessionId) {
  const rows = await query(
    `SELECT * FROM reschedule_requests
     WHERE session_id = ? AND status = 'pending'
     ORDER BY created_at DESC LIMIT 1`,
    [sessionId]
  );
  return rows[0] || null;
}

async function setStatus(id, status) {
  await query('UPDATE reschedule_requests SET status = ?, responded_at = now() WHERE id = ?', [status, id]);
}

module.exports = { create, findById, listBySession, findPendingBySession, setStatus };