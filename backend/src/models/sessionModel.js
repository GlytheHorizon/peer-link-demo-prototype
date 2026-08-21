const { query } = require('../config/db');

const SESSION_SELECT = `
  SELECT s.*, sub.code AS subject_code, sub.name AS subject_name,
         CONCAT(stu.first_name, ' ', stu.last_name) AS student_name, stu.email AS student_email,
         CONCAT(tut.first_name, ' ', tut.last_name) AS tutor_name, tut.email AS tutor_email,
         e.id AS evaluation_id, e.rating AS evaluation_rating,
         COALESCE(p.id, cp.id) AS payment_id, p.method AS payment_method,
         COALESCE(p.amount, cp.amount) AS payment_amount,
         COALESCE(p.status, cp.status) AS payment_status,
         COALESCE(p.created_at, cp.created_at) AS paid_at,
         CASE WHEN cp.id IS NULL THEN cp2.id END AS pending_payment_id,
         CASE WHEN cp.id IS NULL THEN cp2.amount END AS pending_amount,
         CASE WHEN cp.id IS NULL THEN cp2.created_at END AS pending_at,
         CASE WHEN cp.id IS NULL THEN cp3.id END AS rejected_payment_id,
         CASE WHEN cp.id IS NULL THEN cp3.amount END AS rejected_amount,
         CASE WHEN cp.id IS NULL THEN cp3.reject_reason END AS payment_reject_reason,
         CASE WHEN cp.id IS NULL THEN cp3.created_at END AS rejected_at,
         tsr.rate_per_hour, s.reject_reason, s.cancel_reason,
         rr.id AS reschedule_request_id, rr.requester_id AS reschedule_requester_id,
         rr.proposed_start AS reschedule_start, rr.proposed_end AS reschedule_end, rr.reason AS reschedule_reason
    FROM sessions s
    JOIN subjects sub ON sub.id = s.subject_id
    JOIN users stu ON stu.id = s.student_id
    JOIN users tut ON tut.id = s.tutor_id
    LEFT JOIN tutor_profiles tpf ON tpf.user_id = tut.id
    LEFT JOIN tutor_subjects tsr ON tsr.tutor_profile_id = tpf.id AND tsr.subject_id = s.subject_id
    LEFT JOIN evaluations e ON e.session_id = s.id
    LEFT JOIN payments p ON p.session_id = s.id
    LEFT JOIN conversation_payments cp ON cp.id = (
      SELECT id FROM conversation_payments
      WHERE session_id = s.id AND status = 'accepted'
      ORDER BY id DESC LIMIT 1
    )
    LEFT JOIN conversation_payments cp2 ON cp2.id = (
      SELECT id FROM conversation_payments
      WHERE session_id = s.id AND status = 'pending'
      ORDER BY id DESC LIMIT 1
    )
    LEFT JOIN conversation_payments cp3 ON cp3.id = (
      SELECT id FROM conversation_payments
      WHERE session_id = s.id AND status = 'rejected'
      ORDER BY id DESC LIMIT 1
    )
    LEFT JOIN reschedule_requests rr ON rr.id = (
      SELECT id FROM reschedule_requests
      WHERE session_id = s.id AND status = 'pending'
      ORDER BY created_at DESC, id DESC LIMIT 1
    )`;

async function findById(id) {
  const rows = await query(`${SESSION_SELECT} WHERE s.id = ?`, [id]);
  return rows[0] || null;
}

