const { query, likeEscape } = require('../config/db');

async function getAll() {
  return query('SELECT * FROM subjects ORDER BY name');
}

async function findById(id) {
  const rows = await query('SELECT * FROM subjects WHERE id = ?', [id]);
  return rows[0] || null;
}

async function findByCode(code) {
  const rows = await query('SELECT * FROM subjects WHERE code = ?', [code]);
  return rows[0] || null;
}

async function create({ code, name, description }) {
  const result = await query('INSERT INTO subjects (code, name, description) VALUES (?, ?, ?)', [
    code, name, description || null
  ]);
  return findById(result.insertId);
}

async function update(id, fields) {
  const allowed = ['code', 'name', 'description'];
  const sets = [];
  const params = [];
  for (const f of allowed) {
    if (fields[f] !== undefined) {
      sets.push(`${f} = ?`);
      params.push(fields[f]);
    }
  }
  if (!sets.length) return;
  params.push(id);
  await query(`UPDATE subjects SET ${sets.join(', ')} WHERE id = ?`, params);
}

async function remove(id) {
  const result = await query('DELETE FROM subjects WHERE id = ?', [id]);
  return result.affectedRows;
}

async function search(term) {
  const like = `%${likeEscape(term)}%`;
  return query('SELECT * FROM subjects WHERE name LIKE ? OR code LIKE ? ORDER BY name LIMIT 20', [like, like]);
}

module.exports = { getAll, findById, findByCode, create, update, remove, search };