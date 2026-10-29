/**
 * Sets up the payout-account columns (users) and the card-charge tracking
 * columns (payments, conversation_payments). Safe to re-run.
 *
 * It also drops the unused Stripe Connect columns from an earlier iteration —
 * charges now land on the platform account, so no connected accounts exist.
 *
 * Run from the backend folder: node scripts/apply-stripe-payout-columns.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const ADD = [
  ['users', 'payout_account_number', 'VARCHAR(34) NULL'],
  ['users', 'payout_account_name', 'VARCHAR(120) NULL'],
  ['users', 'payout_updated_at', 'DATETIME NULL'],
  ['payments', 'stripe_payment_intent_id', 'VARCHAR(100) NULL'],
  ['payments', 'charged_amount_usd', 'DECIMAL(10,2) NULL'],
  ['payments', 'charged_currency', 'VARCHAR(3) NULL'],
  ['payments', 'fx_rate', 'DECIMAL(10,4) NULL'],
  ['conversation_payments', 'stripe_payment_intent_id', 'VARCHAR(100) NULL'],
  ['conversation_payments', 'charged_amount_usd', 'DECIMAL(10,2) NULL'],
  ['conversation_payments', 'charged_currency', 'VARCHAR(3) NULL'],
  ['conversation_payments', 'fx_rate', 'DECIMAL(10,4) NULL']
];

const DROP = [
  ['users', 'stripe_account_id'],
  ['users', 'stripe_details_submitted'],
  ['users', 'stripe_payouts_enabled'],
  ['users', 'stripe_charges_enabled']
];

async function hasColumn(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'peerlink'
  });

  for (const [table, column, definition] of ADD) {
    if (await hasColumn(conn, table, column)) {
      console.log(`${table}.${column} already exists`);
      continue;
    }
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`${table}.${column} added`);
  }

  for (const [table, column] of DROP) {
    if (!(await hasColumn(conn, table, column))) continue;
    await conn.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
    console.log(`${table}.${column} dropped (unused Connect column)`);
  }

  await conn.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
