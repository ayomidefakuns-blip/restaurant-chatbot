// src/routes/payment.js

const express = require('express');
const router  = express.Router();
const { initializePayment, verifyPayment } = require('../controllers/paymentController');

// POST /api/payment/initialize
// Frontend calls this when user clicks "Pay Now"
// Returns the Paystack authorization URL to redirect the user to
router.post('/initialize', async (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId || !deviceId.trim()) {
    return res.status(400).json({ error: 'deviceId is required' });
  }

  // Block if Paystack key is not configured
  if (!process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY.includes('your_paystack')) {
    console.warn('[Payment] PAYSTACK_SECRET_KEY not configured');
    return res.status(503).json({
      error: 'Payment is not configured yet. Add your PAYSTACK_SECRET_KEY to the .env file.',
    });
  }

  try {
    const result = await initializePayment(deviceId.trim());
    return res.json(result);
  } catch (err) {
    console.error('[Payment] Init error:', err.response?.data || err.message);
    return res.status(500).json({
      error: err.message || 'Payment initialization failed. Please try again.',
    });
  }
});

// GET /payment/callback
// Paystack redirects the user here after payment (success OR failure)
// Query params: ?reference=xxx&trxref=xxx
router.get('/callback', async (req, res) => {
  const { reference, trxref } = req.query;
  const ref = reference || trxref;

  if (!ref) {
    return res.redirect('/?payment=failed');
  }

  try {
    const result = await verifyPayment(ref);
    if (result.success) {
      return res.redirect(`/?payment=success&deviceId=${encodeURIComponent(result.deviceId)}`);
    }
    return res.redirect('/?payment=failed');
  } catch (err) {
    console.error('[Payment] Callback error:', err.response?.data || err.message);
    return res.redirect('/?payment=failed');
  }
});

module.exports = router;