async function create({ studentId, tutorId, subjectId, conversationId, scheduledStart, scheduledEnd, topic, notes, learningMode }) {
  const result = await query(
    `INSERT INTO sessions (student_id, tutor_id, subject_id, conversation_id, scheduled_start, scheduled_end, topic, notes, learning_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [studentId, tutorId, subjectId, conversationId || null, scheduledStart, scheduledEnd, topic || null, notes || null, learningMode || null]
  );
  return findById(result.insertId);
}

/** Updates a session's proposed learning mode (online / face-to-face / both). */
async function updateLearningMode(id, learningMode) {
  await query('UPDATE sessions SET learning_mode = ? WHERE id = ?', [learningMode || null, id]);
}

async function listForStudent(studentId) {
  return query(
    `${SESSION_SELECT} WHERE s.student_id = ? ORDER BY s.scheduled_start DESC`,
    [studentId]
  );
}

async function listForTutor(tutorId) {
  return query(
    `${SESSION_SELECT} WHERE s.tutor_id = ? ORDER BY s.scheduled_start DESC`,
    [tutorId]
  );
}

async function updateStatus(id, status, rejectReason = null) {
  if (rejectReason != null) {
    await query('UPDATE sessions SET status = ?, reject_reason = ? WHERE id = ?', [status, rejectReason, id]);
    return;
  }
  await query('UPDATE sessions SET status = ? WHERE id = ?', [status, id]);
}

/** Cancels a session, optionally recording why (and when) it was cancelled. */
async function cancel(id, reason = null) {
  await query(
    'UPDATE sessions SET status = ?, cancel_reason = ?, cancelled_at = NOW() WHERE id = ?',
    ['cancelled', reason, id]
  );
}

/**
 * Records one side's completion confirmation. The session only moves to
 * 'completed' once both the student and the tutor have confirmed.
 */
async function confirmCompletion(id, side) {
  const column = side === 'student' ? 'student_complete_confirmed_at' : 'tutor_complete_confirmed_at';
  const other = side === 'student' ? 'tutor_complete_confirmed_at' : 'student_complete_confirmed_at';
  await query(
    `UPDATE sessions
     SET ${column} = NOW(),
         status = CASE
           WHEN ${other} IS NOT NULL THEN 'completed'
           ELSE status
         END
     WHERE id = ?`,
    [id]
  );
}

async function updateSchedule(id, scheduledStart, scheduledEnd) {
  await query('UPDATE sessions SET scheduled_start = ?, scheduled_end = ? WHERE id = ?', [scheduledStart, scheduledEnd, id]);
}

/** Forces a session to 'completed'. Used to heal sessions where both sides
 *  confirmed under an older buggy version but the status never flipped. */
async function forceComplete(id) {
  await query('UPDATE sessions SET status = ? WHERE id = ?', ['completed', id]);
}

/** Hard-deletes a session row (payments/evaluations cascade). Only used for unconfirmed requests. */
async function remove(id) {
  await query('DELETE FROM sessions WHERE id = ?', [id]);
}

/** True when a session overlaps another active session of the same user within a status scope. */
async function hasOverlap({ userId, start, end, excludeSessionId = null }) {
  const params = [userId, userId, end, start];
  let exclude = '';
  if (excludeSessionId) {
    exclude = ' AND id <> ?';
    params.push(excludeSessionId);
  }
  const rows = await query(
    `SELECT id FROM sessions
     WHERE (student_id = ? OR tutor_id = ?)
       AND status IN ('pending','accepted')
       AND scheduled_start < ? AND scheduled_end > ?
       ${exclude}
     LIMIT 1`,
    params
  );
  return rows.length > 0;
}

/** True when the student already has an active (pending/accepted) session with the same tutor for the same subject. */
async function hasActiveBooking({ studentId, tutorId, subjectId }) {
  const rows = await query(
    `SELECT id FROM sessions
     WHERE student_id = ? AND tutor_id = ? AND subject_id = ?
       AND status IN ('pending','accepted')
     LIMIT 1`,
    [studentId, tutorId, subjectId]
  );
  return rows.length > 0;
}

async function countByStatus() {
  return query(
    `SELECT status, COUNT(*) AS total FROM sessions
     GROUP BY status ORDER BY total DESC`
  );
}

async function countBetween(start, end) {
  const rows = await query(
    'SELECT COUNT(*) AS total FROM sessions WHERE created_at >= ? AND created_at <= ?',
    [start, end]
  );
  return rows[0].total;
}

module.exports = { findById, create, updateLearningMode, listForStudent, listForTutor, updateStatus, cancel, confirmCompletion, forceComplete, updateSchedule, remove, hasOverlap, hasActiveBooking, countByStatus, countBetween };