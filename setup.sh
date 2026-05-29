#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Nexus — One-shot environment setup & launch script
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh              # interactive (asks for admin creds)
#   ./setup.sh --no-admin   # skip admin creation (CI / re-run)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

SKIP_ADMIN=false
for arg in "$@"; do [[ "$arg" == "--no-admin" ]] && SKIP_ADMIN=true; done

# ── 1. Detect docker compose command ─────────────────────────
if docker compose version &>/dev/null 2>&1; then
  DC="docker compose"
elif docker-compose version &>/dev/null 2>&1; then
  DC="docker-compose"
else
  error "Docker Compose not found. Install Docker Desktop first."
  exit 1
fi

# ── 2. Generate .env if it does not exist ────────────────────
if [[ -f "backend/.env" ]]; then
  warn "backend/.env already exists — skipping secret generation (remove it to regenerate)"
else
  info "Generating backend/.env with fresh secrets…"
  gen() { node -e "process.stdout.write(require('crypto').randomBytes($1).toString('hex'))" 2>/dev/null || openssl rand -hex $1; }

  JWT_SECRET=$(gen 32)
  JWT_REFRESH_SECRET=$(gen 32)
  CSRF_SECRET=$(gen 32)
  RESUME_ENCRYPTION_KEY=$(gen 32)
  REDIS_PASS=$(gen 16)

  cat > backend/.env <<EOF
NODE_ENV=development
PORT=5000

# MongoDB
MONGO_URI=mongodb://admin:admin_pass@mongodb:27017/nexus?authSource=admin

# Redis
REDIS_URL=redis://:${REDIS_PASS}@redis:6379

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=20m
JWT_REFRESH_EXPIRES_IN=7d

# CSRF
CSRF_SECRET=${CSRF_SECRET}

# Resume encryption (must be 64 hex chars = 32 bytes)
RESUME_ENCRYPTION_KEY=${RESUME_ENCRYPTION_KEY}

# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:5173,https://localhost

# Email (Ethereal is auto-created in dev if omitted)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=noreply@example.com
# SMTP_PASS=your-password
# SMTP_FROM="Nexus <noreply@example.com>"
EOF
  success "backend/.env created"
fi

# ── 3. Launch containers ──────────────────────────────────────
info "Starting containers (docker compose up -d)…"
$DC up -d --build

# Wait for backend to be healthy
info "Waiting for backend health check…"
for i in {1..30}; do
  if curl -sf http://localhost:5000/api/health/live >/dev/null 2>&1; then
    success "Backend is healthy"
    break
  fi
  if [[ $i -eq 30 ]]; then
    error "Backend did not become healthy after 60s. Check: $DC logs backend"
    exit 1
  fi
  sleep 2
done

# ── 4. Create admin user ──────────────────────────────────────
if [[ "$SKIP_ADMIN" == false ]]; then
  echo ""
  echo -e "${CYAN}── Create Admin User ──────────────────────────────────────${NC}"
  read -rp "Admin first name  [Admin]:   " ADMIN_FIRST;  ADMIN_FIRST="${ADMIN_FIRST:-Admin}"
  read -rp "Admin last name   [User]:    " ADMIN_LAST;   ADMIN_LAST="${ADMIN_LAST:-User}"
  read -rp "Admin email:                 " ADMIN_EMAIL
  read -rsp "Admin password:              " ADMIN_PASS; echo ""

  if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASS" ]]; then
    warn "Email or password was empty — skipping admin creation"
  else
    $DC exec -T backend node -e "
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
mongoose.connect(process.env.MONGO_URI || 'mongodb://admin:admin_pass@mongodb:27017/nexus?authSource=admin')
  .then(async () => {
    const User = require('./dist/models/User').default;
    const existing = await User.findOne({ email: '${ADMIN_EMAIL}' });
    if (existing) { console.log('User already exists — updating role to admin'); await User.updateOne({ email: '${ADMIN_EMAIL}' }, { role: 'admin', isVerified: true }); }
    else {
      const hash = await bcrypt.hash('${ADMIN_PASS}', 12);
      await User.create({ firstName: '${ADMIN_FIRST}', lastName: '${ADMIN_LAST}', email: '${ADMIN_EMAIL}', password: hash, role: 'admin', isVerified: true, twoFactorEnabled: false });
      console.log('Admin user created');
    }
    process.exit(0);
  })
  .catch(e => { console.error(e.message); process.exit(1); });
" && success "Admin user ready: ${ADMIN_EMAIL}" || warn "Admin creation via exec failed — try: cd backend && npm run create-admin"
  fi
fi

# ── 5. Print summary ──────────────────────────────────────────
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Nexus is up and running!        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Frontend:  ${CYAN}http://localhost:5173${NC}  (dev)"
echo -e "             ${CYAN}https://localhost${NC}       (nginx TLS)"
echo -e "  Backend:   ${CYAN}http://localhost:5000/api${NC}"
echo -e "  Logs:      ${YELLOW}$DC logs -f backend${NC}"
echo ""
