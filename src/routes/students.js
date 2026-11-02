/**
 * Student Routes — /api/students/*
 * Profile fetch, update, and full dossier retrieval.
 */

const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validateRollNo } = require('../utils/validators');
const { fetchStudentProfile, updateStudentProfile } = require('../services/studentService');
const { getFullStudentData } = require('../services/authService');

/**
 * GET /api/students/profile/:rollNo
 * Fetch student profile by roll number.
 */
router.get('/profile/:rollNo', optionalAuth, async (req, res) => {
  try {
    const validation = validateRollNo(req.params.rollNo);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const student = await fetchStudentProfile(validation.rollNo);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student profile not found.' });
    }

    res.json({ success: true, student });
  } catch (err) {
    console.error('[GET /api/students/profile] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/students/profile/:rollNo
 * Update student profile fields.
 */
router.patch('/profile/:rollNo', requireAuth, async (req, res) => {
  try {
    const validation = validateRollNo(req.params.rollNo);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // Verify the authenticated student is updating their own profile
    if (req.student.roll_no !== validation.rollNo) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own profile.',
      });
    }

    const result = await updateStudentProfile({
      rollNo: validation.rollNo,
      ...req.body,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    console.error('[PATCH /api/students/profile] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/students/full/:rollNo
 * Fetch full student dossier (profile + academics + projects + certificates + internships).
 * This powers the AuthContext real-time sync and ProfileScreen.
 */
router.get('/full/:rollNo', optionalAuth, async (req, res) => {
  try {
    const validation = validateRollNo(req.params.rollNo);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const fullData = await getFullStudentData({ roll_no: validation.rollNo });
    if (!fullData) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    res.json({ success: true, student: fullData });
  } catch (err) {
    console.error('[GET /api/students/full] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
