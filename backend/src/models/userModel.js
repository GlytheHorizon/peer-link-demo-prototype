const { query, qex, likeEscape } = require('../config/db');

const SAFE_COLUMNS = 'id, email, first_name, last_name, role, is_active, created_at, updated_at';

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
  const allowed = ['first_name', 'last_name', 'is_active'];
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

async function changePassword(id, newHash) {
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, id]);
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

module.exports = { findByEmail, findById, create, update, changePassword, list, countByRole };