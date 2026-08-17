/** Application error with an HTTP status code. */
class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Wraps an async route handler so thrown errors reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/** Consistent JSON response shape. */
const ok = (res, status = 200, data = null, message = 'Success') =>
  res.status(status).json({ success: true, message, data });

module.exports = { ApiError, asyncHandler, ok };