const { query } = require('../config/db');

/**
 * The payout account a tutor says their money should be sent to.
 *
 * Stripe has no API for "pay out to whatever account number you type in", so
 * this is a simple stored record: the app charges every session onto the
 * platform Stripe account and the saved account number is what payouts are
 * sent to when they are released. Only the last four digits are ever returned.
 */

const last4 = (value) => (value ? String(value).slice(-4) : null);

const shape = (row) => ({
  has_account: !!(row && row.payout_account_number),
  account_number_last4: last4(row?.payout_account_number),
  account_name: row?.payout_account_name || null,
  updated_at: row?.payout_updated_at || null
});

async function findByUser(userId) {
  const rows = await query(
    'SELECT payout_account_number, payout_account_name, payout_updated_at FROM users WHERE id = ?',
    [userId]
  );
  return shape(rows[0]);
}

async function upsert(userId, { accountNumber, accountName }) {
  await query(
    `UPDATE users
        SET payout_account_number = ?, payout_account_name = ?, payout_updated_at = NOW()
      WHERE id = ?`,
    [accountNumber, accountName || null, userId]
  );
  return findByUser(userId);
}

async function remove(userId) {
  await query(
    `UPDATE users
        SET payout_account_number = NULL, payout_account_name = NULL, payout_updated_at = NULL
      WHERE id = ?`,
    [userId]
  );
  return findByUser(userId);
}

module.exports = { findByUser, upsert, remove, shape };
