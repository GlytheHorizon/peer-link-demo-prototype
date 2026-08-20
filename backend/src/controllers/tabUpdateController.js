const { asyncHandler, ok } = require('../utils/http');
const tabUpdateModel = require('../models/tabUpdateModel');

/** GET /api/tab-updates — latest "something happened" timestamp per sidebar tab. */
const getUpdates = asyncHandler(async (req, res) => {
  const tabs = await tabUpdateModel.latestForUser(req.user.id, req.user.role);
  ok(res, 200, { tabs });
});

module.exports = { getUpdates };