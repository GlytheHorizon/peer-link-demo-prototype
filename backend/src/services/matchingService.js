const tutorModel = require('../models/tutorModel');
const matchModel = require('../models/matchModel');
const evaluationModel = require('../models/evaluationModel');
const { query } = require('../config/db');

const WEIGHTS = {
  subject: 40,
  proficiency: 20,
  courseYear: 15,
  availability: 15,
  rating: 10
};

/**
 * Weight components of a compatibility score (0-100).
 * subject: tutor teaches the requested subject (all-or-nothing, 40)
 * proficiency: tutor subject proficiency/5 * 20
 * courseYear: tutor course == student course -> 10; student year within tutor range -> 5
 * availability: tutor has recorded weekly availability -> count of days with slots / 7 * 15
 * rating: tutor average evaluation rating / 5 * 10 (0 when none)
 */
function computeScore({ tutor, subjectEntry, studentCourse, studentYear, ratingMap }) {
  const breakdown = { subject: 0, proficiency: 0, courseYear: 0, availability: 0, rating: 0 };

  if (subjectEntry) {
    breakdown.subject = WEIGHTS.subject;
    breakdown.proficiency = Math.round(((subjectEntry.proficiency || 3) / 5) * WEIGHTS.proficiency * 100) / 100;
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

  const ratingInfo = ratingMap.get(tutor.tutor_profile_id);
  if (ratingInfo && ratingInfo.avg_rating) {
    breakdown.rating = Math.round((ratingInfo.avg_rating / 5) * WEIGHTS.rating * 100) / 100;
  }

  const total = Math.round(
    (breakdown.subject + breakdown.proficiency + breakdown.courseYear + breakdown.availability + breakdown.rating) * 100
  ) / 100;

  return { total, breakdown };
}

/**
 * Runs the automated matching algorithm on the backend.
 * For each subject (single subjectId, or all of the student's subjects),
 * every eligible tutor is scored and the result upserted into matches.
 * Returns results sorted by descending compatibility score.
 */
async function generateMatches(studentProfileId, subjectId = null) {
  const student = await query('SELECT year_level, course FROM student_profiles WHERE id = ?', [studentProfileId]);
  if (!student[0]) {
    const err = new Error('Student profile not found');
    err.status = 404;
    throw err;
  }

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

  const tutors = await tutorModel.getAllTutors();
  const tutorIds = tutors.map((t) => t.tutor_profile_id);
  let tutorSubjects = [];
  if (tutorIds.length > 0) {
    tutorSubjects = await query(
      `SELECT ts.tutor_profile_id, ts.subject_id, ts.proficiency
       FROM tutor_subjects ts WHERE ts.tutor_profile_id IN (?)`,
      [tutorIds]
    );
  }
  const ratingRows = await evaluationModel.ratingSummaryByTutor();
  const ratingMap = new Map(ratingRows.map((r) => [r.user_id, r]));

  const results = [];
  for (const tutor of tutors) {
    const teaches = tutorSubjects.filter((ts) => ts.tutor_profile_id === tutor.tutor_profile_id);
    for (const requestedId of subjectIds) {
      const entry = teaches.find((ts) => ts.subject_id === requestedId);
      if (!entry) continue;
      const { total, breakdown } = computeScore({
        tutor,
        subjectEntry: entry,
        studentCourse: student[0].course,
        studentYear: student[0].year_level,
        ratingMap
      });
      if (total <= 0) continue;
      await matchModel.upsert({
        studentProfileId,
        tutorProfileId: tutor.tutor_profile_id,
        subjectId: requestedId,
        score: total,
        breakdown
      });
      results.push({
        subject_id: requestedId,
        tutor_profile_id: tutor.tutor_profile_id,
        tutor_name: `${tutor.first_name} ${tutor.last_name}`,
        score: total,
        breakdown
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

module.exports = { generateMatches, computeScore, WEIGHTS };