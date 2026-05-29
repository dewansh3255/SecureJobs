<div align="center">

# 🔗 Nexus

### Professional Networking Platform

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-8-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

A **LinkedIn-inspired, security-first** professional networking platform built for the **FCS-26 Computer Security** course. Full-stack, fully Dockerised, and hardened against the OWASP Top 10.

[Quick Start](#-quick-start) · [Features](#-features) · [Security](#-security-architecture) · [API Reference](#-api-reference) · [Contributing](#-contributing)

</div>

---

## 📸 Highlights

| Dark Mode | Light Mode |
|-----------|-----------|
| LinkedIn-style UI with full dark/light theme toggle | Clean, modern card-based layout with Tailwind CSS |

> 💡 **Live UI previews** are available in the [`ui-previews/`](./ui-previews/) folder — open any `.html` file in your browser.

---

## ✨ Features

<details open>
<summary><strong>👤 Identity & Authentication</strong></summary>

- **JWT access tokens** (15-min lifetime) + **rotating refresh tokens** (7-day lifetime) — both stored in `HttpOnly`, `Secure`, `SameSite=Strict` cookies; the raw token never touches JavaScript
- **TOTP 2FA** (Google Authenticator / Authy) — mandatory; QR setup flow on first login
- **8 one-time backup codes** per user, bcrypt-hashed in the database
- TOTP replay protection — used tokens are blocklisted in Redis for the 30-second TOTP window
- TOTP brute-force gate — 3 wrong codes triggers a 15-minute cooldown
- Forgot-password / reset-password via signed email token (30-minute expiry)
- Account lockout after 5 consecutive failed login attempts (30-min lockout)
- **Google OAuth 2.0** social login — available alongside email/password
- JWT blocklist in Redis — deleting a user immediately invalidates all their live sessions

</details>

<details open>
<summary><strong>🧑‍💼 Role System</strong></summary>

| Role | How to obtain | Capabilities |
|------|---------------|--------------|
| `candidate` | Default on registration | Browse jobs, apply, connect, post, message |
| `recruiter` | Self-upgrade in Settings (TOTP required) | All candidate features + create company pages, post jobs, view applicant resumes |
| `admin` | CLI script only — no in-app path | Full admin dashboard, user/job moderation, blockchain audit log |

</details>

<details open>
<summary><strong>📋 Rich Profiles</strong></summary>

- Headline, about, location, website (URL-validated), industry, cover photo, avatar
- **Experience** and **Education** entries with full date-range support
- **Skills** list with endorsements (max 50, validated at schema level)
- Privacy controls — `public` / `connections` / `private` per field group
- **Zero-Knowledge Resume Encryption** — PDF/DOCX files are encrypted *in the browser* with AES-256-GCM before upload; only ciphertext reaches the server; the passphrase and derived key are kept exclusively in-memory (never written to `localStorage` or `sessionStorage`)

</details>

<details open>
<summary><strong>🤝 Connections & Networking</strong></summary>

- Send, accept, reject, or withdraw connection requests
- 1st-degree connections list — paginated (`?page=&limit=`)
- **"People You May Know"** — friends-of-friends algorithm with mutual-connection scoring, not random suggestions
- Connect button shows live `Pending` / `Connected` state
- Accept/decline inline directly from the notification bell

</details>

<details open>
<summary><strong>📰 Feed & Posts</strong></summary>

- Chronological feed scoped to your connections' posts
- Post visibility controls — `public` / `connections` / `private` (enforced server-side on every fetch)
- Reactions: 👍 Like, 🎉 Celebrate, 💡 Insightful, ❤️ Support, and more
- Nested comments with reaction support
- Post tags (max 50 per post, schema-validated)
- **Blockchain-anchored activity log** — sensitive actions are SHA-256 hash-chained for tamper-evidence

</details>

<details open>
<summary><strong>💬 End-to-End Encrypted Messaging</strong></summary>

- Real-time Socket.IO messaging — authenticated via `HttpOnly` cookie in `io.use()` middleware; the JWT is never exposed to JS
- **ECDH P-256 key exchange** — each user registers a public key; AES-256-GCM is used per message
- Only **mutual connections** can start or participate in conversations
- Message content validated server-side (1–5 000 chars on both REST and WebSocket paths)
- Typing indicators and `readBy` read receipts
- Unread-message badge in navigation, updated in real-time

</details>

<details open>
<summary><strong>🏢 Company Pages</strong></summary>

- Recruiters create and own company pages
- Company admins can grant posting rights to additional recruiters
- Jobs are always tied to a company; non-members cannot post

</details>

<details open>
<summary><strong>💼 Jobs & Applications</strong></summary>

- Post jobs with full description, requirements, location, salary range, and job type
- Candidates browse and filter by keyword, location, type, and salary
- One-click apply — attach a resume from your profile (ZK-encrypted; recruiter decrypts client-side)
- Application pipeline: `applied` → `reviewed` → `interview` → `offer` / `rejected`
- Recruiters see all applicants for their jobs; only the applicant's own resume is visible (not others')

