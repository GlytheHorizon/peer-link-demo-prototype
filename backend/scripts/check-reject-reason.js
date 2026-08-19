require('dotenv').config();
const { pool } = require('../src/config/db');

(async () => {
  try {
    const rows = await pool.query(
      `SELECT s.id, s.status, s.reject_reason,
              CONCAT(st.first_name, ' ', st.last_name) AS student_name,
              CONCAT(tt.first_name, ' ', tt.last_name) AS tutor_name,
              sub.name AS subject_name
       FROM sessions s
       JOIN users st ON st.id = s.student_id
       JOIN users tt ON tt.id = s.tutor_id
       JOIN subjects sub ON sub.id = s.subject_id
       WHERE s.status = 'rejected'
       ORDER BY s.id DESC`
    );
    console.log(JSON.stringify(rows.rows, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
})();
