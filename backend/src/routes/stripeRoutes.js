const { Router } = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const { asyncHandler, ok, ApiError } = require('../utils/http');
const { getStripeSafe, isConfigured, getInitError } = require('../config/stripe');
const { query } = require('../config/db');
const payoutAccountController = require('../controllers/payoutAccountController');

const router = Router();

// config is public — it only returns the publishable key and test-mode flag.
router.get('/config', (req, res) => {
  try {
    const configured = isConfigured();
    res.json({
      success: true,
      data: {
        publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || null,
        secret_configured: configured,
        test_mode: process.env.STRIPE_SECRET_KEY ? String(process.env.STRIPE_SECRET_KEY).startsWith('sk_test_') : true,
        stripe_init_error: configured ? null : (getInitError()?.message || null)
      }
    });
  } catch (err) {
    console.error('[stripe/config] unexpected error:', err && err.stack || err);
    res.status(500).json({
      success: false,
      message: 'Stripe config endpoint failed',
      stripe_init_error: err && err.message || String(err)
    });
  }
});

router.use(protect);

// ---- handler implementations (declared first, used below) ----

/**
 * GET /api/stripe/customer — returns (or creates) the Stripe customer id for
 * the current user. Store it locally so we can attach saved payment methods.
 */
const getOrCreateCustomer = async (userId, email) => {
  let row = await query('SELECT stripe_customer_id FROM users WHERE id = ?', [userId]);
  let customerId = row?.[0]?.stripe_customer_id;

  if (!customerId) {
    const stripe = getStripeSafe();
    const customer = await stripe.customers.create({
      email,
      metadata: { peerlink_user_id: String(userId) }
    });
    customerId = customer.id;
    await query('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, userId]);
  }

  return customerId;
};

const attachPaymentMethod = asyncHandler(async (req, res) => {
  const { payment_method_id, set_default = false } = req.body || {};

  if (!payment_method_id || typeof payment_method_id !== 'string') {
    throw new ApiError(400, 'Validation failed', ['payment_method_id: string is required']);
  }

  const stripe = getStripeSafe();
  const customerId = await getOrCreateCustomer(req.user.id, req.user.email);

  // Attach to the user's Stripe customer
  await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });

  // Optionally make it the default for future reuse.
  if (set_default) {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id }
    });
  }

  // Return a clean local record so the frontend can show what's saved.
  const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);

  // Persist a lightweight local record of saved methods for the user (so the
  // Payment tab can list what's linked without hitting Stripe every render).
  const existing = await query(
    'SELECT id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default FROM user_payment_methods WHERE user_id = ? AND stripe_payment_method_id = ?',
    [req.user.id, payment_method_id]
  );

  if (!existing.length) {
    const pmBrand = (paymentMethod.card?.brand || '').toUpperCase();
    await query(
      `INSERT INTO user_payment_methods (user_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        payment_method_id,
        pmBrand,
        paymentMethod.card?.last4 || null,
        paymentMethod.card?.exp_month || null,
        paymentMethod.card?.exp_year || null,
        set_default ? 1 : 0
      ]
    );
  } else if (set_default) {
    await query(
      'UPDATE user_payment_methods SET is_default = 0 WHERE user_id = ?',
      [req.user.id]
    );
    await query(
      'UPDATE user_payment_methods SET is_default = 1 WHERE user_id = ? AND stripe_payment_method_id = ?',
      [req.user.id, payment_method_id]
    );
  }

  ok(res, 200, {
    id: payment_method_id,
    brand: paymentMethod.card?.brand || null,
    last4: paymentMethod.card?.last4 || null,
    exp_month: paymentMethod.card?.exp_month || null,
    exp_year: paymentMethod.card?.exp_year || null,
    attached: true
  }, 'Payment method attached');
});

const patchDefaultPaymentMethod = asyncHandler(async (req, res) => {
  const { id, set_default = false } = req.body || {};
  if (!id || typeof id !== 'string') {
    throw new ApiError(400, 'Validation failed', ['id: string is required']);
  }

  const stripe = getStripeSafe();
  const customerId = await getOrCreateCustomer(req.user.id, req.user.email);

  // Confirm it belongs to this user before touching Stripe defaults.
  const local = await query(
    'SELECT stripe_payment_method_id FROM user_payment_methods WHERE id = ? AND user_id = ?',
    [id, req.user.id]
  );
  if (!local.length) {
    // Try by raw stripe id as a fallback.
    const byStripe = await query(
      'SELECT id FROM user_payment_methods WHERE stripe_payment_method_id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (!byStripe.length) {
      throw new ApiError(404, 'Saved payment method not found');
    }
  }

  // Only attach if it is not already on this customer. In test mode a
  // freshly-created pm_ is unattached; one returned from list/retrieve may
  // already be attached.
  const existingOnCustomer = await stripe.customers.retrieve(customerId).then(
    (c) => c && c.invoice_settings && c.invoice_settings.default_payment_method === id
  ).catch(() => false);
  if (!existingOnCustomer) {
    try {
      await stripe.paymentMethods.attach(id, { customer: customerId });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (msg.includes('already attached') || msg.includes('Invoice already has a default'))
        { /* already attached — continue */ }
      else throw err;
    }
  }
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: id }
  });

  await query('UPDATE user_payment_methods SET is_default = 0 WHERE user_id = ?', [req.user.id]);
  await query(
    'UPDATE user_payment_methods SET is_default = 1 WHERE user_id = ? AND stripe_payment_method_id = ?',
    [req.user.id, id]
  );

  ok(res, 200, null, 'Default payment method updated');
});

const listSaved = asyncHandler(async (req, res) => {
  const rows = await query(
    'SELECT id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default, created_at FROM user_payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
    [req.user.id]
  );

  if (!rows.length) {
    return ok(res, 200, [], 'No saved payment methods');
  }

  ok(res, 200, rows, 'Saved payment methods');
});

const detachPaymentMethod = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const local = await query(
    'SELECT stripe_payment_method_id FROM user_payment_methods WHERE id = ? AND user_id = ?',
    [id, req.user.id]
  );
  if (!local.length) {
    throw new ApiError(404, 'Saved payment method not found');
  }

  const stripe = getStripeSafe();
  await stripe.paymentMethods.detach(local[0].stripe_payment_method_id);

  await query('DELETE FROM user_payment_methods WHERE id = ? AND user_id = ?', [id, req.user.id]);

  ok(res, 200, null, 'Payment method removed');
});

// ---- route registration (after all handlers are declared) ----

/** POST /api/stripe/payment-method — attach a Stripe Payment Method to the
 * current user's Stripe customer so it can be reused for future sessions.
 *
 * Body: { payment_method_id, set_default: true }
 *
 * This is the "link a payment method" step. In sandbox mode no money moves.
 */
router.post('/payment-method', attachPaymentMethod);

/** PATCH /api/stripe/payment-method — set default on an already-attached method. */
router.patch('/payment-method', patchDefaultPaymentMethod);

/** GET /api/stripe/saved — list payment methods saved to the current user. */
router.get('/saved', listSaved);

/** DELETE /api/stripe/payment-method/:id — detach a saved payment method. */
router.delete('/payment-method/:id', detachPaymentMethod);

/** Payout account (account number the tutor's money is sent to). */
router.get('/payout-account', restrictTo('tutor'), payoutAccountController.getAccount);
router.put('/payout-account', restrictTo('tutor'), payoutAccountController.saveAccount);
router.delete('/payout-account', restrictTo('tutor'), payoutAccountController.deleteAccount);

module.exports = router;
