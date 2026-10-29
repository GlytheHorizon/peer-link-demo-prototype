const { getStripeSafe } = require('../config/stripe');
const { ApiError } = require('../utils/http');

/**
 * Session card charges.
 *
 * Every charge is created on the platform's own Stripe account, so the money
 * lands in the PeerLink Stripe dashboard (test mode = test balance only).
 * Amounts are entered in PHP in the app and converted to USD before the
 * charge, because the Stripe account charges in USD.
 */

/** PHP per 1 USD. Override with PHP_PER_USD in backend/.env. */
function phpPerUsd() {
  const rate = Number(process.env.PHP_PER_USD || 58);
  return Number.isFinite(rate) && rate > 0 ? rate : 58;
}

/** Converts a PHP amount into USD cents (Stripe's smallest unit). */
function toUsdCents(amountPhp) {
  const usd = Number(amountPhp) / phpPerUsd();
  return Math.max(1, Math.round(usd * 100));
}

/** Converts PHP to a USD amount rounded to cents. */
function toUsd(amountPhp) {
  return Math.round((Number(amountPhp) / phpPerUsd()) * 100) / 100;
}

/** Maps raw Stripe errors to friendly, actionable messages. */
function friendlyChargeError(err) {
  const rawMessage = err?.raw?.message || err?.message || 'The card could not be charged';
  const declineCode = String(err?.decline_code || err?.raw?.decline_code || '').toLowerCase();

  const DECLINES = {
    card_declined: 'Your card was declined. Please try a different card.',
    expired_card: 'Your card has expired. Please use a different card.',
    incorrect_cvc: "Your card's security code is incorrect.",
    incorrect_number: 'Your card number is incorrect.',
    insufficient_funds: 'Insufficient funds on your card.',
    processing_error: 'An error occurred while processing your card. Please try again.'
  };

  // Known, specific decline reasons -> friendly message + 402 (still the
  // student's card to fix, so 402 is right for declines).
  if (DECLINES[declineCode]) {
    return { status: 402, message: DECLINES[declineCode] };
  }

  // Gateway auth problems are server-side, not the student's card.
  const isAuthError = err?.type === 'authentication_error' || err?.code === 'invalid_api_key' || err?.code === 'api_key_expired';
  if (isAuthError) {
    return { status: 503, message: 'Payment could not be processed — the Stripe gateway key is invalid or expired. Please contact support.' };
  }

  // Anything else (network, invalid request, etc.)
  const status = Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 402;
  return { status, message: rawMessage };
}

/**
 * Charges the student's card on the platform account.
 *
 * @returns {{ paymentIntentId: string, amountPhp: number, amountUsd: number, fxRate: number, currency: string }}
 */
async function chargeCard({ paymentMethodId, amountPhp, description, metadata }) {
  const amount = Number(amountPhp);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'Payment amount must be greater than zero');
  }

  let stripe;
  try {
    stripe = getStripeSafe();
  } catch (err) {
    // A missing Stripe key must not bubble up as a raw error -> generic 500.
    throw new ApiError(503, `Stripe is not configured — payments cannot be processed: ${err?.message || err}`);
  }
  const rate = phpPerUsd();
  const amountUsdCents = toUsdCents(amount);

  let intent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: amountUsdCents,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      // Only cards are accepted here — never allow redirect-based methods.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      description: description || 'PeerLink session payment',
      metadata: {
        ...(metadata || {}),
        amount_php: String(amount),
        php_per_usd: String(rate)
      }
    });
  } catch (err) {
    // Declines and invalid cards are the student's to fix.
    const { status, message } = friendlyChargeError(err);
    throw new ApiError(status, message);
  }

  if (intent.status !== 'succeeded') {
    throw new ApiError(402, `The card payment was not completed (status: ${intent.status})`);
  }

  return {
    paymentIntentId: intent.id,
    amountPhp: amount,
    amountUsd: amountUsdCents / 100,
    fxRate: rate,
    currency: 'usd'
  };
}

/** Refunds a card charge back to the student. */
async function refundCharge(paymentIntentId) {
  if (!paymentIntentId) return null;
  const stripe = getStripeSafe();
  try {
    return await stripe.refunds.create({ payment_intent: paymentIntentId });
  } catch (err) {
    console.error('[stripe] refund failed for', paymentIntentId, err?.message || err);
    return null;
  }
}

module.exports = { phpPerUsd, toUsd, toUsdCents, chargeCard, refundCharge };
