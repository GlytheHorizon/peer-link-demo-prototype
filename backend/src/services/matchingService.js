const tutorModel = require('../models/tutorModel');
const matchModel = require('../models/matchModel');
const evaluationModel = require('../models/evaluationModel');
const { query } = require('../config/db');

const RATE_CAP = 500;

const WEIGHTS = {
  subject: 35,
  proficiency: 25,
  rate: 15,
  courseYear: 15,
  availability: 5,
  rating: 5
};

/**
 * Weight components of a compatibility score (0-100).
 * subject: tutor teaches the requested subject (all-or-nothing, 35)
 * proficiency: tutor subject proficiency/5 * 25
 * rate: tutor hourly rate, inverted (cheaper = higher), capped at RATE_CAP, 15
 * courseYear: tutor course == student course -> 10; student year within tutor range -> 5
 * availability: tutor has recorded weekly availability -> count of days with slots / 7 * 5
 * rating: tutor average evaluation rating / 5 * 5 (0 when none)
 */
function computeScore({ tutor, subjectEntry, studentCourse, studentYear, ratingMap }) {
  const breakdown = { subject: 0, proficiency: 0, rate: 0, courseYear: 0, availability: 0, rating: 0 };

  if (subjectEntry) {
    breakdown.subject = WEIGHTS.subject;
    breakdown.proficiency = Math.round(((subjectEntry.proficiency || 3) / 5) * WEIGHTS.proficiency * 100) / 100;
    const rate = subjectEntry.rate_per_hour == null ? 100 : Number(subjectEntry.rate_per_hour);
    const capped = Math.max(0, Math.min(rate, RATE_CAP));
    breakdown.rate = Math.round((1 - capped / RATE_CAP) * WEIGHTS.rate * 100) / 100;
  }

  if (tutor.course && studentCourse && String(tutor.course).toLowerCase() === String(studentCourse).toLowerCase()) {
    breakdown.courseYear += 10;
  }
  if (!studentYear || studentYear <= (tutor.max_year_level || 5)) {
    breakdown.courseYear += 5;
  }

  const availability = tutor.availability || null;
  if (availability && typeof availability === 'object') {
    const days = Object.keys(availability).filter((d) => Array.isArray(availability[d]) && availability[d].length > 0);
    if (days.length > 0) {
      breakdown.availability = Math.round((days.length / 7) * WEIGHTS.availability * 100) / 100;
    }
  }

  const ratingInfo = ratingMap.get(tutor.user_id);
  if (ratingInfo && ratingInfo.avg_rating) {
    breakdown.rating = Math.round((ratingInfo.avg_rating / 5) * WEIGHTS.rating * 100) / 100;
  }

  const total = Math.round(
    (breakdown.subject + breakdown.proficiency + breakdown.rate + breakdown.courseYear + breakdown.availability + breakdown.rating) * 100
  ) / 100;

  return { total, breakdown };
}

/** Loads active tutors with their taught subjects and rating summaries. */
async function loadTutorCatalog() {
  const tutors = await tutorModel.getAllTutors();
  const tutorIds = tutors.map((t) => t.tutor_profile_id);
  let tutorSubjects = [];
  if (tutorIds.length > 0) {
    tutorSubjects = await query(
      `SELECT ts.tutor_profile_id, ts.subject_id, ts.proficiency, ts.rate_per_hour
       FROM tutor_subjects ts WHERE ts.tutor_profile_id IN (?)`,
      [tutorIds]
    );
  }
  const ratingRows = await evaluationModel.ratingSummaryByTutor();
  return { tutors, tutorSubjects, ratingMap: new Map(ratingRows.map((r) => [r.user_id, r])) };
}

/**
 * Scores every tutor against the given subjects (and optionally a tutor name query),
 * without persisting anything. Returns rows sorted by descending compatibility score.
 * A tutor row is included when the tutor teaches one of `subjectIds` OR when the
 * tutor's name matches `nameQuery` (in which case all their taught subjects are included).
 */
