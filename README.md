# Tasty Bites Restaurant ChatBot

AltSchool Africa Backend Engineering Assessment 3

## Overview

A restaurant chatbot built with Node.js and Express. Customers interact through a chat interface to browse a menu, build an order, and pay via Paystack. Sessions are tracked per device using localStorage so no login is needed. All data is stored in a JSON file.

## Tech Stack

- Node.js
- Express
- Paystack API (payment processing)
- UUID (session and order ID generation)
- Axios (HTTP requests to Paystack)
- dotenv (environment variables)
- JSON file storage (no database)

## Project Structure

```
restaurant-chatbot/
├── src/
│   ├── server.js
│   ├── routes/
│   │   ├── chat.js
│   │   └── payment.js
│   ├── controllers/
│   │   ├── chatController.js
│   │   └── paymentController.js
│   └── data/
│       ├── menu.js
│       └── store.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data/
│   └── store.json
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## How It Works

The chatbot runs as a state machine with three states.

**IDLE** is the default state. The user sees the main menu options and can enter a command.

**MENU** is entered when the user types `1`. The full restaurant menu is displayed and the user can type item numbers to add them to their cart. They can keep adding items and the cart total updates after each one.

**AWAITING_EMAIL** is entered when the user types `99` and has items in their cart. The bot asks for an email address before initiating payment. Once a valid email is provided, a Pay Now button is shown.

## Commands

| Input | Action |
|-------|--------|
| `1` | Place an order / show menu |
| `99` | Checkout current cart |
| `98` | View order history |
| `97` | View current cart |
| `0` | Cancel and clear cart |

## Payment Flow

1. User types `99` with items in cart
2. Bot shows order summary and asks for email
3. User enters email, bot shows Pay Now button
4. Button click sends a request to `/api/payment/initialize`
5. Server calls Paystack API and returns an authorization URL
6. Browser redirects to Paystack checkout page
7. After payment, Paystack redirects to `/payment/callback`
8. Server verifies the transaction with Paystack
9. On success, order moves to history and user is redirected back with a confirmation message

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/welcome` | Returns the welcome message |
| POST | `/api/chat/message` | Processes a user message and returns a bot response |
| POST | `/api/payment/initialize` | Initializes a Paystack transaction |
| GET | `/payment/callback` | Handles Paystack redirect after payment |

## Environment Variables

```
PORT=3000
BASE_URL=http://localhost:3000
PAYSTACK_SECRET_KEY=sk_test_your_key_here
```