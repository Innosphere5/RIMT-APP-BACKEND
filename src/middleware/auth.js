/**
 * Authentication Middleware
 * Validates JWT Bearer tokens on protected routes.
 * Injects `req.student` with decoded token payload.
 */

const { verifyToken } = require('../utils/jwt');

/**
 * Require authentication — blocks unauthenticated requests.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in.',
      code: 'AUTH_REQUIRED',
    });
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'Invalid or expired session token. Please sign in again.',
      code: 'TOKEN_INVALID',
    });
  }

  // Inject student info into request for downstream handlers
  req.student = {
    id: decoded.sub,
    roll_no: decoded.roll_no,
    status: decoded.status,
  };

  next();
}

/**
 * Optional authentication — allows unauthenticated access but injects student if token present.
 */
function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.student = {
        id: decoded.sub,
        roll_no: decoded.roll_no,
        status: decoded.status,
      };
    }
  }

  next();
}

/**
 * Require APPROVED status — blocks pending/rejected students.
 */
function requireApproved(req, res, next) {
  if (!req.student) {
    return res.status(401).json({
      error: 'Authentication required.',
      code: 'AUTH_REQUIRED',
    });
  }

  if (req.student.status !== 'APPROVED') {
    return res.status(403).json({
      error: 'Your account has not been approved by university administration. Access denied.',
      code: 'NOT_APPROVED',
    });
  }

  next();
}

module.exports = { requireAuth, optionalAuth, requireApproved };
