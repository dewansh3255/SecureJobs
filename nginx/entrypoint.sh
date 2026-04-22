#!/bin/sh
set -e
if [ ! -f /etc/nginx/ssl/cert.pem ]; then
  echo "Generating self-signed certificate..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
  echo "Certificate generated."
fi
exec nginx -g "daemon off;"
