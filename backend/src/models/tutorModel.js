const { query, qex } = require('../config/db');

async function findProfileByUserId(userId) {
  const rows = await query(
    `SELECT tp.*, CONCAT(u.first_name, ' ', u.last_name) AS full_name, u.email
     FROM tutor_profiles tp
     JOIN users u ON u.id = tp.user_id
     WHERE tp.user_id = ?`,
    [userId]
  );
  return rows[0] || null;
}

async function createProfile({ userId, course, max_year_level, bio, availability, tags, age, grade_level, school, strand, subjects_teach, learning_mode, preferred_schedule, preferred_time }, conn) {
  const values = [
    userId, course || null, max_year_level || 5, bio || null,
    availability ? JSON.stringify(availability) : null,
    tags && Array.isArray(tags) ? JSON.stringify(tags) : null,
    age || null, grade_level || null, school || null, strand || null,
    subjects_teach ? JSON.stringify(subjects_teach) : null,
    learning_mode || null,
    preferred_schedule ? JSON.stringify(preferred_schedule) : null,
    preferred_time || null
  ];
  const sql = 'INSERT INTO tutor_profiles (user_id, course, max_year_level, bio, availability, tags, age, grade_level, school, strand, subjects_teach, learning_mode, preferred_schedule, preferred_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  if (conn) {
    return (await qex(conn, sql, values)).insertId;
  }
  const result = await query(sql, values);
  return result.insertId;
}

async function updateProfile(userId, fields) {
  const allowed = [
    'course', 'max_year_level', 'bio', 'availability', 'tags', 'age', 'grade_level', 'school', 'strand',
    'subjects_teach', 'learning_mode', 'preferred_schedule', 'preferred_time'
  ];
  const sets = [];
  const params = [];
  for (const f of allowed) {
    if (fields[f] !== undefined) {
      sets.push(`${f} = ?`);
      params.push(Array.isArray(fields[f]) ? JSON.stringify(fields[f]) : fields[f]);
    }
  }
  if (!sets.length) return;
  params.push(userId);
  await query(`UPDATE tutor_profiles SET ${sets.join(', ')} WHERE user_id = ?`, params);
}

async function getProfileWithSubjects(userId) {
  const profile = await findProfileByUserId(userId);
  if (!profile) return null;
  const subjects = await query(
    `SELECT s.id, s.code, s.name, s.description, ts.proficiency
     FROM tutor_subjects ts
     JOIN subjects s ON s.id = ts.subject_id
     WHERE ts.tutor_profile_id = ?
     ORDER BY s.name`,
    [profile.id]
  );
  return { ...profile, subjects };
}

async function findProfileById(id) {
  const rows = await query(
    `SELECT tp.*, CONCAT(u.first_name, ' ', u.last_name) AS full_name, u.email
     FROM tutor_profiles tp
     JOIN users u ON u.id = tp.user_id
     WHERE tp.id = ? AND u.is_active = TRUE`,
    [id]
  );
  return rows[0] || null;
}

async function getPublicTutor(id) {
  const profile = await findProfileById(id);
  if (!profile) return null;
  const subjects = await query(
    `SELECT s.id, s.code, s.name, s.description, ts.proficiency
     FROM tutor_subjects ts
     JOIN subjects s ON s.id = ts.subject_id
     WHERE ts.tutor_profile_id = ?`,
    [profile.id]
  );
  return { ...profile, subjects };
}

async function getSubjectKeys(profileId) {
  const rows = await query('SELECT subject_id FROM tutor_subjects WHERE tutor_profile_id = ?', [profileId]);
  return rows.map((r) => r.subject_id);
}

async function replaceSubjects(profileId, items, conn) {
  const exec = conn ? (sql, p) => qex(conn, sql, p) : (sql, p) => query(sql, p);
  await exec('DELETE FROM tutor_subjects WHERE tutor_profile_id = ?', [profileId]);
  for (const item of items) {
    const sid = typeof item === 'number' ? item : item.subject_id;
    const prof = Math.min(5, Math.max(1, Number(item.proficiency) || 3));
    await exec(
      'INSERT INTO tutor_subjects (tutor_profile_id, subject_id, proficiency) VALUES (?, ?, ?)',
      [profileId, sid, prof]
    );
  }
}

/** Attach a subject to a tutor profile; returns false if already attached. */
async function addSubjectToProfile(profileId, subjectId, proficiency) {
  const exists = await query(
    'SELECT 1 FROM tutor_subjects WHERE tutor_profile_id = ? AND subject_id = ?',
    [profileId, subjectId]
  );
  if (exists[0]) return false;
  const prof = Math.min(5, Math.max(1, Number(proficiency) || 3));
  await query(
    'INSERT INTO tutor_subjects (tutor_profile_id, subject_id, proficiency) VALUES (?, ?, ?)',
    [profileId, subjectId, prof]
  );
  return true;
}

async function ensureProfile(userId, data, conn) {
  const existing = await query('SELECT id FROM tutor_profiles WHERE user_id = ?', [userId]);
  if (existing[0]) return existing[0].id;
  return createProfile({ userId, ...data }, conn);
}

/** All active tutors with courses/subjects — used by the matching service. */
async function getAllTutors() {
  return query(
    `SELECT tp.id AS tutor_profile_id, tp.user_id, tp.course, tp.max_year_level,
            tp.availability, tp.tags, tp.learning_mode, u.first_name, u.last_name, u.email
     FROM tutor_profiles tp
     JOIN users u ON u.id = tp.user_id
     WHERE u.is_active = TRUE`
  );
}

module.exports = {
  findProfileByUserId,
  createProfile,
  updateProfile,
  getProfileWithSubjects,
  findProfileById,
  getPublicTutor,
  getSubjectKeys,
  replaceSubjects,
  addSubjectToProfile,
  ensureProfile,
  getAllTutors
};