// public/app.js
// Frontend logic for the Tasty Bites ChatBot.

// ── Device ID ──────────────────────────────────────────────────────────────
// Each browser gets a unique ID stored in localStorage.
// This is how the server tracks session data without logins.

function getDeviceId() {
  let id = localStorage.getItem('tastybites_deviceId');
  if (!id) {
    // Generate a unique ID: timestamp + random string
    id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('tastybites_deviceId', id);
  }
  return id;
}

const DEVICE_ID  = getDeviceId();
const chatBody   = document.getElementById('chatBody');
const input      = document.getElementById('messageInput');
const sendBtn    = document.getElementById('sendBtn');
const statusText = document.getElementById('statusText');

// ── Markdown-lite formatter ────────────────────────────────────────────────
// Converts *bold* and _italic_ and newlines from the API response to HTML.

function formatText(raw) {
  // Escape HTML special chars first to prevent XSS
  let s = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // *bold*
  s = s.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
  // _italic_
  s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  // newlines → <br>
  s = s.replace(/\n/g, '<br>');

  return s;
}

// ── Time helper ────────────────────────────────────────────────────────────

function now() {
  return new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

// ── Render a message bubble ────────────────────────────────────────────────

function addMessage(text, sender, { showPayButton = false } = {}) {
  const row = document.createElement('div');
  row.className = `message ${sender}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (sender === 'bot') {
    bubble.innerHTML = formatText(text);

    if (showPayButton) {
      const btn = document.createElement('button');
      btn.className   = 'pay-btn';
      btn.textContent = '💳 Pay Now';
      btn.addEventListener('click', () => handlePayment(btn));
      bubble.appendChild(btn);
    }
  } else {
    // User messages — plain text only
    bubble.textContent = text;
  }

  const ts = document.createElement('span');
  ts.className   = 'timestamp';
  ts.textContent = now();

  row.appendChild(bubble);
  row.appendChild(ts);
  chatBody.appendChild(row);
  scrollToBottom();
}

// ── Typing indicator ───────────────────────────────────────────────────────

function showTyping() {
  const row = document.createElement('div');
  row.className = 'message bot';
  row.id = 'typingIndicator';
  row.innerHTML = '<div class="bubble typing"><span></span><span></span><span></span></div>';
  chatBody.appendChild(row);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

// ── Scroll to latest message ───────────────────────────────────────────────

function scrollToBottom() {
  chatBody.scrollTop = chatBody.scrollHeight;
}

// ── Toast (quick notification) ─────────────────────────────────────────────

function showToast(msg) {
  const t = document.createElement('div');
  t.className   = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ── Send a message ─────────────────────────────────────────────────────────

async function sendMessage(text) {
  text = text.trim();
  if (!text) return;

  // Show user bubble
  addMessage(text, 'user');
  input.value = '';
  setInputEnabled(false);
  showTyping();

  try {
    const res  = await fetch('/api/chat/message', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ deviceId: DEVICE_ID, message: text }),
    });

    const data = await res.json();
    hideTyping();

    if (!res.ok) {
      addMessage(data.error || '❌ Something went wrong. Please try again.', 'bot');
    } else {
      addMessage(data.text, 'bot', { showPayButton: data.showPayButton });
    }
  } catch {
    hideTyping();
    addMessage('❌ Network error. Please check your connection and try again.', 'bot');
  }

  setInputEnabled(true);
  input.focus();
}

// ── Handle Pay Now click ───────────────────────────────────────────────────

async function handlePayment(btn) {
  btn.textContent = '⏳ Redirecting to payment…';
  btn.disabled    = true;

  try {
    const res  = await fetch('/api/payment/initialize', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ deviceId: DEVICE_ID }),
    });

    const data = await res.json();

    if (data.authorizationUrl) {
      // Redirect the browser to Paystack's hosted checkout page
      window.location.href = data.authorizationUrl;
    } else {
      addMessage(`❌ ${data.error || 'Payment could not be started. Please try again.'}`, 'bot');
      btn.textContent = '💳 Pay Now';
      btn.disabled    = false;
    }
  } catch {
    addMessage('❌ Network error while starting payment. Please try again.', 'bot');
    btn.textContent = '💳 Pay Now';
    btn.disabled    = false;
  }
}

// ── Handle return from Paystack ────────────────────────────────────────────
// Paystack redirects back to /?payment=success or /?payment=failed

function checkPaymentReturn() {
  const params  = new URLSearchParams(window.location.search);
  const payment = params.get('payment');

  if (!payment) return;

  // Clean up the URL so the params don't persist on refresh
  window.history.replaceState({}, document.title, '/');

  if (payment === 'success') {
    setTimeout(() => {
      addMessage(
        `🎉 *Payment Successful!*\n\n` +
        `Thank you for your order! Your food is being prepared with love. 👨‍🍳\n\n` +
        `Type *98* to view your order history, or *1* to order again.`,
        'bot'
      );
    }, 800);
  } else if (payment === 'failed') {
    setTimeout(() => {
      addMessage(
        `❌ *Payment Failed or Cancelled.*\n\n` +
        `Don't worry — your order is still saved.\n\n` +
        `Type *99* to try payment again, or *0* to cancel your order.`,
        'bot'
      );
    }, 500);
  }
}

// ── Enable / disable input ─────────────────────────────────────────────────

function setInputEnabled(enabled) {
  input.disabled   = !enabled;
  sendBtn.disabled = !enabled;
}

// ── Event listeners ────────────────────────────────────────────────────────

sendBtn.addEventListener('click', () => sendMessage(input.value));

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(input.value);
  }
});

// ── Boot ───────────────────────────────────────────────────────────────────

async function init() {
  try {
    const res  = await fetch(`/api/chat/welcome?deviceId=${encodeURIComponent(DEVICE_ID)}`);
    const data = await res.json();

    statusText.textContent = '● Online';
    addMessage(data.text, 'bot');
  } catch {
    statusText.textContent = '● Offline';
    addMessage('❌ Could not connect to the server. Please refresh the page.', 'bot');
  }

  // Handle any Paystack return after page load
  checkPaymentReturn();

  // Focus input
  input.focus();
}

init();
