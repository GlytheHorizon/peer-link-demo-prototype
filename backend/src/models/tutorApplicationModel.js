const { query } = require('../config/db');

const COLUMNS =
  'id, full_name, email, phone, address, hourly_rate, subjects, license_number, institution, specialization, years_teaching, license_file, id_file, status, created_at, reviewed_at';

async function create(data) {
  const result = await query(
    `INSERT INTO tutor_applications
      (full_name, email, phone, address, hourly_rate, subjects, license_number, institution, specialization, years_teaching, license_file, id_file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.full_name,
      data.email,
      data.phone,
      data.address || null,
      data.hourly_rate != null ? data.hourly_rate : null,
      data.subjects && data.subjects.length ? JSON.stringify(data.subjects) : null,
      data.license_number || null,
      data.institution || null,
      data.specialization || null,
      data.years_teaching != null ? data.years_teaching : null,
      data.license_file || null,
      data.id_file || null
    ]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const rows = await query(`SELECT ${COLUMNS} FROM tutor_applications WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function findByEmail(email) {
  const rows = await query(
    `SELECT ${COLUMNS} FROM tutor_applications WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function list({ status, page = 1, limit = 50 } = {}) {
  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const rows = await query(
    `SELECT ${COLUMNS} FROM tutor_applications ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const count = await query(`SELECT COUNT(*) AS total FROM tutor_applications ${whereSql}`, params);
  return { rows, total: count[0].total, page, limit };
}

async function setStatus(id, status) {
  await query('UPDATE tutor_applications SET status = ?, reviewed_at = now() WHERE id = ?', [status, id]);
}

async function updateFiles(id, files) {
  await query(
    'UPDATE tutor_applications SET license_file = ?, id_file = ? WHERE id = ?',
    [files.license_file || null, files.id_file || null, id]
  );
}

async function remove(id) {
  await query('DELETE FROM tutor_applications WHERE id = ?', [id]);
}

module.exports = { create, findById, list, setStatus, updateFiles, remove };