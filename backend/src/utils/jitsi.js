const crypto = require('crypto');

/**
 * Generates a stable, URL-safe Jitsi room name for a session.
 * Format: peerlink-<sessionId>-<6-char random hex>
 * The room name is deterministic only if a seed is provided (used for
 * re-generation), but we call this once and persist it.
 */
function generateJitsiRoomName(sessionId) {
  const rand = crypto.randomBytes(4).toString('hex');
  return `peerlink-${sessionId}-${rand}`;
}

module.exports = { generateJitsiRoomName };
