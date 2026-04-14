# ===========================================
# Backend Dockerfile - Multi-stage build
# ===========================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# Stage 2: Development
FROM node:20-alpine AS development
RUN apk add --no-cache wget

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 5000

# Development: run as root to allow file writes and temp files
# Production uses separate stage with nodejs user
CMD ["npm", "run", "dev"]

# Stage 3: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Stage 4: Production
FROM node:20-alpine AS production
RUN apk add --no-cache wget && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --spider -q http://localhost:5000/api/health || exit 1

# Production start
CMD ["node", "dist/server.js"]
