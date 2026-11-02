/**
 * Notification Routes — /api/notifications/*
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { validateNotificationPayload } = require('../utils/validators');
const {
  fetchNotifications,
  createNotification,
  markNotificationAsRead,
  deleteNotification,
} = require('../services/notificationService');

/**
 * GET /api/notifications
 * Query: ?type=all|internship|drive|announcement &q=search
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { type, q } = req.query;
    const notifications = await fetchNotifications({ type: type || 'all', search: q || '' });
    res.json({ success: true, count: notifications.length, notifications });
  } catch (err) {
    console.error('[GET /api/notifications] Error:', err);
    res.status(500).json({ error: 'Failed to retrieve notifications.', details: err.message });
  }
});

/**
 * POST /api/notifications
 * Body: { title, message, type?, priority?, target_type?, data?, action_route?, created_by? }
 */
router.post('/', async (req, res) => {
  try {
    const validation = validateNotificationPayload(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const created = await createNotification(req.body);
    res.status(201).json({ success: true, message: 'Notification published successfully', notification: created });
  } catch (err) {
    console.error('[POST /api/notifications] Error:', err);
    res.status(500).json({ error: 'Failed to publish notification.', details: err.message });
  }
});

/**
 * POST /api/notifications/:id/read
 * Body: { roll_no }
 */
router.post('/:id/read', optionalAuth, async (req, res) => {
  try {
    const rollNo = req.body.roll_no || req.student?.roll_no || 'anon';
    const result = await markNotificationAsRead(req.params.id, rollNo);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/notifications/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await deleteNotification(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
