#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# setup-https.sh  — Generate a locally-trusted HTTPS certificate
#
# Uses mkcert (https://github.com/FiloSottile/mkcert) to issue a
# certificate signed by a local CA that your OS/browser trusts.
# No scary "Not Secure" warnings in Chrome/Safari/Firefox.
#
# Run once per machine:  ./setup-https.sh
# ─────────────────────────────────────────────────────────────
set -e
CERT_DIR="$(dirname "$0")/nginx/ssl"
mkdir -p "$CERT_DIR"

# ── 1. Ensure mkcert is installed ────────────────────────────
if ! command -v mkcert &>/dev/null; then
  echo "Installing mkcert..."
  if command -v brew &>/dev/null; then
    brew install mkcert
  elif command -v apt-get &>/dev/null; then
    sudo apt-get install -y libnss3-tools mkcert
  else
    echo "Please install mkcert manually: https://github.com/FiloSottile/mkcert"
    exit 1
  fi
fi

# ── 2. Install local CA (adds to OS trust store) ──────────────
echo "Installing local CA (may ask for sudo password)..."
mkcert -install

# ── 3. Generate certificate ───────────────────────────────────
echo "Generating certificate for localhost..."
mkcert \
  -key-file  "$CERT_DIR/key.pem" \
  -cert-file "$CERT_DIR/cert.pem" \
  localhost 127.0.0.1 ::1

echo ""
echo "✅  Done! Certificate written to nginx/ssl/"
echo "    Restart nginx to apply: docker compose restart nginx"
echo ""
echo "    Access the app at: https://localhost"
