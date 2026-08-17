const { asyncHandler, ok } = require('../utils/http');
const activityLogModel = require('../models/activityLogModel');
const log = require('../services/activityLogService').log;

/** GET /api/activity-logs — admin only. */
const listLogs = asyncHandler(async (req, res) => {
  const { user_id, action, page, limit } = req.query;
  const data = await activityLogModel.list({
    userId: user_id ? Number(user_id) : undefined,
    action,
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(Number(limit) || 50, 200)
  });
  log(req, 'activity_logs.view', 'activity_log');
  ok(res, 200, data);
});

module.exports = { listLogs };