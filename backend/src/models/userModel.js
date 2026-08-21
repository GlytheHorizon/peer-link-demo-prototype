const { query, qex, likeEscape } = require('../config/db');

const SAFE_COLUMNS = 'id, email, first_name, last_name, role, is_active, suspended_until, suspension_reason, is_banned, ban_reason, last_seen_at, created_at, updated_at, name_changes_count, name_changes_reset_at';

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
  const allowed = ['first_name', 'last_name', 'email', 'is_active', 'suspended_until', 'suspension_reason', 'is_banned', 'ban_reason', 'name_changes_count', 'name_changes_reset_at'];
  const sets = [];
  const params = [];
  for (const f of allowed) {
    if (fields[f] !== undefined) {
      sets.push(`${f} = ?`);
      let val = fields[f];
      if (f === 'is_active' || f === 'is_banned') {
        val = Boolean(val);
      }
      params.push(val);
    }
  }
  if (!sets.length) return 0;
  params.push(id);
  const result = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  return result.affectedRows;
}

/**
 * Changes a user's display name, enforcing a 2-change-per-calendar-month limit.
 * Returns { ok: true } or { ok: false, message }
 */
async function changeName(id, firstName, lastName) {
  const rows = await query(`SELECT name_changes_count, name_changes_reset_at FROM users WHERE id = ?`, [id]);
  if (!rows.length) return { ok: false, message: 'User not found' };
  const user = rows[0];
  const now = new Date();
  const resetAt = user.name_changes_reset_at ? new Date(user.name_changes_reset_at) : null;
  // Reset counter if we've moved into a new calendar month
  const sameMonth = resetAt && resetAt.getMonth() === now.getMonth() && resetAt.getFullYear() === now.getFullYear();
  const count = sameMonth ? (user.name_changes_count || 0) : 0;
  if (count >= 2) {
    return { ok: false, message: 'You can only change your name 2 times per month. Limit resets next month.' };
  }
  await query(
    'UPDATE users SET first_name = ?, last_name = ?, name_changes_count = ?, name_changes_reset_at = ? WHERE id = ?',
    [firstName, lastName, count + 1, now, id]
  );
  return { ok: true, changesUsed: count + 1 };
}

/** Changes a user's email after verifying it doesn't already exist. */
async function changeEmail(id, newEmail) {
  const existing = await findByEmail(newEmail);
  if (existing && existing.id !== id) return { ok: false, message: 'That email address is already in use.' };
  await query('UPDATE users SET email = ? WHERE id = ?', [newEmail, id]);
  return { ok: true };
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
  changeName,
  changeEmail,
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