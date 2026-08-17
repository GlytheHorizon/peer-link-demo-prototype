const app = require('./app');
const config = require('./config');
const { pool } = require('./config/db');

async function start() {
  // Fail fast if the database is unreachable.
  const conn = await pool.connect();
  await conn.query('SELECT 1');
  conn.release();
  console.log('[DB] Connected to Supabase (PostgreSQL)');

  app.listen(config.port, () => {
    console.log(`[API] PeerLink backend running on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('[STARTUP] Failed to start server:', err.message);
  process.exit(1);
});