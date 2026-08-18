const { verifyToken } = require('../utils/jwt');
const { ApiError } = require('../utils/http');
const userModel = require('../models/userModel');

const PRESENCE_THROTTLE_MS = 60 * 1000;

/** Verifies the JWT and attaches the fresh user to req.user. */
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return next(new ApiError(401, 'Authentication required'));
    }
    const payload = verifyToken(header.slice(7));
    const user = await userModel.findById(payload.sub);
    if (!user) {
      return next(new ApiError(401, 'User no longer exists'));
    }
    if (!user.is_active) {
      return next(new ApiError(403, 'Account is deactivated'));
    }
    req.user = user;
    try {
      const last = user.last_seen_at ? new Date(user.last_seen_at).getTime() : 0;
      if (Date.now() - last > PRESENCE_THROTTLE_MS) {
        await userModel.touchLastSeen(user.id);
        user.last_seen_at = new Date();
      }
    } catch {
      /* presence tracking must never block a request */
    }
    next();
  } catch (err) {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
}

/** Restricts the route to one or more roles. Must follow protect(). */
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action'));
  }
  next();
};

module.exports = { protect, restrictTo };