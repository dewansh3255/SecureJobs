# FCS-26 Professional Networking Platform

## Project Overview
Full-stack professional networking platform (LinkedIn-inspired) for the FCS-26 Computer Security course.

## Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Framer Motion + Zustand + React Query
- **Backend**: Node.js + Express + TypeScript + Socket.IO
- **Database**: MongoDB (Mongoose) + Redis
- **Infrastructure**: Docker Compose

## Development
```bash
# Start everything (recommended)
docker-compose up -d

# Backend local dev
cd backend && npm run dev

# Frontend local dev
cd frontend && npm run dev
```

## Architecture
- `backend/src/routes/` — API route handlers
- `backend/src/models/` — Mongoose schemas
- `backend/src/middleware/` — auth, validation, security
- `backend/src/sockets/` — Socket.IO real-time events
- `frontend/src/pages/` — Page components
- `frontend/src/components/` — Reusable UI components
- `frontend/src/stores/` — Zustand state (auth, theme)
- `frontend/src/services/` — API client + Socket.IO

## Security (OWASP Top 10 Protected)
- JWT access (15min) + refresh (7d) tokens in HttpOnly cookies
- Rate limiting: 100/15min general, 5/15min auth
- bcrypt(12) password hashing
- Account lockout after 5 failed attempts
- Helmet CSP/HSTS, CORS whitelist, mongo-sanitize, XSS-clean
- CSRF double-submit cookie pattern
