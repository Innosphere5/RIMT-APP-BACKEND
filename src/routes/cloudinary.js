/**
 * Cloudinary Routes — /api/cloudinary/*
 * Server-side upload signature generation (keeps API secret safe).
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'gytf7gmz';
const API_KEY = process.env.CLOUDINARY_API_KEY || '233416524174115';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

/**
 * POST /api/cloudinary/sign
 * Body: { folder: string }
 * Returns: { signature, timestamp, api_key, cloud_name, folder }
 */
router.post('/sign', async (req, res) => {
  try {
    if (!API_SECRET) {
      return res.status(503).json({ error: 'Cloudinary API secret is not configured on the server.' });
    }

    const body = req.body || {};
    const folder = typeof body.folder === 'string' ? body.folder : '';

    if (!/^rimt-academic-trust\/[A-Z0-9_-]{1,32}$/.test(folder)) {
      return res.status(400).json({ error: 'A valid student upload folder is required.' });
    }

    const timestamp = body.timestamp || Math.floor(Date.now() / 1000);
    const stringToSign = `folder=${folder}&timestamp=${timestamp}${API_SECRET}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    res.json({ signature, timestamp, api_key: API_KEY, cloud_name: CLOUD_NAME, folder });
  } catch (err) {
    console.error('[POST /api/cloudinary/sign] Error:', err);
    res.status(500).json({ error: 'Failed to generate upload signature.' });
  }
});

module.exports = router;
