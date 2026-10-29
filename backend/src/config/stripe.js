const Stripe = require('stripe');

let _stripe = null;
let _initError = null;

function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    _initError = new Error('STRIPE_SECRET_KEY is not set. Stripe is unavailable.');
    throw _initError;
  }
  try {
    // Let the SDK use its own pinned API version — passing an outdated
    // apiVersion string breaks on newer SDK releases.
    _stripe = new Stripe(key);
    _initError = null;
  } catch (err) {
    _initError = err;
    throw err;
  }
  return _stripe;
}

/** True when Stripe is configured (test mode still counts). */
function isConfigured() {
  try {
    getStripe();
    return true;
  } catch {
    return false;
  }
}

/** The error from the last failed Stripe init, or null. */
function getInitError() {
  return _initError;
}

/**
 * Same as getStripe(), but converts a missing/invalid key into a clean error
 * the API layer can turn into a friendly response (503) instead of an unhandled
 * raw error that surfaces as a generic 500 to the client.
 */
function getStripeSafe() {
  try {
    return getStripe();
  } catch (err) {
    const friendly = new Error(err && err.message ? err.message : 'Stripe is not configured');
    friendly.code = 'STRIPE_NOT_CONFIGURED';
    throw friendly;
  }
}

/** Presentment currency for session charges (Stripe wants lowercase). */
function currency() {
  return String(process.env.STRIPE_CURRENCY || 'php').toLowerCase();
}

module.exports = { getStripe, getStripeSafe, isConfigured, getInitError, currency };