</details>

<details open>
<summary><strong>🔔 Notifications</strong></summary>

- Real-time bell with animated unread-count badge
- Types: connection request (inline accept/decline), message, post reaction, comment, job application update, system alerts
- Bulk "mark all as read" action

</details>

<details open>
<summary><strong>🛡️ Admin Dashboard</strong></summary>

- Platform-wide stats — users, posts, jobs, companies, messages
- User management — search (ReDoS-safe regex), ban/unban, role inspection
- Job moderation
- **Blockchain audit log viewer** — inspect the full hash-chain of sensitive events
- Security event log — login attempts, lockouts, role switches, admin actions
- Admins see *only* the admin dashboard — the normal feed and nav are completely hidden

</details>

<details>
<summary><strong>🎨 UI / UX</strong></summary>

- LinkedIn-inspired layout with a LinkedIn-style left sidebar, central feed, and right panel
- **Dark / Light mode toggle** — persisted across sessions via Zustand
- Fully responsive — mobile, tablet, and desktop breakpoints
- Framer Motion page transitions and micro-animations
- Sonner / react-hot-toast notification toasts
- React Hook Form + Zod client-side validation with inline error messages

</details>

---

## 🔐 Security Architecture

> Nexus was built with security as a first-class requirement, not an afterthought.

| Layer | Control | Implementation |
|-------|---------|----------------|
| **Auth** | Token storage | `HttpOnly` + `Secure` + `SameSite=Strict` cookies — no `localStorage` |
| **Auth** | 2FA | TOTP (RFC 6238) mandatory; ±1 window tolerance for clock drift |
| **Auth** | Backup codes | bcrypt-hashed (cost 10); compared with `bcrypt.compare` — no SHA-256 shortcut |
| **Auth** | Replay prevention | Used TOTP tokens blocklisted in Redis for the 30-second step window |
| **Auth** | Session invalidation | JWT blocklist in Redis — user delete or ban immediately invalidates all sessions |
| **Auth** | Account lockout | 5 failed logins → 30-min lockout; 3 TOTP fails → 15-min cooldown |
| **Auth** | OAuth | Google OAuth 2.0; callback URL enforced; `express-session` HttpOnly |
| **CSRF** | Double-submit cookie | `XSRF-TOKEN` cookie ↔ `X-CSRF-Token` header, timing-safe comparison |
| **Passwords** | Hashing | bcrypt, cost factor 12 |
| **Rate limiting** | General | 100 req / 15 min per IP |
| **Rate limiting** | Auth endpoints | 5 req / 15 min per IP; slow-down middleware before hard block |
| **Input** | Validation | Zod (config) + express-validator (every route); errors never expose internals |
| **Input** | NoSQL injection | `mongo-sanitize` strips `$` operators from all request bodies |
| **Input** | XSS | Helmet CSP (`script-src 'self'` — no `unsafe-inline`) + `xss-clean` |
| **Input** | ReDoS | All user-supplied regex patterns escaped before `$regex` queries |
| **Input** | HTTP param pollution | `hpp` middleware deduplicates query/body arrays |
| **Transport** | TLS | nginx terminates HTTPS; mkcert CA for local dev |
| **Headers** | HSTS + hardening | `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy` (both Helmet and nginx layers) |
| **Files** | Upload guard | MIME-type whitelist (PDF, JPEG, PNG, WebP), 10 MB cap, multer |
| **Files** | Resume security | ZK client-side AES-256-GCM encryption; ciphertext only stored; server never sees plaintext; key in-memory only (non-extractable `CryptoKey`) |
| **Files** | Static serving | `/uploads/resumes` is **not** served statically — download requires authenticated API call |
| **Containers** | Least privilege | `USER node` in Dockerfiles; `no-new-privileges` security opt; read-only root FS in prod |
| **Secrets** | Fail-fast | Zod validates all required secrets at startup — missing any secret crashes the process immediately |
| **Proxy** | Trust | `trust proxy` only enabled in `NODE_ENV=production` |
| **Audit** | Blockchain ledger | SHA-256 hash-chained blocks for sensitive actions (tamper-evident, append-only) |
| **Real-time** | WebSocket auth | `io.use()` parses the `accessToken` HttpOnly cookie server-side — no token in URL or JS |

