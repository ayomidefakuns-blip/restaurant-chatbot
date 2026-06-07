// src/routes/chat.js

const express = require('express');
const router  = express.Router();
const { handleMessage, getWelcome } = require('../controllers/chatController');

// GET /api/chat/welcome
// Called when the page loads — returns the initial welcome message
router.get('/welcome', (req, res) => {
  const { deviceId } = req.query;
  if (!deviceId || !deviceId.trim()) {
    return res.status(400).json({ error: 'deviceId is required' });
  }
  return res.json({ text: getWelcome() });
});

// POST /api/chat/message
// Called each time the user sends a message
router.post('/message', async (req, res) => {
  const { deviceId, message } = req.body;

  if (!deviceId || !deviceId.trim()) {
    return res.status(400).json({ error: 'deviceId is required' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const result = await handleMessage(deviceId.trim(), message.trim());
    return res.json(result);
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    return res.status(500).json({ text: '❌ Something went wrong. Please try again.' });
  }
});

module.exports = router;
