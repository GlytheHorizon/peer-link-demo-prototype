require('dotenv').config();
const { pool } = require('../src/config/db');

const BASE = process.env.PUBLIC_API_URL || 'http://localhost:5000/api';

(async () => {
  try {
    await pool.query("UPDATE sessions SET status = 'pending', reject_reason = NULL WHERE id = 1");

    const login = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gerome@peerlink.edu', password: 'Tutor@123' })
    });
    const loginJson = await login.json();
    const token = loginJson.data?.token;
    if (!token) { console.log('LOGIN FAILED:', loginJson.message); return; }
    console.log('logged in as tutor');

    const reject = await fetch(`${BASE}/sessions/1/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ decision: 'rejected', reason: 'HTTP test: I have class at that time' })
    });
    const rejectJson = await reject.json();
    console.log('reject response:', reject.status, rejectJson.message);
    console.log('reject_reason in response:', rejectJson.data?.reject_reason);

    const after = await pool.query('SELECT status, reject_reason FROM sessions WHERE id = 1');
    console.log('DB after:', after.rows[0]);
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
})();