---

## 🛠️ Tech Stack

### Backend
| Package | Version | Purpose |
|---------|---------|---------|
| Node.js | 20 LTS | Runtime |
| Express | ^4.18 | HTTP framework |
| TypeScript | 5 | Type safety |
| Mongoose | ^8.1 | MongoDB ODM |
| Redis (`ioredis`) | ^4.6 | Token blacklist, rate-limit state, TOTP replay |
| Socket.IO | ^4.6 | Real-time messaging |
| jsonwebtoken | ^9.0 | JWT access + refresh tokens |
| bcryptjs | ^2.4 | Password + backup-code hashing |
| otplib | ^13.4 | TOTP generation & verification |
| passport + passport-google-oauth20 | ^0.7 | Google OAuth 2.0 |
| helmet | ^7.1 | Security headers |
| express-rate-limit | ^7.1 | Rate limiting |
| express-mongo-sanitize | ^2.2 | NoSQL injection prevention |
| multer | ^2.1 | File uploads |
| zod | ^3.22 | Config & schema validation |
| winston | ^3.11 | Structured logging |

### Frontend
| Package | Version | Purpose |
|---------|---------|---------|
| React | ^18.2 | UI library |
| Vite | latest | Build tool + HMR |
| TypeScript | 5 | Type safety |
| Tailwind CSS | ^3.4 | Utility-first CSS |
| Framer Motion | ^10.18 | Animations & transitions |
| Zustand | ^4.4 | Global state (auth, theme) |
| TanStack Query | ^5.17 | Server state, caching, refetch |
| React Hook Form | ^7.49 | Forms with Zod validation |
| Socket.IO Client | ^4.6 | Real-time messaging |
| Lucide React | ^0.309 | Icon library |
| date-fns | ^3.6 | Date formatting |

### Infrastructure
| Tool | Purpose |
|------|---------|
| Docker + Docker Compose | Containerisation (dev + prod profiles) |
| nginx | Reverse proxy, SSL termination, CSP headers |
| MongoDB 7 | Primary database |
| Redis 7 | Cache, rate-limit, token blacklist |
| mkcert | Local trusted HTTPS certificates |

---

## 📁 Project Structure

