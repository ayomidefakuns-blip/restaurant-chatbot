// src/data/store.js
// JSON file-based storage — no native dependencies, works on all platforms.
// All user data is keyed by deviceId (generated in the browser and sent with each request).

const fs   = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// ── Helpers ────────────────────────────────────────────────────────────────

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ _pending: {} }, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {
    return { _pending: {} };
  }
}

function writeStore(data) {
  ensureStore();
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── User data ──────────────────────────────────────────────────────────────

/**
 * Returns the user object for a given deviceId.
 * Creates a fresh record if it doesn't exist yet.
 *
 * User shape:
 * {
 *   state: 'IDLE' | 'MENU' | 'AWAITING_EMAIL',
 *   currentOrder:    [{ id, name, price }],
 *   orderHistory:    [{ id, items, total, date, paid, reference, email }],
 *   customerEmail:   string | null,
 *   pendingReference: string | null,
 * }
 */
function getUser(deviceId) {
  const store = readStore();
  if (!store[deviceId]) {
    store[deviceId] = {
      state: 'IDLE',
      currentOrder: [],
      orderHistory: [],
      customerEmail: null,
      pendingReference: null,
    };
    writeStore(store);
  }
  return store[deviceId];
}

function saveUser(deviceId, userData) {
  const store = readStore();
  store[deviceId] = userData;
  writeStore(store);
}

// ── Pending payment ledger ─────────────────────────────────────────────────
// Stores { deviceId, items, total, email } keyed by Paystack reference.
// This lets us look up the right user when Paystack calls our callback.

function setPendingPayment(reference, payload) {
  const store = readStore();
  if (!store._pending) store._pending = {};
  store._pending[reference] = { ...payload, createdAt: new Date().toISOString() };
  writeStore(store);
}

function getPendingPayment(reference) {
  const store = readStore();
  return (store._pending && store._pending[reference]) || null;
}

function clearPendingPayment(reference) {
  const store = readStore();
  if (store._pending && store._pending[reference]) {
    delete store._pending[reference];
    writeStore(store);
  }
}

module.exports = {
  getUser,
  saveUser,
  setPendingPayment,
  getPendingPayment,
  clearPendingPayment,
};
