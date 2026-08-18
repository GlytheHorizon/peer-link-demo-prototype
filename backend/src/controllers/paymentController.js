const { asyncHandler, ok } = require('../utils/http');
const paymentModel = require('../models/paymentModel');

/** GET /api/payments/mine — student payment stats + history. */
const mine = asyncHandler(async (req, res) => {
  const data = await paymentModel.studentSummary(req.user.id);
  ok(res, 200, data);
});

module.exports = { mine };