# Professional Networking Platform - FCS-26

A modern, secure professional networking platform inspired by LinkedIn, built with the MERN stack and Docker.

## 🚀 Features

### Core Features
- **User Authentication** - JWT-based auth with refresh tokens, HttpOnly cookies, CSRF protection
- **User Profiles** - Complete profile management with photo, skills, experience, education
- **Connection System** - Send/accept/reject connection requests, connection degrees
- **News Feed** - Algorithmic feed with posts, reactions, comments, and sharing
- **Real-time Messaging** - Socket.IO powered chat with typing indicators and read receipts
- **Job Portal** - Job postings, applications, and recommendations
- **Notifications** - Real-time notifications for all platform activities

### Security Features (OWASP Top 10 Protected)
- JWT authentication with rotating refresh tokens
- Rate limiting (100 req/15min general, 5 req/min auth)
- Input validation with Zod/express-validator
- MongoDB injection prevention
- XSS protection (Helmet, output encoding)
- CSRF protection (double-submit pattern)
- CORS whitelist (no wildcards)
- Account lockout after failed attempts
- Non-root Docker containers
- Security headers (Helmet)

### UI/UX Features
- **Dark/Light Mode** - Quick toggle with system preference detection
- **Modern Design** - LinkedIn-inspired color palette
- **Smooth Animations** - Framer Motion throughout
- **Responsive** - Mobile-first design
- **Loading States** - Skeletons and optimistic updates

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express, TypeScript, Socket.IO |
| Database | MongoDB, Redis (cache/sessions) |
| Infrastructure | Docker, Docker Compose |

## 📁 Project Structure

```
project-fcs-26/
├── docker-compose.yml       # Development Docker setup
├── docker-compose.prod.yml  # Production Docker setup
├── .env.example             # Environment variables template
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── config/          # Configuration
│       ├── middleware/      # Auth, security, validation
│       ├── models/          # MongoDB schemas
│       ├── routes/          # API routes
│       ├── sockets/         # Socket.IO handlers
│       └── server.ts        # Entry point
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── components/      # UI components, layout
        ├── pages/           # Page components
        ├── stores/          # Zustand stores
        ├── services/        # API, Socket.IO
        └── utils/           # Helper functions
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)

### ⚡ One-Command Start
```bash
cd /Users/dewansh/Documents/testing_LLM && cp .env.example .env && docker-compose up -d
```

### 📋 Full Setup Steps

#### Step 1: Setup Environment
```bash
cd /Users/dewansh/Documents/testing_LLM
cp .env.example .env
```

#### Step 2: Generate Secure Secrets (IMPORTANT!)
```bash
# Generate JWT secrets - copy outputs to .env file
echo "JWT_SECRET:" && openssl rand -hex 32
echo "JWT_REFRESH_SECRET:" && openssl rand -hex 32
```

Edit `.env` and replace the default secrets with your generated values.

#### Step 3: Start Services
```bash
docker-compose up -d
```

#### Step 4: Verify Everything is Running
```bash
docker-compose ps
```

#### Step 5: Access the Application
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **API Health:** http://localhost:5000/api/health

### Option 1: Docker (Recommended)

```bash
# Clone the repository
cd /path/to/project

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- MongoDB: localhost:27017
- Redis: localhost:6379

### Option 2: Local Development

```bash
# Install backend dependencies
cd backend
npm install
npm run dev

# In another terminal, install frontend dependencies
cd frontend
npm install
npm run dev
```

## 🧪 Testing Checklist

### 1. Verify Services are Running
```bash
# Check all containers are healthy
docker-compose ps

# Expected output: All services should show "healthy" status
```

### 2. Test Backend API
```bash
# Health check
curl http://localhost:5000/api/health

# Should return: {"success": true, "message": "API is healthy", ...}

# Readiness check (includes DB)
curl http://localhost:5000/api/health/ready
```

### 3. Test Frontend
```bash
# Check frontend is serving
curl http://localhost:5173

# Or open in browser
open http://localhost:5173
```

### 4. Test User Registration
```bash
# Register a test user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### 5. Test Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

### 6. Test Dark/Light Mode
1. Open http://localhost:5173
2. Click the sun/moon icon in the header
3. Verify theme toggles work

### 7. Test Responsive Design
1. Open DevTools (F12)
2. Toggle device toolbar
3. Test mobile, tablet, desktop views

## 📝 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login user |
| POST | /api/auth/logout | Logout user |
| POST | /api/auth/refresh | Refresh access token |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/forgot-password | Request password reset |
| POST | /api/auth/reset-password | Reset password with token |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Basic health check |
| GET | /api/health/ready | Readiness check (DB + Redis) |
| GET | /api/health/live | Liveness check |

### User Routes (To be implemented)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/users/:id | Get user profile |
| PUT | /api/users/me | Update own profile |
| GET | /api/users/search | Search users |
| POST | /api/users/photo | Upload profile photo |

### Connection Routes (To be implemented)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/connections/request | Send connection request |
| PUT | /api/connections/:id/accept | Accept request |
| PUT | /api/connections/:id/reject | Reject request |
| DELETE | /api/connections/:id | Remove connection |
| GET | /api/connections/pending | Get pending requests |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Basic health check |
| GET | /api/health/ready | Readiness check |
| GET | /api/health/live | Liveness check |

## 🧪 Security Testing

The platform is designed to be attacked. Test for:

```bash
# OWASP Top 10 vulnerabilities
- SQL/NoSQL Injection
- XSS (Cross-Site Scripting)
- CSRF (Cross-Site Request Forgery)
- Authentication bypass
- Rate limiting bypass
- JWT token manipulation
- Session fixation
- File upload vulnerabilities
```

## 🎨 Customization

### Theme Colors
Edit `frontend/tailwind.config.js` to customize colors:

```javascript
colors: {
  linkedin: {
    500: '#0a66c2', // Primary brand color
  },
}
```

### Add New Features
1. Create backend route in `backend/src/routes/`
2. Create model in `backend/src/models/`
3. Create frontend component in `frontend/src/components/`
4. Create page in `frontend/src/pages/`

## 📊 Environment Variables

See `.env.example` for all required variables:

```bash
# Database
MONGO_USERNAME=admin
MONGO_PASSWORD=changeme123
MONGO_DATABASE=professional_network

# Redis
REDIS_PASSWORD=redis_secret

# JWT (CHANGE THESE!)
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Server
BACKEND_PORT=5000
FRONTEND_PORT=5173
```

## 🔧 Scripts

### Backend
```bash
npm run dev      # Development with hot reload
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
npm test         # Run tests
```

### Frontend
```bash
npm run dev      # Development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## 📄 License

MIT License - FCS-26 Project

## 👥 Contributing

This is a course project. Contributions welcome from team members!

### Development Workflow
1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and test thoroughly
3. Commit with clear messages
4. Push and create PR (or push directly for solo dev)

---

## 📞 Quick Help

### View Logs
```bash
docker-compose logs -f
```

### Restart Services
```bash
docker-compose restart
```

### Clean Reset
```bash
docker-compose down -v
docker-compose up -d --build
```

### Stop Everything
```bash
docker-compose down
```

---

**Built with ❤️ for FCS-26 Computer Security Course**

**Documentation:**
- [Terminal Commands Guide](./TERMINAL_COMMANDS.md) - Complete command reference
- [Project Plan](./__PROJECT_FCS_26__.pdf) - Original requirements
