const { query, qex, withTransaction } = require('../config/db');

async function findProfileByUserId(userId) {
  const rows = await query(
    `SELECT sp.*, CONCAT(u.first_name, ' ', u.last_name) AS full_name, u.email
     FROM student_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.user_id = ?`,
    [userId]
  );
  return rows[0] || null;
}

async function createProfile({ userId, year_level, course, bio }, conn) {
  const values = [userId, year_level || null, course || null, bio || null];
  if (conn) {
    return (await qex(
      conn,
      'INSERT INTO student_profiles (user_id, year_level, course, bio) VALUES (?, ?, ?, ?)',
      values
    )).insertId;
  }
  const result = await query(
    'INSERT INTO student_profiles (user_id, year_level, course, bio) VALUES (?, ?, ?, ?)',
    values
  );
  return result.insertId;
}

async function updateProfile(userId, fields) {
  const allowed = ['year_level', 'course', 'bio'];
  const sets = [];
  const params = [];
  for (const f of allowed) {
    if (fields[f] !== undefined) {
      sets.push(`${f} = ?`);
      params.push(fields[f]);
    }
  }
  if (!sets.length) return;
  params.push(userId);
  await query(`UPDATE student_profiles SET ${sets.join(', ')} WHERE user_id = ?`, params);
}

async function getProfileWithSubjects(userId) {
  const profile = await findProfileByUserId(userId);
  if (!profile) return null;
  const subjects = await query(
    `SELECT s.id, s.code, s.name, s.description
     FROM student_subjects ss
     JOIN subjects s ON s.id = ss.subject_id
     WHERE ss.student_profile_id = ?
     ORDER BY s.name`,
    [profile.id]
  );
  return { ...profile, subjects };
}

async function getSubjectKeys(profileId) {
  const rows = await query('SELECT subject_id FROM student_subjects WHERE student_profile_id = ?', [profileId]);
  return rows.map((r) => r.subject_id);
}

async function replaceSubjects(profileId, subjectIds, conn) {
  if (conn) {
    await qex(conn, 'DELETE FROM student_subjects WHERE student_profile_id = ?', [profileId]);
    for (const sid of subjectIds) {
      await qex(conn, 'INSERT INTO student_subjects (student_profile_id, subject_id) VALUES (?, ?)', [profileId, sid]);
    }
    return;
  }
  await query('DELETE FROM student_subjects WHERE student_profile_id = ?', [profileId]);
  for (const sid of subjectIds) {
    await query('INSERT INTO student_subjects (student_profile_id, subject_id) VALUES (?, ?)', [profileId, sid]);
  }
}

/** Creates the student profile row if missing (idempotent registration helper). */
async function ensureProfile(userId, data, conn) {
  const existing = await query('SELECT id FROM student_profiles WHERE user_id = ?', [userId]);
  if (existing[0]) {
    return existing[0].id;
  }
  return createProfile({ userId, ...data }, conn);
}

module.exports = {
  findProfileByUserId,
  createProfile,
  updateProfile,
  getProfileWithSubjects,
  getSubjectKeys,
  replaceSubjects,
  ensureProfile,
  withTransaction
};