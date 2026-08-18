const { query } = require('../config/db');

async function create({ tutorId, subjectId, title, fileType, sizeBytes }) {
  const result = await query(
    `INSERT INTO resources (tutor_id, subject_id, title, file_type, size_bytes)
     VALUES (?, ?, ?, ?, ?)`,
    [tutorId, subjectId || null, title, fileType, sizeBytes || null]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const rows = await query(
    `SELECT r.*, CONCAT(u.first_name, ' ', u.last_name) AS tutor_name, u.email AS tutor_email,
            s.name AS subject_name
     FROM resources r
     JOIN users u ON u.id = r.tutor_id
     LEFT JOIN subjects s ON s.id = r.subject_id
     WHERE r.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function listAll() {
  return query(
    `SELECT r.*, CONCAT(u.first_name, ' ', u.last_name) AS tutor_name, u.email AS tutor_email,
            s.name AS subject_name
     FROM resources r
     JOIN users u ON u.id = r.tutor_id
     LEFT JOIN subjects s ON s.id = r.subject_id
     ORDER BY r.created_at DESC`
  );
}

async function remove(id) {
  await query('DELETE FROM resources WHERE id = ?', [id]);
}

module.exports = { create, findById, listAll, remove };