const { query, likeEscape } = require('../config/db');

async function insert({ userId, action, entityType = null, entityId = null, details = null, ip = null }) {
  const result = await query(
    `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId || null, action, entityType, entityId, details ? JSON.stringify(details) : null, ip || null]
  );
  return result.insertId;
}

async function list({ userId, action, page = 1, limit = 50 } = {}) {
  const where = [];
  const params = [];
  if (userId) {
    where.push('l.user_id = ?');
    params.push(userId);
  }
  if (action) {
    where.push('l.action LIKE ?');
    params.push(`%${likeEscape(action)}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const rows = await query(
    `SELECT l.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name
     FROM activity_logs l
     LEFT JOIN users u ON u.id = l.user_id
     ${whereSql}
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const countRows = await query(`SELECT COUNT(*) AS total FROM activity_logs l ${whereSql}`, params);
  return { rows, total: countRows[0].total, page, limit };
}

module.exports = { insert, list };