const { query, qex } = require('../config/db');

async function findProfileByUserId(userId) {
  const rows = await query(
    `SELECT tp.*, CONCAT(u.first_name, ' ', u.last_name) AS full_name, u.email
     FROM tutor_profiles tp
     JOIN users u ON u.id = tp.user_id
     WHERE tp.user_id = ? AND u.is_active = TRUE`,
    [userId]
  );
  return rows[0] || null;
}

async function createProfile({ userId, course, max_year_level, bio, availability, tags, age, grade_level, school, strand, contact_no, gender, subjects_teach, learning_mode, preferred_schedule, preferred_time }, conn) {
  const values = [
    userId, course || null, max_year_level || 5, bio || null,
    availability ? JSON.stringify(availability) : null,
    tags && Array.isArray(tags) ? JSON.stringify(tags) : null,
    age || null, grade_level || null, school || null, strand || null,
    contact_no || null, gender || null,
    subjects_teach ? JSON.stringify(subjects_teach) : null,
    learning_mode || null,
    preferred_schedule ? JSON.stringify(preferred_schedule) : null,
    preferred_time || null
  ];
  const sql = 'INSERT INTO tutor_profiles (user_id, course, max_year_level, bio, availability, tags, age, grade_level, school, strand, contact_no, gender, subjects_teach, learning_mode, preferred_schedule, preferred_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  if (conn) {
    return (await qex(conn, sql, values)).insertId;
  }
  const result = await query(sql, values);
  return result.insertId;
}

async function updateProfile(userId, fields) {
  const allowed = [
    'course', 'max_year_level', 'bio', 'availability', 'tags', 'age', 'grade_level', 'school', 'strand',
    'contact_no', 'gender',
    'subjects_teach', 'learning_mode', 'preferred_schedule', 'preferred_time',
    'verification_status'
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
  params.push(userId, userId);
  await query(`UPDATE tutor_profiles SET ${sets.join(', ')} WHERE user_id = ? OR id = ?`, params);
}

async function getProfileWithSubjects(userId) {
  const profile = await findProfileByUserId(userId);
  if (!profile) return null;
  const subjects = await query(
    `SELECT s.id, s.code, s.name, s.description, ts.proficiency, ts.rate_per_hour
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
  // Accepts EITHER a tutor_profile id (matching results / dashboard links) OR a
  // user id (messages / sessions / profile links) for the same tutor.
  // Try user_id first since match/browse results pass tutor_user_id (user_id).
  const profile = await findProfileByUserId(id)
    || await findProfileById(id);
  if (!profile) return null;
  const subjects = await query(
    `SELECT s.id, s.code, s.name, s.description, ts.proficiency, ts.rate_per_hour
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
    const rate = clampRate(item.rate_per_hour);
    await exec(
      'INSERT INTO tutor_subjects (tutor_profile_id, subject_id, proficiency, rate_per_hour) VALUES (?, ?, ?, ?)',
      [profileId, sid, prof, rate]
    );
  }
}

function clampRate(value) {
  const n = Number(value);
  if (Number.isFinite(n)) {
    return Math.min(100000, Math.max(0, Math.round(n * 100) / 100));
  }
  return 100;
}

/** Attach a subject to a tutor profile; returns false if already attached. */
async function addSubjectToProfile(profileId, subjectId, proficiency, ratePerHour) {
  const exists = await query(
    'SELECT 1 FROM tutor_subjects WHERE tutor_profile_id = ? AND subject_id = ?',
    [profileId, subjectId]
  );
  if (exists[0]) return false;
  const prof = Math.min(5, Math.max(1, Number(proficiency) || 3));
  const rate = clampRate(ratePerHour);
  await query(
    'INSERT INTO tutor_subjects (tutor_profile_id, subject_id, proficiency, rate_per_hour) VALUES (?, ?, ?, ?)',
    [profileId, subjectId, prof, rate]
  );
  return true;
}

/** Hourly rate a tutor charges for a given subject; null when not set. */
async function getSubjectRate(profileId, subjectId) {
  const rows = await query(
    'SELECT rate_per_hour FROM tutor_subjects WHERE tutor_profile_id = ? AND subject_id = ?',
    [profileId, subjectId]
  );
  return rows[0] ? Number(rows[0].rate_per_hour) : null;
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
     WHERE u.is_active = TRUE AND tp.verification_status = 'approved'`
  );
}

/** All active tutors with their teaching subjects — used for browsing resource folders. */
async function getAllTutorsWithSubjects() {
  const tutors = await getAllTutors();
  if (tutors.length === 0) return [];
  const rows = await query(
    `SELECT ts.tutor_profile_id, s.id AS subject_id, s.name AS subject_name
     FROM tutor_subjects ts
     JOIN subjects s ON s.id = ts.subject_id
     WHERE ts.tutor_profile_id IN (?)
     ORDER BY s.name`,
    [tutors.map((t) => t.tutor_profile_id)]
  );
  const byTutor = new Map();
  for (const r of rows) {
    if (!byTutor.has(r.tutor_profile_id)) byTutor.set(r.tutor_profile_id, []);
    byTutor.get(r.tutor_profile_id).push({ id: r.subject_id, name: r.subject_name });
  }
  return tutors.map((t) => ({ ...t, subjects: byTutor.get(t.tutor_profile_id) || [] }));
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
  getSubjectRate,
  ensureProfile,
  getAllTutors,
  getAllTutorsWithSubjects
};