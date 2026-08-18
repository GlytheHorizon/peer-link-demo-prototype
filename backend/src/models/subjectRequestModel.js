const { query } = require('../config/db');

async function create(tutorId, { code, name, description, proficiency, strand }) {
  const result = await query(
    'INSERT INTO subject_requests (tutor_id, code, name, description, proficiency, strand) VALUES (?, ?, ?, ?, ?, ?)',
    [tutorId, code, name, description || null, proficiency || 3, strand || null]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const rows = await query(
    `SELECT sr.*, CONCAT(u.first_name, ' ', u.last_name) AS tutor_name, u.email AS tutor_email
       FROM subject_requests sr
       JOIN users u ON u.id = sr.tutor_id
      WHERE sr.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findByTutorCode(tutorId, code) {
  const rows = await query('SELECT * FROM subject_requests WHERE tutor_id = ? AND code = ?', [tutorId, code]);
  return rows[0] || null;
}

async function listByTutor(tutorId) {
  return query('SELECT * FROM subject_requests WHERE tutor_id = ? ORDER BY created_at DESC', [tutorId]);
}

async function listByStatus(status) {
  if (status === 'pending' || status === 'approved' || status === 'rejected') {
    return query(
      `SELECT sr.*, CONCAT(u.first_name, ' ', u.last_name) AS tutor_name, u.email AS tutor_email
         FROM subject_requests sr
         JOIN users u ON u.id = sr.tutor_id
        WHERE sr.status = ? ORDER BY sr.created_at DESC`,
      [status]
    );
  }
  return query(
    `SELECT sr.*, CONCAT(u.first_name, ' ', u.last_name) AS tutor_name, u.email AS tutor_email
       FROM subject_requests sr
       JOIN users u ON u.id = sr.tutor_id
      ORDER BY sr.created_at DESC`
  );
}

async function setStatus(id, status) {
  const result = await query('UPDATE subject_requests SET status = ?, reviewed_at = now() WHERE id = ?', [status, id]);
  return result.affectedRows;
}

/** Re-activates a previously reviewed request (e.g. rejected) with fresh details, resetting it to pending. */
async function resubmit(id, { code, name, description, proficiency, strand }) {
  await query(
    `UPDATE subject_requests
        SET code = ?, name = ?, description = ?, proficiency = ?, strand = ?, status = 'pending', reviewed_at = NULL
      WHERE id = ?`,
    [code, name, description || null, proficiency || 3, strand || null, id]
  );
  return findById(id);
}

module.exports = { create, findById, findByTutorCode, listByTutor, listByStatus, setStatus, resubmit };