```
nexus/
├── .env                        # Docker Compose root secrets (gitignored)
├── .env.example                # Template — copy and fill
├── .env.production             # Production overrides (gitignored)
├── docker-compose.yml          # Development stack (hot-reload, volume mounts)
├── docker-compose.prod.yml     # Production stack (built images, hardened)
├── setup-https.sh              # One-time mkcert / local CA setup
├── nginx/
│   └── conf.d/default.conf    # Reverse proxy, SSL, CSP, rate-limit headers
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── config/             # index.ts — Zod-validated env (fails fast on missing secrets)
│       ├── middleware/
│       │   ├── auth.ts         # protect, optionalAuth, restrictTo + Redis blocklist check
│       │   ├── csrf.ts         # Double-submit cookie verification
│       │   ├── security.ts     # Helmet CSP, CORS whitelist, rate-limiters
│       │   ├── validation.ts   # express-validator rule sets per route
│       │   └── errorHandler.ts # Centralised error → safe response mapping
│       ├── models/
│       │   ├── User.ts         # Roles, TOTP secrets, bcrypt hooks, privacy settings
│       │   ├── Post.ts         # Visibility, reactions, comments, tags (max 50)
│       │   ├── Job.ts          # JD, requirements, salary, application refs
│       │   ├── Application.ts  # Pipeline status, ZK resume key per application
│       │   ├── Company.ts      # Company page, authorised members
│       │   ├── Connection.ts   # Requester ↔ Recipient, status enum
│       │   ├── Conversation.ts # Participants, message refs
│       │   ├── Message.ts      # Content, readBy, soft-delete
│       │   ├── Notification.ts # Type enum, data payload, isRead
│       │   ├── AuditLog.ts     # Security event log
│       │   └── BlockchainBlock.ts # SHA-256 hash chain
│       ├── routes/
│       │   ├── auth.ts         # Register, login, logout, refresh, TOTP, Google OAuth
│       │   ├── user.ts         # Profile CRUD, resume ZK upload/download, role switch
│       │   ├── post.ts         # Feed, CRUD, reactions, comments, visibility enforcement
│       │   ├── job.ts          # Browse, post, apply, application pipeline
│       │   ├── company.ts      # Company CRUD, member management
│       │   ├── connection.ts   # Request, accept, reject, paginated list, suggestions
│       │   ├── message.ts      # Conversations, history, search (ReDoS-safe)
│       │   ├── notification.ts # List, mark-read, mark-all-read
│       │   ├── recommendations.ts # ML-style people & job recommendations
│       │   ├── admin.ts        # Stats, user moderation, blockchain viewer
│       │   └── health.ts       # /health, /ready, /live
│       ├── sockets/
│       │   └── index.ts        # Socket.IO: cookie auth, message:send (length-guarded), typing, read
│       ├── scripts/
│       │   └── createAdmin.ts  # CLI — create or promote admin (only path to admin role)
│       └── utils/
│           ├── logger.ts       # Winston structured logger
│           ├── email.ts        # Nodemailer (Ethereal catch-all in dev)
│           ├── totp.ts         # otplib wrapper — ±1 window, Redis replay guard, fail-closed
│           ├── blockchain.ts   # SHA-256 hash-chain ledger
│           └── resumeParser.ts # PDF/DOCX text extraction (mammoth + pdf-parse)
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── components/
        │   ├── ui/             # Button, Input, Card, Badge, Avatar, Modal, Spinner…
        │   ├── layout/         # MainLayout, Sidebar, Navbar, DarkModeToggle
        │   └── auth/           # ProtectedRoute, RoleGuard
        ├── pages/
        │   ├── Login.tsx       # Email/password + Google OAuth
        │   ├── Register.tsx    # Registration form with Zod validation
        │   ├── Setup2FA.tsx    # TOTP QR setup flow
        │   ├── Feed.tsx        # Chronological connection feed
        │   ├── Profile.tsx     # Rich profile view + edit modal
        │   ├── Network.tsx     # Connections list + people you may know
        │   ├── Jobs.tsx        # Browse + filter + apply
        │   ├── Messaging.tsx   # Real-time E2EE chat
        │   ├── Notifications.tsx # Bell panel with inline actions
        │   ├── Company.tsx     # Company page view + management
        │   ├── Applications.tsx # Candidate's application tracker
        │   ├── Settings.tsx    # Account, security, 2FA, role switch
        │   └── Admin.tsx       # Admin-only dashboard
        ├── stores/
        │   ├── authStore.ts    # Zustand: user, tokens, isAuthenticated (persisted)
        │   └── themeStore.ts   # Zustand: dark/light mode (persisted)
        └── services/
            ├── api.ts          # Axios instance with CSRF header injection + 401 refresh logic
            ├── socket.ts       # Socket.IO client (withCredentials, auto-reconnect)
            └── crypto.ts       # ZK resume AES-256-GCM + ECDH E2EE message crypto
```

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Docker | ≥ 24 |
| Docker Compose | v2 (`docker compose`, not `docker-compose`) |
| Node.js *(non-Docker dev only)* | ≥ 20 |

### 1 — Clone & configure

```bash
git clone https://github.com/your-org/nexus.git
cd nexus
cp .env.example .env
```

Open `.env` and fill in your values. At minimum, generate fresh secrets:

```bash
# Paste each output line into .env
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CSRF_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('COOKIE_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 2 — Development (HTTP, hot-reload)

```bash
docker compose up -d
```

| Service | URL |
|---------|-----|
| Frontend (Vite HMR) | http://localhost:5173 |
| Backend API | http://localhost:5001 |
| API health check | http://localhost:5001/api/health |

### 3 — Production (HTTPS)

```bash
# One-time: install mkcert and generate a local trusted CA + cert
bash setup-https.sh

