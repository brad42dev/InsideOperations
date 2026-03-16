#!/usr/bin/env bash
# Inside/Operations — Deployment Script (runs on Server 2 / Demo/Live machine)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION=$(python3 -c "import sys,json; print(json.load(open('$PKG_DIR/manifest.json'))['version'])")

INSTALL_DIR="/opt/io"
BACKUP_DIR="/opt/io-backups"
DB_URL=""  # set after sourcing /opt/io/config/io.env below

echo "Deploying Inside/Operations ${VERSION}..."

# ---------------------------------------------------------------------------
# License Agreement (first install only)
# On upgrades the agreement was already accepted; skip unless forced.
# The marker file /opt/io/.license_accepted records: version accepted + timestamp.
# ---------------------------------------------------------------------------
LICENSE_MARKER="/opt/io/.license_accepted"
EULA_FILE="$PKG_DIR/EULA.md"

if [[ ! -f "$LICENSE_MARKER" ]]; then
    if [[ ! -f "$EULA_FILE" ]]; then
        echo "ERROR: EULA.md not found at $EULA_FILE"
        echo "       Cannot proceed without the license agreement."
        exit 1
    fi

    echo ""
    echo "========================================================================"
    echo "  INSIDE/OPERATIONS SOFTWARE LICENSE AGREEMENT"
    echo "========================================================================"
    echo ""
    echo "  You must read and accept the license agreement before installing."
    echo "  Press ENTER to begin reading. Use the spacebar to scroll."
    echo "  Press 'q' to finish reading."
    echo ""
    read -r -p "  Press ENTER to view the license agreement..." _ignored
    less "$EULA_FILE" || more "$EULA_FILE" || cat "$EULA_FILE"
    echo ""
    echo "========================================================================"
    echo "  Do you accept the terms of the Inside/Operations License Agreement?"
    echo "  Type AGREE (all caps) and press ENTER to accept, or anything else to exit."
    echo "========================================================================"
    echo ""
    read -r -p "  Your response: " LICENSE_RESPONSE
    if [[ "$LICENSE_RESPONSE" != "AGREE" ]]; then
        echo ""
        echo "License agreement not accepted. Installation aborted."
        exit 1
    fi

    mkdir -p /opt/io
    echo "version=${VERSION} accepted=$(date -u +%Y-%m-%dT%H:%M:%SZ) by=$(whoami)@$(hostname)" > "$LICENSE_MARKER"
    chmod 444 "$LICENSE_MARKER"
    echo ""
    echo "  License accepted. Record written to $LICENSE_MARKER"
    echo ""
fi

# ---------------------------------------------------------------------------
# System dependency check
# Install C libraries required by SAML (libxmlsec1) and XML processing.
# These must be present on the target server before IO services can start.
# ---------------------------------------------------------------------------
echo "-> Checking system dependencies..."
MISSING_PKGS=()
for pkg in libxmlsec1 libxmlsec1-openssl libxml2 libxslt1.1 libssl3; do
    if ! dpkg -s "$pkg" &>/dev/null 2>&1; then
        MISSING_PKGS+=("$pkg")
    fi
