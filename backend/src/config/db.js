require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'peerlink',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z'
});

/**
 * Run a parameterized query and return rows.
 * Uses pool.query so that array params expand correctly for IN (?) clauses.
 * @param {string} sql
 * @param {Array} params
 */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Run a query inside a transaction with automatic rollback on error.
 * @param {Function} fn receives a single connection
 */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Escapes a LIKE term safely for parameterized queries. */
function likeEscape(term) {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Runs a statement on a raw transaction connection and returns the
 * ResultSetHeader (normalizes mysql2's [rows, fields] tuple form).
 */
async function qex(conn, sql, params = []) {
  const result = await conn.execute(sql, params);
  return Array.isArray(result) ? result[0] : result;
}

module.exports = { pool, query, withTransaction, likeEscape, qex };