docker compose -f docker-compose.prod.yml up -d
```

| Service | URL |
|---------|-----|
| Frontend (HTTPS) | https://localhost |
| API (nginx-proxied) | https://localhost/api |

> **Tip:** On macOS run `brew install mkcert && mkcert -install` before `setup-https.sh`.

---

## 🧑‍💻 Admin User Setup

Admin accounts can **only** be created via the CLI — there is intentionally no in-app sign-up path to the admin role.

```bash
# Create a brand-new admin account
docker compose exec backend npx tsx src/scripts/createAdmin.ts create admin@example.com 'MyStr0ng!Pass'

# Promote an existing registered user to admin
docker compose exec backend npx tsx src/scripts/createAdmin.ts promote user@example.com
```

> ⚠️ After creation, immediately change the password from **Settings → Security** in the UI.

---

## 📝 API Reference

All endpoints are prefixed with `/api`. Authentication uses `HttpOnly` cookies — no `Authorization: Bearer` header needed.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/register` | — | Create account; returns 2FA setup flag |
| `POST` | `/login` | — | Email + password login; sets JWT cookies |
| `POST` | `/logout` | Cookie | Clear cookies and invalidate refresh token |
| `GET` | `/me` | Cookie | Authenticated user's full profile |
| `POST` | `/refresh` | Cookie | Rotate access token using refresh token |
| `GET` | `/2fa/setup` | Cookie | Get TOTP secret + QR code SVG |
| `POST` | `/2fa/enable` | Cookie | Confirm TOTP setup with first code |
| `POST` | `/2fa/disable` | Cookie | Disable TOTP (requires valid code) |
| `POST` | `/2fa/validate` | `tfToken` cookie | Verify TOTP code after login step 1 |
| `GET` | `/2fa/backup-codes/count` | Cookie | Number of remaining backup codes |
| `POST` | `/forgot-password` | — | Send password reset email |
| `POST` | `/reset-password/:token` | — | Complete password reset |
| `GET` | `/google` | — | Initiate Google OAuth 2.0 |
| `GET` | `/google/callback` | — | OAuth redirect handler |

### Users — `/api/users`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/:id` | View user's public profile |
| `PUT` | `/me` | Update own profile (bio, skills, experience, etc.) |
| `GET` | `/search?q=` | Full-text search by name / headline |
| `POST` | `/photo` | Upload profile picture (JPEG/PNG/WebP, ≤ 10 MB) |
| `POST` | `/cover` | Upload cover photo |
| `POST` | `/resume` | Upload ZK-encrypted resume (PDF/DOCX) |
| `GET` | `/resume` | Download own resume (decrypted client-side) |
| `DELETE` | `/resume` | Delete own resume |
| `POST` | `/switch-role` | Toggle `candidate` ↔ `recruiter` (TOTP required) |
| `POST` | `/public-key` | Register ECDH public key for E2EE messages |

### Connections — `/api/connections`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/request` | Send connection request |
| `PUT` | `/:id/accept` | Accept incoming request |
| `PUT` | `/:id/reject` | Decline incoming request |
| `DELETE` | `/:id` | Remove existing connection |
| `GET` | `/?page=&limit=` | List accepted connections (paginated) |
| `GET` | `/pending` | Incoming pending requests |
| `GET` | `/sent` | Your outgoing pending requests |
| `GET` | `/suggestions` | People you may know (2nd-degree) |

### Posts — `/api/posts`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/feed?page=` | Paginated connection feed |
| `POST` | `/` | Create post (content, visibility, tags) |
| `GET` | `/:id` | Single post (visibility enforced) |
| `PUT` | `/:id` | Edit own post |
| `DELETE` | `/:id` | Delete own post |
| `POST` | `/:id/react` | Add or change reaction |
| `DELETE` | `/:id/react` | Remove reaction |
| `POST` | `/:id/comment` | Add comment |
| `DELETE` | `/:id/comments/:cid` | Delete comment |

### Jobs — `/api/jobs`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/?q=&location=&type=` | Optional | Browse and filter jobs |
| `POST` | `/` | Recruiter | Post a new job |
| `GET` | `/:id` | Optional | Job detail |
| `PUT` | `/:id` | Recruiter (owner) | Edit job |
| `DELETE` | `/:id` | Recruiter (owner) | Delete job |
| `POST` | `/:id/apply` | Candidate | Apply (with optional resume attach) |
| `GET` | `/:id/applications` | Recruiter (owner) | View all applications |
| `PUT` | `/:id/applications/:aid` | Recruiter | Update application status |