done
if [[ ${#MISSING_PKGS[@]} -gt 0 ]]; then
    echo "  Installing missing system packages: ${MISSING_PKGS[*]}"
    apt-get update -qq
    apt-get install -y \
        libxmlsec1 libxmlsec1-dev libxmlsec1-openssl \
        libxml2 libxml2-dev \
        libxslt1.1 libxslt1-dev \
        libssl3 libssl-dev
    echo "  System packages installed."
else
    echo "  All system packages present."
fi

# ---------------------------------------------------------------------------
# First-install: create /opt/io/config/io.env from the bundled template
# if it doesn't already exist.
# ---------------------------------------------------------------------------
mkdir -p /opt/io/config
if [[ ! -f /opt/io/config/io.env ]]; then
    if [[ -f "$PKG_DIR/config/io.env.example" ]]; then
        cp "$PKG_DIR/config/io.env.example" /opt/io/config/io.env
        chmod 600 /opt/io/config/io.env
        echo ""
        echo "  NOTICE: /opt/io/config/io.env was created from the template."
        echo "  Edit it now and re-run deploy.sh, or set secrets before starting services."
        echo "  Required: IO_JWT_SECRET, IO_SERVICE_SECRET, IO_DATABASE_URL, CORS_ALLOWED_ORIGINS"
        echo ""
    else
        echo "ERROR: /opt/io/config/io.env not found and no template available."
        echo "       Create /opt/io/config/io.env with the required environment variables."
        exit 1
    fi
fi

# Load env so DB_URL and other vars are available for migration and smoke tests
set -o allexport
source /opt/io/config/io.env
set +o allexport

# Step 1: Stop services
echo "-> Stopping services..."
systemctl stop io.target 2>/dev/null || true
sleep 3

# Step 2: Backup database
echo "-> Backing up database..."
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/io-backup-$(date +%Y%m%d-%H%M%S)-pre-${VERSION}.sql.gz"
pg_dump "$DB_URL" | gzip > "$BACKUP_FILE"
echo "  Backup: $BACKUP_FILE"

# Step 3: Deploy binaries
echo "-> Deploying binaries..."
mkdir -p "$INSTALL_DIR/bin" "$INSTALL_DIR/frontend" "$INSTALL_DIR/migrations"
cp -f "$PKG_DIR/bin/"* "$INSTALL_DIR/bin/"
chmod +x "$INSTALL_DIR/bin/"*

# Step 4: Deploy frontend
echo "-> Deploying frontend..."
rm -rf "$INSTALL_DIR/frontend/"*
cp -r "$PKG_DIR/frontend/"* "$INSTALL_DIR/frontend/"
# Reload nginx so it picks up any updated static assets immediately
systemctl reload nginx 2>/dev/null || true

# Step 5: Deploy migrations
echo "-> Deploying migrations..."
cp -r "$PKG_DIR/migrations/"* "$INSTALL_DIR/migrations/" 2>/dev/null || true

# Step 6: Run migrations
DB_URL="${IO_DATABASE_URL:-postgresql://io:changeme@localhost:5432/io_production}"
echo "-> Running database migrations..."
sqlx migrate run --database-url "$DB_URL" --source "$INSTALL_DIR/migrations"
echo "  Migrations complete"

# Step 7: Update systemd units
echo "-> Updating systemd units..."
cp "$PKG_DIR/systemd/"*.service "$PKG_DIR/systemd/"*.target /etc/systemd/system/
# Also install timer unit for the health check watchdog
cp "$PKG_DIR/systemd/"*.timer /etc/systemd/system/ 2>/dev/null || true
systemctl daemon-reload

# Step 7b: Install health check script and enable timer
echo "-> Installing health check watchdog..."
mkdir -p /opt/io/scripts
cp "$PKG_DIR/scripts/healthcheck.sh" /opt/io/scripts/
chmod +x /opt/io/scripts/healthcheck.sh
systemctl enable io-healthcheck.timer
systemctl start io-healthcheck.timer
echo "  Watchdog timer enabled (30s interval)"

# Step 8: Enable and start services
echo "-> Enabling and starting services..."
systemctl enable io.target io-api-gateway.service io-data-broker.service \
    io-opc-service.service io-event-service.service io-parser-service.service \
    io-archive-service.service io-import-service.service io-alert-service.service \
    io-email-service.service io-auth-service.service io-recognition-service.service
systemctl start io.target
sleep 5

# Step 9: Run smoke tests
echo "-> Running smoke tests..."
"$SCRIPT_DIR/smoke-test.sh" && echo "OK Smoke tests passed" || {
    echo "FAIL Smoke tests failed — rolling back..."
    systemctl stop io.target
    echo "  Restore database from: $BACKUP_FILE"
    echo "  Manual rollback required."
    exit 1
}

echo ""
echo "OK Inside/Operations ${VERSION} deployed successfully"
