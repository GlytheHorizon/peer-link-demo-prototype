const { ApiError } = require('../utils/http');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Throws a 400 ApiError when any validation fails. */
function validate(rules, body) {
  const errors = [];
  for (const [field, checks] of Object.entries(rules)) {
    const value = body[field];
    for (const check of checks) {
      const err = check(value, body);
      if (err) {
        errors.push(`${field}: ${err}`);
        break;
      }
    }
  }
  if (errors.length) {
    throw new ApiError(400, 'Validation failed', errors);
  }
}

const v = {
  required: (msg = 'is required') => (v) => (v === undefined || v === null || v === '' ? msg : null),
  email: () => (v) => (v !== undefined && v !== '' && !EMAIL_RE.test(v) ? 'must be a valid email' : null),
  minLen: (n, label) => (v) =>
    v !== undefined && v !== null && typeof v === 'string' && v.trim().length < n ? `must be at least ${n} characters${label ? ` (${label})` : ''}` : null,
  maxLen: (n) => (v) =>
    v !== undefined && v !== null && typeof v === 'string' && v.trim().length > n ? `must be at most ${n} characters` : null,
  isIn: (allowed) => (v) =>
    v !== undefined && v !== null && !allowed.includes(v) ? `must be one of: ${allowed.join(', ')}` : null,
  intRange: (min, max, label = 'value') => (v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return !Number.isInteger(n) || n < min || n > max ? `must be an integer between ${min} and ${max} (${label})` : null;
  },
  date: (label = 'date') => (v) => {
    if (v === undefined || v === null || v === '') return null;
    return Number.isNaN(Date.parse(v)) ? `must be a valid ${label} date/time` : null;
  },
  bool: (label) => (v) => {
    if (v === undefined || v === null || v === '') return null;
    return typeof v === 'boolean' || v === 0 || v === 1 ? null : `must be a boolean (${label})`;
  },
  object: (label) => (v) => {
    if (v === undefined || v === null || v === '') return null;
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? null : `must be an object (${label})`;
  }
};

const nextWeek = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

module.exports = { validate, v, nextWeek };