### Companies — `/api/companies`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create company page (recruiter) |
| `GET` | `/:id` | View company page |
| `PUT` | `/:id` | Update company (owner / admin) |
| `POST` | `/:id/members` | Add posting-rights member |
| `DELETE` | `/:id/members/:uid` | Revoke member posting rights |

### Messages — `/api/messages`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/conversations` | List all conversations |
| `POST` | `/conversations` | Start new conversation (connections only) |
| `GET` | `/conversations/:id/messages` | Fetch message history |
| `PUT` | `/conversations/:id/read` | Mark conversation as read |
| `GET` | `/unread-count` | Unread message badge count |
| `GET` | `/search?q=` | Search messages and conversations |

### Notifications — `/api/notifications`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List notifications (newest first) |
| `PUT` | `/:id/read` | Mark single notification as read |
| `PUT` | `/read-all` | Mark all notifications as read |
| `DELETE` | `/:id` | Delete a notification |

### Admin — `/api/admin` *(admin role required)*

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/stats` | Platform-wide stats (users, posts, jobs, etc.) |
| `GET` | `/users?q=&role=&status=` | Paginated user list with filters |
| `PUT` | `/users/:id/ban` | Ban a user (blocklists their JWT in Redis) |
| `PUT` | `/users/:id/unban` | Lift ban |
| `DELETE` | `/users/:id` | Permanently delete user + blocklist sessions |
| `GET` | `/jobs` | All jobs across the platform |
| `GET` | `/blockchain` | Full blockchain audit log |
| `GET` | `/logs` | Security event log |

### Health — `/api/health`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Basic liveness — returns `200 OK` |
| `GET` | `/ready` | Readiness — checks MongoDB + Redis connectivity |
| `GET` | `/live` | Process alive check (no DB) |

---

## 📊 Environment Variables

> All variables are Zod-validated at startup. Missing a required secret crashes the process immediately — no silent failures.

```bash
# =============================================
# Root .env  (consumed by docker-compose.yml)
# =============================================

# --- MongoDB ---
MONGO_USERNAME=admin
MONGO_PASSWORD=your-mongo-password          # ← change
MONGO_DATABASE=professional_network
REDIS_PASSWORD=your-redis-password          # ← change

# --- JWT (generate with: openssl rand -hex 32) ---
JWT_SECRET=<64-char hex>                    # ← required
JWT_REFRESH_SECRET=<64-char hex>            # ← required
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# --- Security secrets (generate with: openssl rand -hex 32) ---
CSRF_SECRET=<64-char hex>                   # ← required, min 32 bytes
COOKIE_SECRET=<64-char hex>                 # ← required, signs cookieParser
SESSION_SECRET=<64-char hex>                # ← required, for OAuth session

# --- Google OAuth (create at console.cloud.google.com) ---
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://localhost/api/auth/google/callback

# --- CORS ---
CORS_ORIGIN=https://localhost,http://localhost:5173
CLIENT_URL=https://localhost

# --- Email (optional — Ethereal catch-all used in dev if omitted) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@nexus.example.com

# --- Rate limiting ---
RATE_LIMIT_WINDOW_MS=900000                 # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100                 # general
RATE_LIMIT_AUTH_MAX_REQUESTS=5              # auth endpoints
```

> Generate any secret in one command:
> ```bash
> openssl rand -hex 32
> ```

---

## 🔧 Common Commands

```bash
# ─── Development ─────────────────────────────────────────
# Start all services (MongoDB, Redis, backend, frontend, nginx)
docker compose up -d

# Follow logs from all services
docker compose logs -f

# Follow backend logs only
docker compose logs -f backend

# Rebuild backend after package.json or Dockerfile changes
docker compose build backend && docker compose up -d --force-recreate backend

# TypeScript type-check (without building)
docker compose exec backend npx tsc --noEmit

# ─── Data management ──────────────────────────────────────
# Hard reset — wipe ALL data and rebuild images
docker compose down -v && docker compose up -d --build

# Open a Mongo shell
docker compose exec mongodb mongosh -u admin -p changeme123

