# UpCheck — Full-Stack API & Website Uptime Monitoring SaaS

UpCheck is a full-stack uptime monitoring and incident management platform built with **Bun**, **Express 5**, **PostgreSQL (Drizzle ORM)**, and **React (Vite)**. It continuously monitors HTTP/HTTPS endpoints, tracks response latency, logs downtime incidents, sends instant Email and Webhook alerts, and includes a tiered SaaS subscription system powered by **Razorpay**.

---

## Key Features

### Monitoring & Incident Tracking

- **Automated Health Checks:** Scheduled background workers (`node-cron`) ping configured endpoints via `GET`, `POST`, or `HEAD` requests at customizable intervals.
- **Threshold-Based Alerting:** Prevents false positives by requiring configurable consecutive failures (`failureThreshold`) before marking a monitor as `down` and opening an incident.
- **Multi-Channel Notifications:** Sends instant downtime and recovery alerts via **Email (Nodemailer)** and custom **Webhooks** (plan-dependent).
- **Detailed Telemetry & Logs:** Records response status codes, latency (`responseTimeMs`), and error traces in `ping_logs` with automated plan-based log retention.
- **Public Status Endpoints:** Shareable public status pages (`/api/monitor/public/:monitor_id`) for individual monitors.

### Authentication & Account Security

- **Custom Session-Based Auth:** Secure HTTP-only cookie sessions stored in PostgreSQL with IP address and User-Agent tracking.
- **Multi-Device Session Management:** View active sessions and revoke individual or all active sessions remotely.
- **Email Verification & Recovery:** OTP-based account verification, password reset flows, and username availability checks.
- **Media Management:** Profile avatar uploads and cleanup integrated with **Cloudinary**.

### SaaS Subscription & Billing

- **Tiered Plans:** Configurable limits for maximum monitors (`maxMonitors`), minimum check intervals (`minIntervalMinutes`), log retention days, and webhook alert access.
- **Razorpay Integration:** Complete order creation, signature verification, and automated plan activation workflow (`INR` / `USD` support).

---

## Tech Stack

| Layer                         | Technology                                      |
| :---------------------------- | :---------------------------------------------- |
| **Runtime & Package Manager** | Bun                                             |
| **Backend Framework**         | Express 5, TypeScript, Zod (Request Validation) |
| **Database & ORM**            | PostgreSQL, Drizzle ORM, `postgres` driver      |
| **Frontend**                  | React, TypeScript, Vite                         |
| **Background Jobs**           | `node-cron`                                     |
| **Payments & Services**       | Razorpay, Nodemailer (SMTP), Cloudinary         |

---

## Project Structure

```text
UpCheck/
├── backend/
│   ├── drizzle/                # Generated SQL migrations
│   ├── src/
│   │   ├── db/                 # Drizzle schema, connection & migration scripts
│   │   ├── middlewares/        # Auth, Zod validation, Multer upload middlewares
│   │   ├── modules/            # Feature modules (auth, account, monitor, plan)
│   │   ├── routes/             # Express route definitions
│   │   └── utils/              # Crypto, email, cron, and helper utilities
│   ├── drizzle.config.ts
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/                    # React application source
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── .gitignore
└── README.md
```

## Database Schema Overview

- **`users` & `accounts`:** Core user profiles supporting credentials and OAuth providers (`google`).
- **`sessions` & `verification_tokens`:** Stateful session tracking and OTP/token payloads for signup, password resets, and email updates.
- **`plans` & `user_plans`:** Subscription tiers, feature quotas, and active billing periods linked to Razorpay payment IDs.
- **`monitors`:** Target URLs, HTTP methods, check intervals, timeouts, failure thresholds, and alert destinations.
- **`ping_logs`:** Time-series health check results (`isUp`, `statusCode`, `responseTimeMs`, `errorMessage`).
- **`incidents`:** Tracks downtime windows (`startedAt`, `resolvedAt`, `cause`) with a unique partial index ensuring at most one open incident per monitor.

---

## API Endpoints Overview

### Auth (`/api/account`)

- `POST /create` — Register a new user and dispatch verification OTP
- `POST /verify` — Verify email OTP and activate account
- `POST /resend-otp` — Resend verification OTP
- `POST /login` — Authenticate user and issue session cookie
- `POST /forgot-password` & `POST /reset-password` — Password recovery flow
- `POST /logout` — Terminate current or all active sessions

### Account (`/api/account`)

- `GET /me` — Fetch authenticated user profile and active plan details
- `GET /check-username` — Check username availability
- `PATCH /update` — Update profile details
- `PATCH /avatar/update` & `DELETE /avatar/delete` — Manage profile avatar via Cloudinary
- `PATCH /change-password` — Update account password
- `GET /security` & `DELETE /sessions` — Inspect and revoke active device sessions

### Monitors (`/api/monitor`)

- `POST /create` — Create a new uptime monitor (enforces plan quota)
- `GET /list` — List user monitors with filtering/pagination
- `GET /:monitor_id/details` — Get monitor configuration and current status
- `GET /:monitor_id/logs` — Fetch historical ping latency and status logs
- `GET /:monitor_id/incidents` — Fetch downtime incident history
- `GET /public/:monitor_id` — Public status endpoint (no auth required)
- `PATCH /:monitor_id/update` — Update monitor settings
- `PATCH /:monitor_id/toggle` — Pause or resume monitoring
- `DELETE /:monitor_id/delete` — Delete a monitor

### Plans & Billing (`/api/plan`)

- `GET /list` — Fetch available subscription plans
- `POST /create-order` — Create a Razorpay checkout order
- `POST /verify-payment` — Verify Razorpay payment signature and activate plan

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (`v1.1+`)
- PostgreSQL database instance
- Cloudinary, SMTP (Email), and Razorpay credentials

### 1. Clone the Repository

```bash
git clone https://github.com/Kasera-Shivam/upcheck.git
cd upcheck
```
