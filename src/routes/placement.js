/**
 * Placement Routes — /api/placement-stats/*
 * Placement KPIs, placed students, and registered companies.
 */

const express = require('express');
const router = express.Router();
const {
  fetchPlacementSummary,
  fetchPlacedStudents,
  fetchRegisteredCompanies,
} = require('../services/placementService');

/**
 * GET /api/placement-stats/summary
 */
router.get('/summary', async (_req, res) => {
  try {
    const result = await fetchPlacementSummary();
    res.json(result);
  } catch (err) {
    console.error('[GET /api/placement-stats/summary] Error:', err);
    res.status(500).json({ error: 'Failed to compute placement summary.' });
  }
});

/**
 * GET /api/placement-stats/placed-students
 * Query: ?sort=latest|package &search=... &department=...
 */
router.get('/placed-students', async (req, res) => {
  try {
    const { sort, search, department } = req.query;
    const students = await fetchPlacedStudents({ sort, search, department });
    res.json({ success: true, count: students.length, students });
  } catch (err) {
    console.error('[GET /api/placement-stats/placed-students] Error:', err);
    res.status(500).json({ error: 'Failed to fetch placed students.' });
  }
});

/**
 * GET /api/placement-stats/companies
 * Query: ?category=all|tier1|consulting|bfsi|it|core &search=...
 */
router.get('/companies', async (req, res) => {
  try {
    const { category, search } = req.query;
    const companies = await fetchRegisteredCompanies({ category, search });
    res.json({ success: true, count: companies.length, companies });
  } catch (err) {
    console.error('[GET /api/placement-stats/companies] Error:', err);
    res.status(500).json({ error: 'Failed to fetch companies.' });
  }
});

module.exports = router;
