const { query, qex, likeEscape } = require('../config/db');

const SAFE_COLUMNS = 'id, email, first_name, last_name, role, is_active, suspended_until, suspension_reason, is_banned, ban_reason, last_seen_at, created_at, updated_at';

async function findByEmail(email) {
  const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const rows = await query(`SELECT ${SAFE_COLUMNS} FROM users WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function create({ email, password_hash, first_name, last_name, role }, conn) {
  const db = conn || { execute: (sql, p) => query(sql, p) };
  const result = conn ? await qex(conn, 'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)', [email, password_hash, first_name, last_name, role])
    : await query('INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)', [email, password_hash, first_name, last_name, role]);
  return result.insertId;
}

async function update(id, fields) {
  const allowed = ['first_name', 'last_name', 'is_active', 'suspended_until', 'suspension_reason', 'is_banned', 'ban_reason'];
  const sets = [];
  const params = [];
  for (const f of allowed) {
    if (fields[f] !== undefined) {
      sets.push(`${f} = ?`);
      params.push(fields[f]);
    }
  }
  if (!sets.length) return 0;
  params.push(id);
  const result = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  return result.affectedRows;
}

async function changePassword(id, newHash, conn) {
  if (conn) {
    await qex(conn, 'UPDATE users SET password_hash = ? WHERE id = ?', [newHash, id]);
  } else {
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, id]);
  }
}

/** Records that the user was just seen active (presence heartbeat). */
async function touchLastSeen(id) {
  await query('UPDATE users SET last_seen_at = now() WHERE id = ?', [id]);
}

async function list({ role, search, page = 1, limit = 50 } = {}) {
  const where = [];
  const params = [];
  if (role) {
    where.push('role = ?');
    params.push(role);
  }
  if (search) {
    const like = `%${likeEscape(search)}%`;
    where.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)');
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const rows = await query(
    `SELECT ${SAFE_COLUMNS} FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const countRows = await query(`SELECT COUNT(*) AS total FROM users ${whereSql}`, params);
  return { rows, total: countRows[0].total, page, limit };
}

async function countByRole() {
  return query('SELECT role, COUNT(*) AS total FROM users WHERE is_active = TRUE GROUP BY role');
}

/** Inserts a new warning for a user. */
async function warnUser({ userId, adminId, reason }) {
  const res = await query(
    'INSERT INTO user_warnings (user_id, admin_id, reason) VALUES (?, ?, ?)',
    [userId, adminId, reason]
  );
  return res.insertId;
}

/** Fetches all unacknowledged warnings for a specific user. */
async function getUnacknowledgedWarnings(userId) {
  return query(
    'SELECT id, user_id, admin_id, reason, created_at FROM user_warnings WHERE user_id = ? AND is_acknowledged = FALSE ORDER BY created_at ASC',
    [userId]
  );
}

/** Marks a specific warning as acknowledged by the user. */
async function acknowledgeWarning({ warningId, userId }) {
  const res = await query(
    'UPDATE user_warnings SET is_acknowledged = TRUE, acknowledged_at = now() WHERE id = ? AND user_id = ?',
    [warningId, userId]
  );
  return res.affectedRows > 0;
}

/** Suspends a user account until a specific end date with reason. */
async function suspendUser({ userId, suspendedUntil, reason }) {
  const res = await query(
    'UPDATE users SET suspended_until = ?, suspension_reason = ?, is_active = FALSE WHERE id = ?',
    [suspendedUntil, reason, userId]
  );
  return res.affectedRows > 0;
}

/** Permanently bans a user account with reason. */
async function banUser({ userId, reason }) {
  const res = await query(
    'UPDATE users SET is_banned = TRUE, ban_reason = ?, is_active = FALSE WHERE id = ?',
    [reason, userId]
  );
  return res.affectedRows > 0;
}

/** Clears suspension fields and restores account active state. */
async function clearSuspension(userId) {
  const res = await query(
    'UPDATE users SET suspended_until = NULL, suspension_reason = NULL, is_active = TRUE WHERE id = ?',
    [userId]
  );
  return res.affectedRows > 0;
}

module.exports = {
  findByEmail,
  findById,
  create,
  update,
  changePassword,
  touchLastSeen,
  list,
  countByRole,
  warnUser,
  getUnacknowledgedWarnings,
  acknowledgeWarning,
  suspendUser,
  banUser,
  clearSuspension
};