require('dotenv').config();
const { pool } = require('../src/config/db');
const sessionController = require('../src/controllers/sessionController');

// Simulate: tutor rejects session 1 with a reason, through the same code path as the UI.
(async () => {
  try {
    await pool.query("UPDATE sessions SET status = 'pending', reject_reason = NULL WHERE id = 1");
    const session = await pool.query('SELECT * FROM sessions WHERE id = 1');
    console.log('before:', { status: session.rows[0].status, reject_reason: session.rows[0].reject_reason });

    const tutorRow = await pool.query('SELECT * FROM users WHERE id = (SELECT tutor_id FROM sessions WHERE id = 1)');
    const req = {
      user: tutorRow.rows[0],
      params: { id: '1' },
      body: { decision: 'rejected', reason: 'Sorry, I have a conflict at that time' }
    };
    let captured = null;
    const res = {
      status: (code) => ({ json: (data) => { captured = { code, data }; } })
    };
    await sessionController.respond(req, res);
    console.log('controller result:', JSON.stringify(captured, null, 2));

    const after = await pool.query('SELECT status, reject_reason FROM sessions WHERE id = 1');
    console.log('after:', after.rows[0]);
  } catch (err) {
    console.error('ERROR:', err.response?.data || err.message);
  } finally {
    await pool.end();
  }
})();