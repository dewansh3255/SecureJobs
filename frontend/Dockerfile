# ===========================================
# Frontend Dockerfile - Multi-stage build
# ===========================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# Stage 2: Development
FROM node:20-alpine AS development
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 5173

# Development: run as root to allow Vite temp file writes
# Production build uses separate stage with nginx
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Stage 3: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /node_modules ./node_modules
COPY . .

ARG VITE_API_URL=/api
ARG VITE_WS_URL=ws://localhost:5000

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# Stage 4: Production (served by Nginx)
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --spider -q http://localhost/ || exit 1
