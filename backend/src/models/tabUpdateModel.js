const { query } = require('../config/db');

/** Latest timestamp across the given values (Date-parseable), or null. */
function maxMs(...vals) {
  const ts = vals.filter(Boolean).map((v) => new Date(v).getTime());
  return ts.length ? Math.max(...ts) : null;
}

function iso(ms) {
  return ms ? new Date(ms).toISOString() : null;
}

/**
 * Computes the most recent "something happened" timestamp for every sidebar
 * tab that has data relevant to the current user. Keys are the nav `to` paths.
 * The frontend compares these against a per-user "last seen" value and shows a
 * red dot until the user opens the tab.
 */
async function latestForUser(userId, role) {
  const tabs = {};

  // Sessions + reschedule requests — student & tutor tabs.
  const sessions = await query(
    'SELECT MAX(updated_at) AS latest FROM sessions WHERE student_id = ? OR tutor_id = ?',
    [userId, userId]
  );
  const reschedules = await query(
    `SELECT MAX(rr.created_at) AS latest
     FROM reschedule_requests rr
     JOIN sessions s ON s.id = rr.session_id
     WHERE s.student_id = ? OR s.tutor_id = ?`,
    [userId, userId]
  );
  const sessionTs = maxMs(sessions[0]?.latest, reschedules[0]?.latest);

  if (role === 'tutor') {
    const earnings = await query(
      `SELECT MAX(latest) AS latest FROM (
         SELECT cp.created_at AS latest FROM conversation_payments cp
         WHERE cp.tutor_id = ? AND cp.status = 'accepted'
         UNION ALL
         SELECT p.created_at FROM payments p
         JOIN sessions s ON s.id = p.session_id
         WHERE s.tutor_id = ?
       ) t`,
      [userId, userId]
    );
    const ownResources = await query(
      'SELECT MAX(created_at) AS latest FROM resources WHERE tutor_id = ?',
      [userId]
    );

    if (sessionTs) {
      tabs['/sessions'] = iso(sessionTs);
      tabs['/students'] = iso(sessionTs);
    }
    if (earnings[0]?.latest) tabs['/earnings'] = iso(earnings[0].latest);
    if (ownResources[0]?.latest) tabs['/resources'] = iso(ownResources[0].latest);
  }

  if (role === 'student') {
    const matches = await query(
      `SELECT MAX(m.created_at) AS latest
       FROM matches m
       JOIN student_profiles sp ON sp.id = m.student_profile_id
       WHERE sp.user_id = ?`,
      [userId]
    );
    const payments = await query(
      `SELECT MAX(latest) AS latest FROM (
         SELECT p.created_at AS latest FROM payments p WHERE p.student_id = ?
         UNION ALL
         SELECT cp.created_at FROM conversation_payments cp WHERE cp.student_id = ?
       ) t`,
      [userId, userId]
    );
    const resources = await query('SELECT MAX(created_at) AS latest FROM resources');

    if (sessionTs) tabs['/sessions'] = iso(sessionTs);
    if (matches[0]?.latest) tabs['/matches'] = iso(matches[0].latest);
    if (payments[0]?.latest) tabs['/payment'] = iso(payments[0].latest);
    if (resources[0]?.latest) tabs['/resources'] = iso(resources[0].latest);
  }

  if (role === 'faculty') {
    const resources = await query('SELECT MAX(created_at) AS latest FROM resources');
    if (resources[0]?.latest) tabs['/resources'] = iso(resources[0].latest);
  }

  if (role === 'admin') {
    const users = await query('SELECT MAX(created_at) AS latest FROM users');
    const subjects = await query(
      `SELECT MAX(latest) AS latest FROM (
         SELECT created_at AS latest FROM subjects
         UNION ALL
         SELECT created_at FROM subject_requests
       ) t`
    );
    const logs = await query('SELECT MAX(created_at) AS latest FROM activity_logs');
    const resources = await query('SELECT MAX(created_at) AS latest FROM resources');

    if (sessionTs) tabs['/sessions'] = iso(sessionTs);
    if (users[0]?.latest) tabs['/admin/users'] = iso(users[0].latest);
    if (subjects[0]?.latest) tabs['/admin/subjects'] = iso(subjects[0].latest);
    if (logs[0]?.latest) tabs['/admin/logs'] = iso(logs[0].latest);
    if (resources[0]?.latest) tabs['/resources'] = iso(resources[0].latest);
  }

  // Dashboard reflects any new activity across the user's tabs.
  const latest = maxMs(...Object.values(tabs));
  if (latest) tabs['/dashboard'] = iso(latest);

  return tabs;
}

module.exports = { latestForUser };