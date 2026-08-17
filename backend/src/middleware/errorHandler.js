const { ApiError } = require('../utils/http');

/** Central error handler — never leaks internals to clients. */
function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      details: err.details || undefined
    });
  }

  // PostgreSQL unique violation (23505) -> 409 Conflict
  if (err && err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'A record with the same unique value already exists'
    });
  }

  // Other PostgreSQL constraint errors (23503 FK, 23514 CHECK, ...) -> 500 with safe message
  if (err && typeof err.code === 'string' && err.code.startsWith('23')) {
    console.error('[DB_ERROR]', err);
    return res.status(500).json({
      success: false,
      message: 'A database error occurred'
    });
  }

  console.error('[UNHANDLED]', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
}

/** 404 for unknown routes. */
function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFound };