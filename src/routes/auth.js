/**
 * Auth Routes — /api/auth/*
 * Handles student signup, signin, status check, and signout.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { validateSignupPayload, validateRollNo } = require('../utils/validators');
const {
  signUpStudent,
  signInStudent,
  checkStudentApprovalStatus,
  checkSupabaseConnection,
} = require('../services/authService');

// Rate limit auth endpoints: 20 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

/**
 * POST /api/auth/signup
 * Body: { name, rollNo, department, batch, avatarUrl? }
 */
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { name, fullName, rollNo, rollNumber, department, course, batch, yearSemester, avatar_url } = req.body;

    const validation = validateSignupPayload({
      name: name || fullName,
      rollNo: rollNo || rollNumber,
      department: department || course,
      batch: batch || yearSemester,
    });

    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await signUpStudent({
      name: validation.cleaned.name,
      rollNo: validation.cleaned.rollNo,
      department: validation.cleaned.department,
      batch: validation.cleaned.batch,
      avatarUrl: avatar_url,
    });

    const statusCode = result.success ? (result.status === 'PENDING' ? 201 : 200) : 409;
    res.status(statusCode).json(result);
  } catch (err) {
    console.error('[POST /api/auth/signup] Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Registration failed.' });
  }
});

/**
 * POST /api/auth/signin
 * Body: { rollNo }
 */
router.post('/signin', authLimiter, async (req, res) => {
  try {
    const { rollNo, roll_no, rollNumber } = req.body;
    const validation = validateRollNo(rollNo || roll_no || rollNumber);

    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await signInStudent({ rollNo: validation.rollNo });

    if (result.success) {
      return res.json(result);
    }

    const statusCode = result.status === 'PENDING' ? 202 : result.status === 'REJECTED' || result.status === 'REVOKED' ? 403 : 401;
    res.status(statusCode).json(result);
  } catch (err) {
    console.error('[POST /api/auth/signin] Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Sign in failed.' });
  }
});

/**
 * GET /api/auth/status/:rollNo
 * Check approval status of a pending student.
 */
router.get('/status/:rollNo', async (req, res) => {
  try {
    const validation = validateRollNo(req.params.rollNo);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await checkStudentApprovalStatus({ rollNo: validation.rollNo });
    res.json(result);
  } catch (err) {
    console.error('[GET /api/auth/status] Error:', err);
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

/**
 * POST /api/auth/signout
 * Invalidates session (client should discard token).
 */
router.post('/signout', requireAuth, (_req, res) => {
  // JWT tokens are stateless — client is responsible for discarding.
  // Server-side token blacklisting can be added later with Redis.
  res.json({ success: true, message: 'Signed out successfully.' });
});

/**
 * GET /api/auth/health
 * Check Supabase database connectivity.
 */
router.get('/health', async (_req, res) => {
  try {
    const status = await checkSupabaseConnection();
    res.json(status);
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

module.exports = router;
