// src/controllers/chatController.js
// All chatbot logic lives here.
//
// State machine:
//   IDLE           → user sees main menu
//   MENU           → user is browsing and selecting food items
//   AWAITING_EMAIL → user needs to enter email before payment

const menu           = require('../data/menu');
const { getUser, saveUser } = require('../data/store');

// ── Formatters ─────────────────────────────────────────────────────────────

const fmt = (n) => `₦${Number(n).toLocaleString('en-NG')}`;

// ── Static text ────────────────────────────────────────────────────────────

const MAIN_MENU_OPTIONS = `Select an option:\n\n` +
  `*1*  — 🍽️  Place an order\n` +
  `*99* — 💳  Checkout\n` +
  `*98* — 📋  Order history\n` +
  `*97* — 🛒  View current order\n` +
  `*0*  — ❌  Cancel order`;

const WELCOME_MSG =
  `👋 Welcome to *Tasty Bites Restaurant!* 🍽️\n\n` +
  `We serve the best Nigerian dishes, freshly prepared just for you.\n\n` +
  MAIN_MENU_OPTIONS;

// ── Message builders ───────────────────────────────────────────────────────

function buildMenuMsg() {
  let msg = `🍽️ *Our Menu*\n\nType an item number to add it to your cart:\n\n`;
  menu.forEach(({ id, name, price }) => {
    msg += `*${id}.* ${name} — ${fmt(price)}\n`;
  });
  msg += `\n──────────────────────────\n`;
  msg += `*99* checkout  |  *97* view cart  |  *0* cancel`;
  return msg;
}

function buildCartMsg(items) {
  if (!items.length) {
    return `🛒 *Your cart is empty.*\n\nType *1* to start ordering.`;
  }
  const total = items.reduce((s, i) => s + i.price, 0);
  let msg = `🛒 *Current Order* (${items.length} item${items.length > 1 ? 's' : ''})\n\n`;
  items.forEach(({ name, price }, idx) => {
    msg += `${idx + 1}. ${name} — ${fmt(price)}\n`;
  });
  msg += `\n💰 *Total: ${fmt(total)}*\n\n`;
  msg += `*99* checkout  |  *0* cancel`;
  return msg;
}

function buildHistoryMsg(history) {
  if (!history.length) {
    return `📋 *Order History*\n\nNo previous orders found.\n\nType *1* to place your first order.`;
  }
  let msg = `📋 *Order History* (${history.length} order${history.length > 1 ? 's' : ''})\n\n`;
  // Show most recent first
  [...history].reverse().forEach((order, idx) => {
    msg += `*Order #${history.length - idx}* — ${order.date}\n`;
    order.items.forEach(({ name, price }) => {
      msg += `  • ${name} — ${fmt(price)}\n`;
    });
    msg += `  💰 Total: ${fmt(order.total)}\n`;
    msg += `  Status: ${order.paid ? '✅ Paid' : '⏳ Unpaid'}\n\n`;
  });
  return msg.trim();
}

// ── Main handler ───────────────────────────────────────────────────────────

/**
 * Processes a message from the user and returns a response.
 * @param {string} deviceId  - unique device identifier from the browser
 * @param {string} rawMessage - raw text typed by the user
 * @returns {{ text: string, showPayButton?: boolean }}
 */