# ─── Admin ────────────────────────────────────────────────
# Create admin user
docker compose exec backend npx tsx src/scripts/createAdmin.ts \
  create admin@nexus.com 'YourStr0ngP@ss!'

# Promote existing user to admin
docker compose exec backend npx tsx src/scripts/createAdmin.ts \
  promote user@nexus.com

# ─── Production ───────────────────────────────────────────
# One-time local HTTPS setup
bash setup-https.sh

# Start production stack
docker compose -f docker-compose.prod.yml up -d

# Production rebuild
docker compose -f docker-compose.prod.yml build && \
  docker compose -f docker-compose.prod.yml up -d --force-recreate
```

---

## 🧪 Security Test Checklist

Nexus is designed to resist active attacks. Use these scenarios to validate the hardening:

| # | Attack | How to test | Expected result |
|---|--------|-------------|-----------------|
| 1 | **TOTP replay** | Use the same 6-digit code twice within its 30-s window | `401 This code has already been used` |
| 2 | **TOTP brute-force** | Enter wrong code 3× | 15-minute cooldown with `429` |
| 3 | **CSRF** | `POST /api/posts` without the `X-CSRF-Token` header | `403 Invalid CSRF token` |
| 4 | **JWT forgery** | Manually edit the `accessToken` cookie payload | `401 Invalid token` |
| 5 | **JWT algorithm confusion** | Set `alg: "none"` or `alg: "RS256"` in token header | Rejected — only `HS256` accepted |
| 6 | **Privilege escalation** | Call `POST /api/jobs` while authenticated as a candidate | `403 Access denied` |
| 7 | **Banned user** | Ban a user via admin, then use their cookie | `403 Account suspended` |
| 8 | **Resume access** | Request `GET /api/users/resume` for another user's ID | `403` / `404` |
| 9 | **NoSQL injection** | `POST /api/auth/login` body: `{"email":{"$gt":""},"password":"x"}` | `400` (sanitised, not matched) |
| 10 | **Rate limiting** | Send > 5 POST requests to `/api/auth/login` within 15 min | `429 Too Many Requests` |
| 11 | **File type bypass** | Upload a `.exe` renamed to `.pdf` | `400 Invalid file type` |
| 12 | **WebSocket message flood** | Send a `message:send` event with 6 000+ chars | `{ error: 'Message must be between 1 and 5000 characters' }` |
| 13 | **XSS in post** | Create a post containing `<script>alert(1)</script>` | Sanitised — no execution |
| 14 | **Deleted user session** | Delete a user via admin, then use their existing cookie | `401 Invalid or expired token` |

---

## 🏗️ Architecture Overview

```
Browser
  │  HTTPS (TLS 1.2+)
  ▼
┌─────────────────────────────────────────────────────────────────┐
│  nginx  (SSL termination, CSP headers, rate-limit, static files) │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │  REST /api/*                │  WebSocket /socket.io
          ▼                             ▼
┌─────────────────────┐      ┌─────────────────────┐
│  Express (Node 20)  │      │  Socket.IO Server    │
│  ─ JWT middleware   │      │  ─ Cookie auth       │
│  ─ CSRF guard       │      │  ─ Room management   │
│  ─ Rate limiter     │      │  ─ Event handlers    │
│  ─ Route handlers   │      └────────┬────────────┘
└────────┬────────────┘               │
         │                            │
    ┌────┴────────────────────────────┤
    │                                 │
    ▼                                 ▼
┌───────────────┐           ┌─────────────────────┐
│   MongoDB     │           │   Redis              │
│  (Mongoose)   │           │  ─ JWT blocklist     │
│  ─ All data   │           │  ─ TOTP replay guard │
│  ─ Schemas    │           │  ─ Rate-limit state  │
│  ─ Blockchain │           │  ─ Account lockout   │
└───────────────┘           └─────────────────────┘
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch — `git checkout -b feat/your-feature`
3. Commit your changes — `git commit -m "feat: add your feature"`
4. Push and open a Pull Request

Please follow the existing code style (ESLint + Prettier) and ensure no TypeScript errors before submitting.

---

## 📄 License

MIT © 2025 Nexus / FCS-26

---

<div align="center">

**Built with ❤️ for FCS-26 Computer Security**

[Terminal Commands Reference](./TERMINAL_COMMANDS.md) · [Original Requirements PDF](./__PROJECT_FCS_26__.pdf)

</div>
