// src/server.js
// Entry point — starts the Express server.

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const chatRoutes    = require('./routes/chat');
const paymentRoutes = require('./routes/payment');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the frontend (public/) as static files
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ─────────────────────────────────────────────────────────────

app.use('/api/chat',    chatRoutes);
app.use('/payment',     paymentRoutes);

// ── Catch-all: serve index.html for any unrecognised route ─────────────────
// (Handles browser navigation / Paystack redirects back to /)

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🍽️  Tasty Bites ChatBot is running!`);
  console.log(`   Local: http://localhost:${PORT}\n`);
});

module.exports = app;
