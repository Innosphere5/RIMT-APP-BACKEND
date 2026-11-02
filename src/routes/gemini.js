/**
 * Gemini Routes — /api/gemini/*
 * Server-side proxy for Google Gemini AI API.
 * Protects API keys from client-side exposure.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { analyzeResume } = require('../services/geminiService');

// Rate limit AI endpoints: 10 requests per 15 minutes per IP
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'AI analysis rate limit reached. Please try again in a few minutes.' },
});

/**
 * POST /api/gemini/analyze-resume
 * Body: { resumeText: string, targetRole?: string }
 * Returns: ATS analysis JSON
 */
router.post('/analyze-resume', aiLimiter, optionalAuth, async (req, res) => {
  try {
    const { resumeText, targetRole } = req.body;

    if (!resumeText || typeof resumeText !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'resumeText (string) is required in the request body.',
      });
    }

    const result = await analyzeResume(resumeText, targetRole || 'Software Engineer');

    if (result.success) {
      res.json(result);
    } else {
      res.status(result.error?.includes('not configured') ? 503 : 500).json(result);
    }
  } catch (err) {
    console.error('[POST /api/gemini/analyze-resume] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
