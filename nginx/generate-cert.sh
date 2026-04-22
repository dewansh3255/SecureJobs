#!/bin/sh
# Generate self-signed TLS certificate for local development
# For production: replace with Let's Encrypt cert (see README)
set -e

SSL_DIR="/etc/nginx/ssl"
mkdir -p "$SSL_DIR"

if [ ! -f "$SSL_DIR/cert.pem" ]; then
  echo "Generating self-signed TLS certificate..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/key.pem" \
    -out    "$SSL_DIR/cert.pem" \
    -subj   "/C=US/ST=Dev/L=Dev/O=FCS26/OU=Dev/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
  echo "Self-signed certificate created."
else
  echo "Certificate already exists, skipping."
fi
