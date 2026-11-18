# ⚡ Enterprise Payment Gateway & Resend Notification Service

A professional, production-grade Node.js & TypeScript payment processing backend architected according to industry standards used by companies like **Amazon**, **Stripe**, and **Shopify**.

Includes **Stripe Checkout & PaymentIntents**, **Idempotent Webhook Processing**, **Automated Transactional HTML Receipts via Resend**, structured logging, and an interactive test dashboard.

---

## 🌟 Key Features

- **Enterprise Payment Flows**:
  - **Stripe Checkout Sessions** (Hosted redirect flow with customer address, tax calculation, and discounts).
  - **Direct PaymentIntents** (For mobile apps, custom embedded elements, and Apple Pay/Google Pay).
  - **Refund Management** (Full and partial refunds with reason codes).
- **Automated Transactional Emails via Resend**:
  - **HTML Order Confirmation Receipt**: Pixel-perfect, responsive receipt email displaying items, subtotal, tax, shipping, total, payment method, and transaction references.
  - **Payment Failure Recovery Alert**: Automated email informing customers of declined payments with retry instructions.
  - **Plaintext Fallback**: Accessible plaintext version for email clients that disallow HTML.
- **Defensive Webhook Architecture**:
  - **Cryptographic Signature Verification**: Validates `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET` using raw buffer preservation.
  - **Idempotency & Deduplication**: Prevents duplicate charges or multiple email deliveries on retransmitted webhook events.
  - **Fast Acknowledgement**: Webhook endpoint immediately acknowledges Stripe (`200 OK`) and processes state transitions reliably.
- **Enterprise Engineering Practices**:
  - **TypeScript (ES2022 / NodeNext)**: 100% strict type safety.
  - **Zod Validation**: Validates all incoming request bodies, params, and environment variables.
  - **Structured Logging (Pino)**: JSON logs in production, pretty-printed in development.
  - **Security Best Practices**: `helmet`, `cors`, distributed `x-request-id` tracing, and `express-rate-limit` to prevent brute-force and card testing attacks.
  - **Zero-Config Development Simulation Mode**: Runs seamlessly out of the box with simulated gateways, and automatically upgrades to live Stripe & Resend when keys are supplied in `.env`.
  - **Interactive Web Dashboard**: Built-in test UI on `http://localhost:5000` to test payments, simulate webhooks, inspect orders, and preview Resend email receipts in real-time.

---

## 📂 Project Architecture

```
d:\others\real-project\
├── public/                         # Interactive Test Dashboard & UI
│   ├── index.html                  # Storefront & Payment Simulator
│   ├── style.css                   # Modern dashboard styling
│   ├── app.js                      # Client checkout logic
│   ├── order-success.html          # Success redirect destination
│   ├── order-cancel.html           # Cancel redirect destination
│   └── checkout-mock.html          # Dev mock checkout portal
├── src/
│   ├── config/
│   │   ├── env.ts                  # Zod-validated environment config
│   │   ├── database.ts             # Mongoose MongoDB connection & lifecycle
│   │   └── logger.ts               # Pino structured logging
│   ├── constants/
│   │   └── order-status.ts         # Order & Payment state enums
│   ├── controllers/
│   │   ├── checkout.controller.ts  # Stripe Checkout Session controller
│   │   ├── payment.controller.ts   # PaymentIntent, refund, & simulation
│   │   ├── webhook.controller.ts   # Stripe raw webhook receiver
│   │   └── order.controller.ts     # Order querying & audit endpoints
│   ├── errors/
│   │   ├── app-error.ts            # Custom operational errors
│   │   └── error-handler.ts        # Centralized Express error handler
│   ├── middlewares/
│   │   ├── rate-limiter.ts         # IP-based rate limiting
│   │   ├── request-id.ts           # Distributed tracing header
│   │   └── validate-request.ts     # Zod request validation middleware
│   ├── models/
│   │   ├── order.model.ts          # Order, Customer, and Item types
│   │   └── order.schema.ts         # Mongoose Schema & Model for MongoDB
│   ├── repositories/
│   │   ├── order.repository.ts     # Primary repository interface & export
│   │   └── mongo-order.repository.ts # MongoDB repository with in-memory fallback
│   ├── services/
│   │   ├── email.service.ts        # Resend SDK integration
│   │   ├── order.service.ts        # Order lifecycle & state machine
│   │   ├── stripe.service.ts       # Stripe SDK client & webhook signer
│   │   └── webhook.service.ts      # Webhook idempotency & event router
│   ├── templates/
│   │   ├── email-receipt.template.ts # Responsive HTML email receipt
│   │   └── email-failed.template.ts  # Payment failure recovery template
│   ├── utils/
│   │   └── formatters.ts           # Currency, date, and order formatting
│   ├── app.ts                      # Express application assembly
│   └── server.ts                   # Server bootstrap & graceful shutdown
├── .env.example                    # Environment variable template
├── .env                            # Active environment configuration
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Quick Start

### 1. Installation

Dependencies are already installed. If starting in a new environment:
```bash
npm install
```

### 2. Environment Configuration

Edit the `.env` file in the project root:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
APP_URL=http://localhost:5000
CLIENT_URL=http://localhost:5000

# Stripe Configuration (https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
STRIPE_CURRENCY=usd

# Resend Email Configuration (https://resend.com/api-keys)
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_FROM=Store Orders <onboarding@resend.dev>
SUPPORT_EMAIL=support@example.com
STORE_NAME=PrimeStore Direct
```

