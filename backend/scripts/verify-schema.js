/**
 * Imports database/schema.sql into a scratch database (default: peerlink_schema_check)
 * to prove a fresh install works. The scratch database is dropped and recreated
 * on every run, so it never touches your real data.
 *
 * Run from the backend folder: node scripts/verify-schema.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SCRATCH_DB = process.env.SCRATCH_DB || 'peerlink_schema_check';
const schemaPath = path.resolve(__dirname, '../../database/schema.sql');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    multipleStatements: true
  });

  await conn.query(`DROP DATABASE IF EXISTS \`${SCRATCH_DB}\``);
  await conn.query(`CREATE DATABASE \`${SCRATCH_DB}\` DEFAULT CHARACTER SET utf8mb4`);
  await conn.query(`USE \`${SCRATCH_DB}\``);

  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await conn.query(sql);
    console.log(`schema.sql imported cleanly into ${SCRATCH_DB}`);
  } catch (err) {
    console.error(`IMPORT FAILED: ${err.message}`);
    if (err.sql) console.error(`near: ${String(err.sql).trim().slice(0, 160)}`);
    await conn.query(`DROP DATABASE IF EXISTS \`${SCRATCH_DB}\``).catch(() => {});
    await conn.end();
    process.exit(1);
  }

  const [tables] = await conn.query(
    'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
    [SCRATCH_DB]
  );
  console.log(`tables (${tables.length}): ${tables.map((t) => t.TABLE_NAME).join(', ')}`);

  const [users] = await conn.query(
    'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
    [SCRATCH_DB, 'users']
  );
  console.log(`users columns: ${users.map((c) => c.COLUMN_NAME).join(', ')}`);

  const [seeded] = await conn.query('SELECT COUNT(*) AS n FROM users');
  console.log(`seeded users: ${seeded[0].n}`);

  await conn.query(`DROP DATABASE \`${SCRATCH_DB}\``);
  await conn.end();
  console.log('OK');
})().catch((err) => {
  console.error('verify-schema failed:', err.message);
  process.exit(1);
});
