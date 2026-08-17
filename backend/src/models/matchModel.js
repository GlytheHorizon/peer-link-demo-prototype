const { query } = require('../config/db');

async function upsert({ studentProfileId, tutorProfileId, subjectId, score, breakdown }) {
  await query(
    `INSERT INTO matches (student_profile_id, tutor_profile_id, subject_id, compatibility_score, score_breakdown)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (student_profile_id, tutor_profile_id, subject_id) DO UPDATE
       SET compatibility_score = EXCLUDED.compatibility_score,
           score_breakdown = EXCLUDED.score_breakdown`,
    [studentProfileId, tutorProfileId, subjectId, score, JSON.stringify(breakdown)]
  );
}

async function findByStudent(studentProfileId) {
  return query(
    `SELECT m.id, m.subject_id, m.compatibility_score, m.score_breakdown, m.created_at,
            m.tutor_profile_id, t.user_id AS tutor_user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS tutor_name, u.email AS tutor_email,
            s.code AS subject_code, s.name AS subject_name
     FROM matches m
     JOIN tutor_profiles t ON t.id = m.tutor_profile_id
     JOIN users u ON u.id = t.user_id
     JOIN subjects s ON s.id = m.subject_id
     WHERE m.student_profile_id = ?
     ORDER BY m.compatibility_score DESC, m.created_at DESC`,
    [studentProfileId]
  );
}

async function findById(id) {
  const rows = await query(
    `SELECT m.*, t.user_id AS tutor_user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS tutor_name, u.email AS tutor_email,
            s.code AS subject_code, s.name AS subject_name
     FROM matches m
     JOIN tutor_profiles t ON t.id = m.tutor_profile_id
     JOIN users u ON u.id = t.user_id
     JOIN subjects s ON s.id = m.subject_id
     WHERE m.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findForStudentAndSubject(studentProfileId, subjectId) {
  return query(
    `SELECT m.*, t.user_id AS tutor_user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS tutor_name, u.email AS tutor_email
     FROM matches m
     JOIN tutor_profiles t ON t.id = m.tutor_profile_id
     JOIN users u ON u.id = t.user_id
     WHERE m.student_profile_id = ? AND m.subject_id = ?
     ORDER BY m.compatibility_score DESC`,
    [studentProfileId, subjectId]
  );
}

async function removeForSubject(studentProfileId, subjectId) {
  await query('DELETE FROM matches WHERE student_profile_id = ? AND subject_id = ?', [
    studentProfileId, subjectId
  ]);
}

module.exports = { upsert, findByStudent, findById, findForStudentAndSubject, removeForSubject };