> **Note on Resend:** In Resend test mode, emails can be sent from `onboarding@resend.dev` to the email registered on your Resend account. Once you verify your custom domain in Resend, you can send to any customer email.

### 3. Start Development Server

Run the development server with live reload:
```bash
npm run dev
```

Or build and run production JavaScript:
```bash
npm run build
npm start
```

Visit the interactive test dashboard at: **`http://localhost:5000`**

---

## 📡 Testing Webhooks Locally with Stripe CLI

To test live webhooks from Stripe's test environment on your local server:

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Authenticate:
   ```bash
   stripe login
   ```
3. Forward webhook events to your local server:
   ```bash
   stripe listen --forward-to localhost:5000/api/v1/webhooks/stripe
   ```
4. Copy the webhook signing secret printed in your terminal (e.g., `whsec_...`) and paste it as `STRIPE_WEBHOOK_SECRET` in your `.env`.
5. Trigger test events:
   ```bash
   stripe trigger payment_intent.succeeded
   stripe trigger checkout.session.completed
   ```

---

## 📚 REST API Reference

### 1. Create Checkout Session
Redirect customer to a Stripe-hosted payment page.

- **Endpoint**: `POST /api/v1/checkout/create-session`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "customer": {
      "name": "Alex Johnson",
      "email": "alex@example.com"
    },
    "items": [
      {
        "name": "Sony WH-1000XM5 Headphones",
        "description": "Noise-Cancelling Over-Ear Headphones",
        "price": 34900,
        "quantity": 1
      }
    ],
    "currency": "usd"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "data": {
      "orderId": "b1a7d672-8802-45e3-85da-0524ba337841",
      "orderNumber": "ORD-MWKPZ9A-7J8K",
      "total": 37692,
      "currency": "USD",
      "sessionId": "cs_test_...",
      "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
    }
  }
  ```

---

### 2. Create Payment Intent
Used for custom frontend card elements, Apple Pay, Google Pay, or mobile apps.

- **Endpoint**: `POST /api/v1/payments/create-intent`
- **Headers**:
  - `Content-Type: application/json`
  - `Idempotency-Key: <unique-uuid>` *(optional, recommended)*
- **Request Body**:
  ```json
  {
    "orderId": "b1a7d672-8802-45e3-85da-0524ba337841"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "clientSecret": "pi_3MtwBwLkdIwHu7ix28a3tqPa_secret_YrKJ...",
      "paymentIntentId": "pi_3MtwBwLkdIwHu7ix28a3tqPa",
      "orderId": "b1a7d672-8802-45e3-85da-0524ba337841",
      "amount": 37692,
      "currency": "USD"
    }
  }
  ```

---

### 3. Stripe Webhook Listener
Receives asynchronous payment updates from Stripe.

- **Endpoint**: `POST /api/v1/webhooks/stripe`
- **Headers**:
  - `Stripe-Signature: t=1614...`
  - `Content-Type: application/json` (Raw Binary Preserved)
- **Supported Events**:
  - `checkout.session.completed` ➔ Transitions order to `PAID` & sends Resend email receipt.
  - `payment_intent.succeeded` ➔ Transitions order to `PAID` & sends Resend email receipt.
  - `payment_intent.payment_failed` ➔ Transitions order to `PAYMENT_FAILED` & sends payment failure email.
  - `charge.refunded` ➔ Transitions order to `REFUNDED`.

---

### 4. Refund Payment
Issue a full or partial refund for a processed payment.

- **Endpoint**: `POST /api/v1/payments/refund`
- **Request Body**:
  ```json
  {
    "paymentIntentId": "pi_3MtwBwLkdIwHu7ix28a3tqPa",
    "amount": 10000,
    "reason": "requested_by_customer"
  }
  ```

---

### 5. Query Orders

- **Get Order by ID**: `GET /api/v1/orders/:id`
- **Get Order by Order Number**: `GET /api/v1/orders/number/:orderNumber`
- **List Recent Orders**: `GET /api/v1/orders?limit=25`

---

## 🐳 Docker Deployment, High Availability & Auto-Restart

This repository contains a production multi-stage [Dockerfile](file:///d:/others/real-project/Dockerfile) and [docker-compose.yml](file:///d:/others/real-project/docker-compose.yml) configured with an **Nginx Load Balancer** and automatic container recovery.

### 1. Start Multi-Instance Cluster (3 Replicas)
Run the following command to build and launch 3 backend containers behind the Nginx load balancer:
```bash
docker-compose up --build --scale payment-api=3 -d
```

Check running containers:
```bash
docker-compose ps
```

### 2. How Docker Auto-Restart & Load Balancing Works
- The Nginx reverse proxy listens on `http://localhost:5000` and balances traffic round-robin across all 3 `payment-api` replicas.
- Open `http://localhost:5000` and observe the **Instance Hostname** in the top navigation bar. Refreshing the page routes you between different container IDs.
- In `docker-compose.yml`, `restart: always` is enabled for the API service.
- If an instance crashes due to an `uncaughtException`, Node.js:
  1. Catches the fatal error via `process.on('uncaughtException')`.
  2. Stops accepting new requests on `server.close()`.
  3. Drains and finishes all active in-flight requests.
  4. Exits with code `1`.
  5. **Docker immediately detects the exited container and restarts it automatically within 1-2 seconds.**
  6. Meanwhile, the other 2 instances continue handling customer checkouts and Resend emails with **zero downtime**!

### 3. Test Crash Recovery
You can trigger a crash directly from the Web UI ("💥 Fault Tolerance Lab") or via cURL:
```bash
curl -X POST http://localhost:5000/api/v1/test/uncaught-exception
```
Watch the live logs across your cluster:
```bash
docker-compose logs -f payment-api
```
You will see the graceful shutdown sequence print in the logs, followed by Docker spinning the container back up automatically!

---

## 🔒 Security & Production Checklist

1. **Database Persistence**: Replace `InMemoryOrderRepository` (`src/repositories/order.repository.ts`) with your database ORM (e.g. Prisma with PostgreSQL or Mongoose with MongoDB). The repository pattern allows zero changes to business logic.
2. **Distributed Idempotency**: Use Redis (e.g. `ioredis`) for storing processed webhook event IDs across horizontal server replicas.
3. **Webhook Secret**: Always ensure `STRIPE_WEBHOOK_SECRET` is set in production to prevent forged payment events.
4. **Resend Domain Verification**: Complete DNS verification (SPF/DKIM) on [Resend.com](https://resend.com/domains) for high-deliverability branded receipt emails.
