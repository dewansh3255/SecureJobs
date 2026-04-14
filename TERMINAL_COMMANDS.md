# Terminal Commands Guide - FCS-26 Professional Network

Complete reference for all terminal commands needed to run, test, and deploy the project.

---

## 📋 Table of Contents

1. [Initial Setup](#initial-setup)
2. [Development](#development)
3. [Docker Commands](#docker-commands)
4. [Testing](#testing)
5. [Git & GitHub](#git--github)
6. [Troubleshooting](#troubleshooting)

---

## Initial Setup

### 1. Navigate to Project Directory
```bash
cd /Users/dewansh/Documents/testing_LLM
```

### 2. Copy Environment File
```bash
cp .env.example .env
```

### 3. Generate Secure JWT Secrets (IMPORTANT!)
```bash
# Generate random secrets for production
openssl rand -hex 32
# Run twice and copy the outputs to .env file
```

### 4. Edit .env File
```bash
# Open in your preferred editor
nano .env
# OR
code .env
# OR
vim .env
```

Update these values in `.env`:
```bash
JWT_SECRET=<paste-first-openssl-output-here>
JWT_REFRESH_SECRET=<paste-second-openssl-output-here>
MONGO_PASSWORD=your-secure-password
REDIS_PASSWORD=your-secure-password
```

---

## Development

### Option A: Using Docker (Recommended)

#### Start All Services
```bash
cd /Users/dewansh/Documents/testing_LLM
docker-compose up -d
```

#### View Logs (Real-time)
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
docker-compose logs -f redis
```

#### Stop All Services
```bash
docker-compose down
```

#### Stop and Remove Volumes (Clean Reset)
```bash
docker-compose down -v
```

#### Restart a Service
```bash
docker-compose restart backend
docker-compose restart frontend
```

#### Rebuild After Code Changes
```bash
docker-compose up -d --build
```

#### Access Container Shell
```bash
# Backend container
docker exec -it fcs26-backend sh

# Frontend container
docker exec -it fcs26-frontend sh

# MongoDB container
docker exec -it fcs26-mongodb mongosh -u admin -p changeme123
```

#### View Running Containers
```bash
docker ps
docker ps -a  # Include stopped containers
```

#### Check Container Health
```bash
docker-compose ps
```

---

### Option B: Local Development (Without Docker)

#### Backend Setup
```bash
cd /Users/dewansh/Documents/testing_LLM/backend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

#### Frontend Setup
```bash
cd /Users/dewansh/Documents/testing_LLM/frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Docker Commands Reference

### Container Management
```bash
# List all containers
docker ps
docker ps -a

# Stop container
docker stop <container-name>

# Start container
docker start <container-name>

# Remove container
docker rm <container-name>

# Remove all stopped containers
docker container prune
```

### Image Management
```bash
# List images
docker images

# Remove image
docker rmi <image-name>

# Remove unused images
docker image prune -a
```

### Volume Management
```bash
# List volumes
docker volume ls

# Remove volume
docker volume rm <volume-name>

# Inspect volume
docker volume inspect <volume-name>
```

### Logs
```bash
# View logs
docker logs <container-name>

# Follow logs (real-time)
docker logs -f <container-name>

# Last 100 lines
docker logs --tail 100 <container-name>
```

### Network
```bash
# List networks
docker network ls

# Inspect network
docker network inspect <network-name>
```

---

## Testing

### Backend Tests
```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Security Audit
```bash
cd backend

# Check for vulnerable dependencies
npm audit

# Auto-fix vulnerabilities
npm audit fix

# Force fix (may break changes)
npm audit fix --force
```

### API Health Check
```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Test readiness (includes DB check)
curl http://localhost:5000/api/health/ready

# Test liveness
curl http://localhost:5000/api/health/live
```

### Frontend Check
```bash
cd frontend

# Type check
npm run typecheck

# Lint
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format
```

---

## Git & GitHub

### Initial Git Setup
```bash
cd /Users/dewansh/Documents/testing_LLM

# Initialize git repository
git init

# Check status
git status
```

### Configure Git (First Time)
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Create .gitignore (Already exists, but verify)
```bash
# Check what's ignored
cat .gitignore
```

### First Commit
```bash
# Stage all files
git add .

# Check what will be committed
git status

# Commit
git commit -m "Initial commit: Professional Network FCS-26"
```

### Connect to GitHub
```bash
# Create repository on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/project-fcs-26.git

# Verify remote
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main
```

### Subsequent Commits
```bash
# Check changes
git status

# Stage specific files
git add path/to/file

# Stage all changes
git add .

# Commit
git commit -m "Describe your changes"

# Push
git push
```

### Create a Branch
```bash
# Create and switch to new branch
git checkout -b feature/feature-name

# Switch back to main
git checkout main

# Merge branch
git checkout main
git merge feature/feature-name
```

### Pull Latest Changes
```bash
git pull origin main
```

---

## Troubleshooting

### Docker Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs backend

# Check if port is in use
lsof -i :5000
lsof -i :5173

# Kill process on port
kill -9 <PID>
```

#### Permission Denied Errors
```bash
# Fix Docker permissions (Mac)
docker-compose down
sudo chown -R $(whoami) .

# Rebuild without cache
docker-compose build --no-cache
```

#### Database Connection Issues
```bash
# Check MongoDB is running
docker-compose ps mongodb

# Restart MongoDB
docker-compose restart mongodb

# Check MongoDB logs
docker-compose logs mongodb
```

#### Redis Connection Issues
```bash
# Check Redis is running
docker-compose ps redis

# Test Redis connection
docker exec fcs26-redis redis-cli ping
```

### Node.js Issues

#### Clear Node Modules
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

#### Clear NPM Cache
```bash
npm cache clean --force
```

### Frontend Issues

#### Clear Browser Cache
```bash
# In browser DevTools
# Application > Storage > Clear Site Data
```

#### Vite Cache Issues
```bash
cd frontend
rm -rf node_modules/.vite
npm run dev -- --force
```

---

## Quick Reference Card

### Daily Development Workflow
```bash
# 1. Start everything
cd /Users/dewansh/Documents/testing_LLM
docker-compose up -d

# 2. Check status
docker-compose ps

# 3. View logs
docker-compose logs -f

# 4. Stop when done
docker-compose down
```

### Push to GitHub
```bash
git add .
git commit -m "Your message"
git push origin main
```

### Health Checks
```bash
curl http://localhost:5000/api/health
curl http://localhost:5173
```

---

## Production Deployment

### Build for Production
```bash
# Using Docker Compose production config
docker-compose -f docker-compose.prod.yml up -d --build
```

### Export Docker Logs
```bash
docker-compose logs > logs.txt
```

### Backup Database
```bash
docker exec fcs26-mongodb mongodump --out=/data/backup
```

---

**Last Updated:** 2026-04-14
**Project:** FCS-26 Professional Networking Platform
