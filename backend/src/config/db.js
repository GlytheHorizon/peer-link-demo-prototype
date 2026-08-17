require('dotenv').config();
const { Pool, types } = require('pg');

// Supabase (PostgreSQL) connection. Uses the project's direct
// connection string, e.g. postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

// Keep result shapes close to the old mysql2 driver:
// - BIGINT ids / COUNT(*) totals come back as JS numbers, not strings
// - NUMERIC scores/ratings come back as JS numbers
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10))); // int8
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v))); // numeric

// Normalize sql: '?' placeholders become $1, $2, ...
// Array params (e.g. IN (?)) are expanded into individual placeholders.
function buildQuery(sql, params = []) {
  let text = sql;
  const values = [];
  let index = 0;
  for (const p of params) {
    if (Array.isArray(p)) {
      if (p.length === 0) {
        text = text.replace('?', 'NULL');
      } else {
        const placeholders = p.map(() => `$${++index}`).join(', ');
        text = text.replace('?', placeholders);
        values.push(...p);
      }
    } else {
      text = text.replace('?', `$${++index}`);
      values.push(p);
    }
  }
  return { text, values };
}

const FIRST_WORD = /^\s*(INSERT|UPDATE|DELETE|SELECT|WITH)/i;

// Shape results like the old mysql2 driver:
//   SELECT / WITH -> rows array
//   INSERT -> { insertId, affectedRows }  (RETURNING id appended when missing)
//   UPDATE / DELETE -> { affectedRows }
async function run(client, sql, params = []) {
  const { text, values } = buildQuery(sql, params);
  let finalText = text;
  const kind = (text.match(FIRST_WORD) || [])[1];
  if (kind && kind.toUpperCase() === 'INSERT' && !/\bRETURNING\b/i.test(text)) {
    finalText = `${text} RETURNING id`;
  }
  const result = await client.query(finalText, values);
  if (!kind) return result.rows;
  switch (kind.toUpperCase()) {
    case 'INSERT':
      return { insertId: result.rows[0] ? result.rows[0].id : null, affectedRows: result.rowCount };
    case 'UPDATE':
    case 'DELETE':
      return { affectedRows: result.rowCount };
    default:
      return result.rows;
  }
}

/**
 * Run a parameterized query and return rows (or a result header for writes).
 * @param {string} sql
 * @param {Array} params
 */
function query(sql, params = []) {
  return run(pool, sql, params);
}

/**
 * Run a query inside a transaction with automatic rollback on error.
 * @param {Function} fn receives a single client
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Escapes a LIKE term safely for parameterized queries (backslash is Postgres' default escape). */
function likeEscape(term) {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Runs a statement on a raw transaction client and returns a
 * normalized result ({ insertId, affectedRows } for writes, rows for reads).
 */
function qex(client, sql, params = []) {
  return run(client, sql, params);
}

module.exports = { pool, query, withTransaction, likeEscape, qex };
