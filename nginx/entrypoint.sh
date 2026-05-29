#!/bin/sh
set -e

SSL_DIR="/etc/nginx/ssl"

if [ ! -f "$SSL_DIR/cert.pem" ] || [ ! -f "$SSL_DIR/key.pem" ]; then
  # Bind-mount is read-only when certs exist; only generate if truly missing.
  # This path runs when no host cert directory is mounted (CI / fresh env).
  echo "[nginx] No certificate found — generating self-signed fallback..."
  # Write to a writable temp location then copy to ssl dir
  TMPDIR=$(mktemp -d)
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout "$TMPDIR/key.pem" \
    -out    "$TMPDIR/cert.pem" \
    -subj   "/C=US/ST=Dev/L=Dev/O=FCS26/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1" 2>/dev/null
  # Try to copy — will fail gracefully if dir is read-only (bind-mount with certs)
  cp "$TMPDIR/cert.pem" "$SSL_DIR/cert.pem" 2>/dev/null || true
  cp "$TMPDIR/key.pem"  "$SSL_DIR/key.pem"  2>/dev/null || true
  rm -rf "$TMPDIR"
  echo "[nginx] Self-signed certificate generated."
else
  echo "[nginx] Certificate found: $SSL_DIR/cert.pem"
  # Print cert validity for ops visibility
  openssl x509 -noout -subject -dates -in "$SSL_DIR/cert.pem" 2>/dev/null || true
fi

exec nginx -g "daemon off;"
