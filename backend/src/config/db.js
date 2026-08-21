require('dotenv').config();
const mysql = require('mysql2/promise');

// MySQL connection pool setup (compatible with phpMyAdmin / local MySQL / MariaDB)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'peerlink',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
  dateStrings: true
});

const FIRST_WORD = /^\s*(INSERT|UPDATE|DELETE|SELECT|WITH)/i;

/**
 * Run a parameterized query and return rows (or a result header for writes).
 * @param {string} sql
 * @param {Array} params
 */
async function query(sql, params = []) {
  const [results] = await pool.query(sql, params);
  const kind = (sql.match(FIRST_WORD) || [])[1];
  if (!kind) return results;
  switch (kind.toUpperCase()) {
    case 'INSERT':
      return { insertId: results.insertId, affectedRows: results.affectedRows };
    case 'UPDATE':
    case 'DELETE':
      return { affectedRows: results.affectedRows };
    default:
      return results;
  }
}

/**
 * Run a query inside a transaction with automatic rollback on error.
 * @param {Function} fn receives a single connection client
 */
async function withTransaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/** Escapes a LIKE term safely for parameterized queries (backslash is MySQL's default escape). */
function likeEscape(term) {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Runs a statement on a raw transaction connection and returns a
 * normalized result ({ insertId, affectedRows } for writes, rows for reads).
 */
async function qex(connection, sql, params = []) {
  const [results] = await connection.query(sql, params);
  const kind = (sql.match(FIRST_WORD) || [])[1];
  if (!kind) return results;
  switch (kind.toUpperCase()) {
    case 'INSERT':
      return { insertId: results.insertId, affectedRows: results.affectedRows };
    case 'UPDATE':
    case 'DELETE':
      return { affectedRows: results.affectedRows };
    default:
      return results;
  }
}

module.exports = { pool, query, withTransaction, likeEscape, qex };