async function handleMessage(deviceId, rawMessage) {
  const input = rawMessage.trim();
  const user  = getUser(deviceId);

  // ────────────────────────────────────────────────
  // STATE: AWAITING_EMAIL
  // ────────────────────────────────────────────────
  if (user.state === 'AWAITING_EMAIL') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailRegex.test(input)) {
      // Valid email — save it and prompt payment
      user.customerEmail = input;
      user.state = 'IDLE';
      saveUser(deviceId, user);

      const total = user.currentOrder.reduce((s, i) => s + i.price, 0);
      let msg = `✅ Email saved!\n\nHere's your final order summary:\n\n`;
      user.currentOrder.forEach(({ name, price }, idx) => {
        msg += `${idx + 1}. ${name} — ${fmt(price)}\n`;
      });
      msg += `\n💰 *Total: ${fmt(total)}*\n\nClick the button below to complete payment:`;

      return { text: msg, showPayButton: true };
    }

    // Invalid email
    return {
      text: `❌ That doesn't look like a valid email address.\n\nPlease enter a valid email (e.g. john@example.com):`,
    };
  }

  // ────────────────────────────────────────────────
  // COMMAND: 99 — Checkout
  // ────────────────────────────────────────────────
  if (input === '99') {
    if (!user.currentOrder.length) {
      user.state = 'IDLE';
      saveUser(deviceId, user);
      return { text: `❌ *No order to checkout.*\n\nYour cart is empty.\n\nType *1* to start ordering.` };
    }

    const total = user.currentOrder.reduce((s, i) => s + i.price, 0);
    let msg = `📦 *Order Summary*\n\n`;
    user.currentOrder.forEach(({ name, price }, idx) => {
      msg += `${idx + 1}. ${name} — ${fmt(price)}\n`;
    });
    msg += `\n💰 *Total: ${fmt(total)}*\n\nPlease enter your *email address* to proceed with payment:`;

    user.state = 'AWAITING_EMAIL';
    saveUser(deviceId, user);
    return { text: msg };
  }

  // ────────────────────────────────────────────────
  // COMMAND: 98 — Order history
  // ────────────────────────────────────────────────
  if (input === '98') {
    // Don't change state — user may want to continue ordering
    return { text: buildHistoryMsg(user.orderHistory) };
  }

  // ────────────────────────────────────────────────
  // COMMAND: 97 — View current order
  // ────────────────────────────────────────────────
  if (input === '97') {
    return { text: buildCartMsg(user.currentOrder) };
  }

  // ────────────────────────────────────────────────
  // COMMAND: 0 — Cancel order
  // ────────────────────────────────────────────────
  if (input === '0') {
    if (!user.currentOrder.length) {
      return { text: `ℹ️ You have no active order to cancel.\n\nType *1* to place an order.` };
    }
    user.currentOrder = [];
    user.state = 'IDLE';
    saveUser(deviceId, user);
    return { text: `✅ *Order cancelled successfully.*\n\nYour cart has been cleared.\n\n${MAIN_MENU_OPTIONS}` };
  }

  // ────────────────────────────────────────────────
  // COMMAND: 1 — Place an order (or add item #1 if already in MENU mode)
  // ────────────────────────────────────────────────
  if (input === '1') {
    if (user.state === 'MENU') {
      // In menu mode → add item 1 (Jollof Rice)
      return addItemToCart(user, deviceId, 1);
    }
    // Not in menu mode → enter menu mode
    user.state = 'MENU';
    saveUser(deviceId, user);
    return { text: buildMenuMsg() };
  }

  // ────────────────────────────────────────────────
  // Menu item selection (2 – menu.length)
  // ────────────────────────────────────────────────
  const num = parseInt(input, 10);
  if (user.state === 'MENU' && !isNaN(num) && num >= 2 && num <= menu.length) {
    return addItemToCart(user, deviceId, num);
  }

  // ────────────────────────────────────────────────
  // Invalid input
  // ────────────────────────────────────────────────
  if (user.state === 'MENU') {
    return {
      text: `❓ Invalid item number. Choose *1–${menu.length}* to add an item.\n\n` +
            `*99* checkout  |  *97* view cart  |  *0* cancel`,
    };
  }

  return { text: `❓ *Invalid option.*\n\n${MAIN_MENU_OPTIONS}` };
}

// ── Helper: add item to cart ───────────────────────────────────────────────

function addItemToCart(user, deviceId, itemId) {
  const item = menu.find((m) => m.id === itemId);
  if (!item) {
    return { text: `❓ Item not found. Please choose a number from 1 to ${menu.length}.` };
  }

  user.currentOrder.push({ id: item.id, name: item.name, price: item.price });
  saveUser(deviceId, user);

  const total     = user.currentOrder.reduce((s, i) => s + i.price, 0);
  const itemCount = user.currentOrder.length;

  return {
    text: `✅ *${item.name}* added to cart!\n\n` +
          `🛒 ${itemCount} item${itemCount > 1 ? 's' : ''} in cart — ${fmt(total)}\n\n` +
          `Add more items or type *99* to checkout.`,
  };
}

// ── Welcome message ────────────────────────────────────────────────────────

function getWelcome() {
  return WELCOME_MSG;
}

module.exports = { handleMessage, getWelcome };
