/**
 * FCM Routes — /api/fcm/*
 * Push notification token registration and send.
 */

const express = require('express');
const router = express.Router();
const { registerFCMToken, sendFCMPushNotification } = require('../services/fcmService');

/**
 * POST /api/fcm/register
 * Body: { roll_no, token, device_platform?, token_type? }
 */
router.post('/register', async (req, res) => {
  try {
    const { roll_no, token, device_platform, token_type } = req.body;

    if (!roll_no || !token) {
      return res.status(400).json({ error: 'roll_no and token are required.' });
    }

    const result = await registerFCMToken({
      rollNo: roll_no,
      token,
      devicePlatform: device_platform || 'android',
      tokenType: token_type || 'fcm',
    });

    res.json({ success: result.success, message: 'FCM token registered successfully', roll_no: result.roll_no });
  } catch (err) {
    console.error('[POST /api/fcm/register] Error:', err);
    res.status(500).json({ error: 'Failed to register FCM token.', details: err.message });
  }
});

/**
 * POST /api/fcm/send
 * Body: { title, message, type?, priority?, data?, topic?, targetToken? }
 */
router.post('/send', async (req, res) => {
  try {
    const { title, message, type, priority, data, topic, targetToken } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'title and message are required.' });
    }

    const result = await sendFCMPushNotification({
      title, message,
      type: type || 'general',
      priority: priority || 'HIGH',
      data: data || {},
      topic: targetToken ? null : (topic || 'all_students'),
      targetToken: targetToken || null,
    });

    if (result.success) {
      res.json({ success: true, messageId: result.messageId, recipientCount: result.recipientCount });
    } else {
      res.status(500).json(result);
    }
  } catch (err) {
    console.error('[POST /api/fcm/send] Error:', err);
    res.status(500).json({ error: 'Failed to send FCM push notification.', details: err.message });
  }
});

module.exports = router;
