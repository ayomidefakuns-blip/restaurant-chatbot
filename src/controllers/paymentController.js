// src/controllers/paymentController.js
// Handles Paystack payment initialization and verification.
//
// Flow:
//  1. User types 99 → bot asks for email
//  2. User enters email → bot shows "Pay Now" button
//  3. User clicks "Pay Now" → POST /api/payment/initialize
//  4. Server calls Paystack API → gets authorization_url
//  5. Browser redirects to Paystack checkout page
//  6. User completes payment → Paystack redirects to GET /payment/callback
//  7. Server verifies the reference → moves order to history
//  8. Server redirects back to / with ?payment=success

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const {
  getUser,
  saveUser,
  setPendingPayment,
  getPendingPayment,
  clearPendingPayment,
} = require('../data/store');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const BASE_URL        = process.env.BASE_URL || 'http://localhost:3000';

// ── Initialize payment ─────────────────────────────────────────────────────

async function initializePayment(deviceId) {
  const user = getUser(deviceId);

  if (!user.customerEmail)      throw new Error('No email on file. Please go through checkout again.');
  if (!user.currentOrder.length) throw new Error('Cart is empty.');

  const total       = user.currentOrder.reduce((s, i) => s + i.price, 0);
  const amountKobo  = total * 100; // Paystack uses kobo (1 NGN = 100 kobo)
  const reference   = `tastybites-${Date.now()}-${uuidv4().slice(0, 6)}`;
  const callbackUrl = `${BASE_URL}/payment/callback`;

  // Call Paystack initialize endpoint
  const response = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    {
      email:        user.customerEmail,
      amount:       amountKobo,
      reference,
      callback_url: callbackUrl,
      currency:     'NGN',
      channels:     ['card', 'bank', 'ussd', 'bank_transfer'],
    },
    {
      headers: {
        Authorization:  `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.data.status) {
    throw new Error(response.data.message || 'Paystack initialization failed');
  }

  const { authorization_url } = response.data.data;

  // Persist pending payment so we can verify it on callback
  setPendingPayment(reference, {
    deviceId,
    items: user.currentOrder,
    total,
    email: user.customerEmail,
  });

  user.pendingReference = reference;
  saveUser(deviceId, user);

  return { authorizationUrl: authorization_url, reference };
}

// ── Verify payment ─────────────────────────────────────────────────────────

async function verifyPayment(reference) {
  // Look up which user this reference belongs to
  const pending = getPendingPayment(reference);
  if (!pending) {
    // Reference unknown — could be a duplicate callback or a replay attack
    console.warn(`[Payment] Unknown reference: ${reference}`);
    return { success: false };
  }

  // Ask Paystack to confirm the payment
  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
  );

  const tx = response.data.data;

  if (tx.status !== 'success') {
    console.warn(`[Payment] Reference ${reference} status: ${tx.status}`);
    return { success: false, deviceId: pending.deviceId };
  }

  // ✅ Payment confirmed — update user record
  const { deviceId, items, total, email } = pending;
  const user = getUser(deviceId);

  user.orderHistory.push({
    id:        uuidv4(),
    items,
    total,
    date:      new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
    paid:      true,
    reference,
    email,
  });
  user.currentOrder     = [];
  user.pendingReference = null;
  user.customerEmail    = null;
  user.state            = 'IDLE';
  saveUser(deviceId, user);

  // Remove from pending ledger
  clearPendingPayment(reference);

  console.log(`[Payment] ✅ Payment verified for device ${deviceId}, ref ${reference}`);
  return { success: true, deviceId };
}

module.exports = { initializePayment, verifyPayment };
