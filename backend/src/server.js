const app = require('./app');
const config = require('./config');
const { pool } = require('./config/db');

async function start() {
  // Fail fast if the database is unreachable.
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log('[DB] Connected to MySQL');

  app.listen(config.port, () => {
    console.log(`[API] PeerLink backend running on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('[STARTUP] Failed to start server:', err.message);
  process.exit(1);
});