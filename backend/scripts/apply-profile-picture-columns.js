/**
 * Adds the `profile_picture` column to student_profiles and tutor_profiles.
 * Safe to re-run: it skips tables that already have the column.
 *
 * Run from the backend folder: node scripts/apply-profile-picture-columns.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'peerlink'
  });

  for (const table of ['student_profiles', 'tutor_profiles']) {
    const [rows] = await conn.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'profile_picture'`,
      [table]
    );
    if (rows.length) {
      console.log(`${table}.profile_picture already exists`);
    } else {
      await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN profile_picture VARCHAR(255) NULL`);
      console.log(`${table}.profile_picture added`);
    }
  }

  await conn.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