async function scoreTutors(studentProfileId, subjectIds, nameQuery = null) {
  const student = await query('SELECT year_level, course FROM student_profiles WHERE id = ?', [studentProfileId]);
  if (!student[0]) {
    const err = new Error('Student profile not found');
    err.status = 404;
    throw err;
  }

  const { tutors, tutorSubjects, ratingMap } = await loadTutorCatalog();

  const q = nameQuery ? String(nameQuery).trim().toLowerCase() : null;

  const results = [];
  for (const tutor of tutors) {
    const nameMatches = !!q && `${tutor.first_name} ${tutor.last_name}`.toLowerCase().includes(q);
    const teaches = tutorSubjects.filter((ts) => ts.tutor_profile_id === tutor.tutor_profile_id);
    for (const entry of teaches) {
      if (!nameMatches && !subjectIds.some((id) => Number(id) === Number(entry.subject_id))) continue;
      const { total, breakdown } = computeScore({
        tutor,
        subjectEntry: entry,
        studentCourse: student[0].course,
        studentYear: student[0].year_level,
        ratingMap
      });
      if (total <= 0) continue;
      const ratingInfo = ratingMap.get(tutor.user_id);
      results.push({
        subject_id: entry.subject_id,
        tutor_profile_id: tutor.tutor_profile_id,
        tutor_name: `${tutor.first_name} ${tutor.last_name}`,
        score: total,
        breakdown,
        rate_per_hour: entry.rate_per_hour != null ? Number(entry.rate_per_hour) : 100,
        avg_rating: ratingInfo ? ratingInfo.avg_rating : 0,
        rating_count: ratingInfo ? ratingInfo.rating_count : 0,
        tags: Array.isArray(tutor.tags) ? tutor.tags : [],
        learning_mode: tutor.learning_mode || null
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Runs the automated matching algorithm on the backend.
 * For each subject (single subjectId, or all of the student's subjects),
 * every eligible tutor is scored and the result upserted into matches.
 * Returns results sorted by descending compatibility score.
 */
async function generateMatches(studentProfileId, subjectId = null) {
  let subjectIds = [];
  if (subjectId) {
    const chk = await query('SELECT id FROM subjects WHERE id = ?', [subjectId]);
    if (!chk[0]) {
      const err = new Error('Subject not found');
      err.status = 404;
      throw err;
    }
    subjectIds = [subjectId];
  } else {
    const rows = await query('SELECT subject_id FROM student_subjects WHERE student_profile_id = ?', [studentProfileId]);
    subjectIds = rows.map((r) => r.subject_id);
  }

  const results = await scoreTutors(studentProfileId, subjectIds, null);
  for (const r of results) {
    await matchModel.upsert({
      studentProfileId,
      tutorProfileId: r.tutor_profile_id,
      subjectId: r.subject_id,
      score: r.score,
      breakdown: r.breakdown
    });
  }
  return results;
}

/**
 * Catalog-wide listing of tutors and the subjects they teach — no student profile
 * and no compatibility scoring, so manual search works for anyone browsing.
 * `subjectIds` (when given) restricts the listing to those subjects; `nameQuery`
 * also includes tutors whose name matches (for every subject they teach) and,
 * when no subject scope is given, subjects whose name/code contains the query.
 * Rows are sorted by average rating then tutor name.
 */
async function browseTutors(subjectIds = null, nameQuery = null) {
  const { tutors, tutorSubjects, ratingMap } = await loadTutorCatalog();
  const q = nameQuery ? String(nameQuery).trim().toLowerCase() : null;
  const scoped = Array.isArray(subjectIds) && subjectIds.length > 0;

  let qSubjectIds = null;
  if (q && !scoped) {
    const like = `%${q}%`;
    const rows = await query(
      `SELECT id FROM subjects WHERE LOWER(name) LIKE ? OR LOWER(code) LIKE ?`,
      [like, like]
    );
    qSubjectIds = new Set(rows.map((r) => Number(r.id)));
  }

  const results = [];
  for (const tutor of tutors) {
    const nameMatches = !!q && `${tutor.first_name} ${tutor.last_name}`.toLowerCase().includes(q);
    const teaches = tutorSubjects.filter((ts) => ts.tutor_profile_id === tutor.tutor_profile_id);
    for (const entry of teaches) {
      const sid = Number(entry.subject_id);
      const subjectMatches = scoped
        ? subjectIds.some((id) => Number(id) === sid)
        : !q || qSubjectIds.has(sid);
      if (!subjectMatches && !nameMatches) continue;
      const ratingInfo = ratingMap.get(tutor.user_id);
      results.push({
        subject_id: entry.subject_id,
        tutor_profile_id: tutor.tutor_profile_id,
        tutor_name: `${tutor.first_name} ${tutor.last_name}`,
        score: null,
        breakdown: null,
        rate_per_hour: entry.rate_per_hour != null ? Number(entry.rate_per_hour) : 100,
        avg_rating: ratingInfo ? ratingInfo.avg_rating : 0,
        rating_count: ratingInfo ? ratingInfo.rating_count : 0,
        tags: Array.isArray(tutor.tags) ? tutor.tags : [],
        learning_mode: tutor.learning_mode || null
      });
    }
  }

  return results.sort((a, b) => (b.avg_rating - a.avg_rating) || a.tutor_name.localeCompare(b.tutor_name));
}

/**
 * Free-text search across ALL subjects and tutor names — does not persist matches
 * and does not reference the student profile. When `subjectId` is given the search
 * is scoped to that subject; otherwise subjects whose name/code contains `q` are
 * matched. Tutors whose name matches `q` are included for every subject they teach.
 */
async function searchTutors(q, subjectId = null) {
  return browseTutors(subjectId ? [subjectId] : null, q);
}

module.exports = { generateMatches, searchTutors, browseTutors, computeScore, WEIGHTS };
