#!/usr/bin/env bash
# Inside/Operations — nginx + TLS setup script
#
# Installs nginx (if needed), generates a self-signed TLS certificate for
# LAN/dev use, builds the frontend, and activates the nginx config so the
# application is accessible on https://<server-ip>/
#
# Run as root (or with sudo):
#   sudo ./scripts/setup-nginx.sh
#
# For Let's Encrypt on a public domain, pass the domain name:
#   sudo ./scripts/setup-nginx.sh --domain mysite.example.com
#
# After running:
#   - App is live at https://<server-ip>/ (self-signed) or https://<domain>/ (LE)
#   - nginx config: /etc/nginx/sites-enabled/io
#   - TLS include:  /etc/io/nginx/tls.conf
#   - Certs (self): /etc/io/tls/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIST="$REPO_DIR/frontend/dist"
SERVE_DIR="/opt/io/frontend"
NGINX_CONF_SRC="$REPO_DIR/nginx/io.nginx.conf"
NGINX_CONF_DEST="/etc/nginx/sites-available/io"
TLS_DIR="/etc/io/tls"
NGINX_INCLUDE_DIR="/etc/io/nginx"
DOMAIN=""

# ── Parse arguments ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) DOMAIN="$2"; shift 2 ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
done

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root."
    echo "       sudo ./scripts/setup-nginx.sh"
    exit 1
fi

echo "========================================"
echo " Inside/Operations — nginx + TLS setup"
echo "========================================"
echo ""

# ── 1. Install nginx ──────────────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
    echo "-> Installing nginx..."
    apt-get update -qq
    apt-get install -y -qq nginx
    echo "   OK nginx installed"
else
    echo "   OK nginx already installed ($(nginx -v 2>&1 | head -1))"
fi

# ── 2. Build frontend ─────────────────────────────────────────────────────────
echo "-> Building frontend..."
if ! command -v pnpm &>/dev/null; then
    # Install pnpm if missing
    npm install -g pnpm --silent
fi

cd "$REPO_DIR/frontend"
pnpm install --silent
pnpm build --silent
echo "   OK frontend built → $FRONTEND_DIST"

# ── 3. Deploy frontend to serve directory ─────────────────────────────────────
echo "-> Deploying frontend to $SERVE_DIR..."
mkdir -p "$SERVE_DIR"
rm -rf "${SERVE_DIR:?}/"*
cp -r "$FRONTEND_DIST/"* "$SERVE_DIR/"
echo "   OK frontend deployed"

# ── 4. Set up TLS certificates ────────────────────────────────────────────────
mkdir -p "$TLS_DIR" "$NGINX_INCLUDE_DIR"

if [[ -n "$DOMAIN" ]]; then
    # Let's Encrypt — requires certbot
    echo "-> Setting up Let's Encrypt certificate for $DOMAIN..."
    if ! command -v certbot &>/dev/null; then
        apt-get install -y -qq certbot python3-certbot-nginx
    fi
    certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos \
        --register-unsafely-without-email 2>/dev/null || \
    certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos \
        -m "admin@$DOMAIN"
    CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    echo "   OK Let's Encrypt certificate obtained"
else
    # Self-signed certificate for dev/LAN use
    CERT_PATH="$TLS_DIR/self-signed.crt"
    KEY_PATH="$TLS_DIR/self-signed.key"

    if [[ ! -f "$CERT_PATH" ]] || [[ ! -f "$KEY_PATH" ]]; then
        echo "-> Generating self-signed TLS certificate..."
        SERVER_IP=$(hostname -I | awk '{print $1}')
        # Include both localhost and server IP as SANs so browsers can connect
        # by IP address without hostname-mismatch errors (still untrusted — needs
        # manual trust store addition on client machines).
        openssl req -x509 -nodes -newkey rsa:4096 \
            -keyout "$KEY_PATH" \
            -out "$CERT_PATH" \
            -days 3650 \
            -subj "/CN=Inside-Operations/O=IO/C=US" \
            -addext "subjectAltName=IP:${SERVER_IP},IP:127.0.0.1,DNS:localhost" \
            2>/dev/null
        chmod 600 "$KEY_PATH"
        echo "   OK Self-signed certificate generated (valid 10 years)"
        echo "   CN=Inside-Operations, SAN=IP:${SERVER_IP}"
        echo ""
        echo "   NOTE: Browsers will show a security warning because the cert is"
        echo "   self-signed. To suppress it, import $CERT_PATH into your OS or"
        echo "   browser certificate trust store."
        echo ""
    else
        echo "   OK Self-signed certificate already exists (reusing)"
    fi
fi

# Write TLS include fragment that nginx.conf references
cat > "$NGINX_INCLUDE_DIR/tls.conf" <<EOF
ssl_certificate     ${CERT_PATH};
ssl_certificate_key ${KEY_PATH};

# Modern TLS settings (TLS 1.2+ only)
ssl_protocols             TLSv1.2 TLSv1.3;
ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;
ssl_session_cache         shared:SSL:10m;
ssl_session_timeout       1d;
ssl_session_tickets       off;
EOF
echo "   OK TLS include written → $NGINX_INCLUDE_DIR/tls.conf"

# ── 5. Install nginx site config ──────────────────────────────────────────────
echo "-> Installing nginx site config..."
cp "$NGINX_CONF_SRC" "$NGINX_CONF_DEST"

# Remove the default site if present
rm -f /etc/nginx/sites-enabled/default

# Enable I/O site
ln -sf "$NGINX_CONF_DEST" /etc/nginx/sites-enabled/io

# Test config
nginx -t
echo "   OK nginx config valid"

# ── 6. Enable and reload nginx ────────────────────────────────────────────────
echo "-> Enabling and starting nginx..."
systemctl enable nginx --quiet
systemctl reload nginx 2>/dev/null || systemctl start nginx
echo "   OK nginx running"

# ── 7. Print access info ──────────────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "========================================"
echo " Setup complete!"
echo "========================================"
echo ""
echo "  Application URL: https://${SERVER_IP}/"
echo "  (HTTP on port 80 redirects to HTTPS)"
echo ""
if [[ -z "$DOMAIN" ]]; then
    echo "  TLS: self-signed certificate"
    echo "  To avoid browser warnings, import the cert into your trust store:"
    echo "    $CERT_PATH"
    echo ""
    echo "  Chrome/Edge: Settings > Security > Manage certificates > Authorities > Import"
    echo "  Firefox:     Settings > Privacy & Security > Certificates > Import"
fi
echo ""
echo "  Ensure the Rust services are running: ./dev.sh start"
echo ""
