const activityLogModel = require('../models/activityLogModel');

/** Fire-and-forget activity log writer. Never throws into request flow. */
function log(req, action, entityType = null, entityId = null, details = null, actorId = null) {
  activityLogModel
    .insert({
      userId: actorId ?? (req.user ? req.user.id : null),
      action,
      entityType,
      entityId,
      details,
      ip: req.ip || req.connection?.remoteAddress || null
    })
    .catch((err) => console.error('[LOG_FAILED]', action, err.message));
}

module.exports = { log };