/**
 * JWT Utility — Token Generation & Verification
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rimt-backend-jwt-secret-2026-dev';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a signed JWT for authenticated student sessions.
 * @param {{ id: string, roll_no: string, status: string }} payload
 * @returns {string} Signed JWT
 */
function generateToken(payload) {
  return jwt.sign(
    {
      sub: payload.id,
      roll_no: payload.roll_no,
      status: payload.status,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {{ sub: string, roll_no: string, status: string } | null}
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { generateToken, verifyToken, JWT_SECRET };
