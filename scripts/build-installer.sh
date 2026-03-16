#!/usr/bin/env bash
# build-installer.sh — Build a release installer tarball for Inside/Operations
# Runs on the build machine (Server 1). Produces dist/io-v{VERSION}-linux-x86_64.tar.gz
#
# Usage:
#   ./scripts/build-installer.sh [--version VERSION]
#
# Options:
#   --version VERSION   Override version (default: read from Cargo.toml or "0.11")
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Parse arguments ───────────────────────────────────────────────────────────
VERSION=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --version=*)
            VERSION="${1#*=}"
            shift
            ;;
        --help|-h)
            head -10 "$0" | grep "^#" | sed 's/^# *//'
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            exit 1
            ;;
    esac
done

# ── Resolve version ───────────────────────────────────────────────────────────
if [[ -z "$VERSION" ]]; then
    VERSION=$(grep -A5 '^\[workspace\.package\]' "${PROJECT_ROOT}/Cargo.toml" 2>/dev/null \
        | grep '^version' | head -1 | sed 's/.*"\(.*\)".*/\1/') || true
    if [[ -z "$VERSION" ]]; then
        VERSION="0.11"
    fi
fi

echo "Building Inside/Operations v${VERSION} (linux/x86_64)"
echo ""

cd "${PROJECT_ROOT}"

# ── Build frontend ────────────────────────────────────────────────────────────
echo "-> Building frontend..."
(
    cd "${PROJECT_ROOT}/frontend"
    pnpm install --frozen-lockfile
    pnpm build
)
echo "   OK Frontend built"
echo ""

# ── Build sqlx-cli for bundling ───────────────────────────────────────────────
echo "-> Building sqlx-cli for bundling..."
mkdir -p "${PROJECT_ROOT}/dist/tools"
cargo install sqlx-cli \
    --no-default-features \
    --features postgres \
    --root "${PROJECT_ROOT}/dist/tools"
echo "   OK sqlx-cli built"
echo ""

# ── Build release binaries ────────────────────────────────────────────────────
echo "-> Building release binaries..."
cargo build --release --workspace
echo "   OK Build complete"
echo ""

# ── List of service binary names ─────────────────────────────────────────────
BINARIES=(
    api-gateway
    data-broker
    opc-service
    event-service
    parser-service
    archive-service
    import-service
    alert-service
    email-service
    auth-service
    recognition-service
)

# ── Assemble bundle ───────────────────────────────────────────────────────────
ARCH="x86_64"
BIN_PREFIX="${PROJECT_ROOT}/target/release"
BUNDLE_NAME="io-v${VERSION}-linux-${ARCH}"
BUNDLE_DIR="${PROJECT_ROOT}/dist/${BUNDLE_NAME}"

echo "-> Assembling bundle: ${BUNDLE_NAME}"
rm -rf "$BUNDLE_DIR"
mkdir -p \
    "${BUNDLE_DIR}/bin" \
    "${BUNDLE_DIR}/frontend" \
    "${BUNDLE_DIR}/migrations" \
    "${BUNDLE_DIR}/config" \
    "${BUNDLE_DIR}/nginx" \
    "${BUNDLE_DIR}/systemd"

# Service binaries
for bin in "${BINARIES[@]}"; do
    local_src="${BIN_PREFIX}/${bin}"
    if [[ ! -f "$local_src" ]]; then
        echo "   WARN Binary not found: ${local_src} — skipping"
        continue
    fi
    cp "$local_src" "${BUNDLE_DIR}/bin/${bin}"
    chmod +x "${BUNDLE_DIR}/bin/${bin}"
done

# Bundle sqlx-cli
if [[ -f "${PROJECT_ROOT}/dist/tools/bin/sqlx" ]]; then
    cp "${PROJECT_ROOT}/dist/tools/bin/sqlx" "${BUNDLE_DIR}/bin/sqlx"
    chmod +x "${BUNDLE_DIR}/bin/sqlx"
fi

# Frontend build output
if [[ -d "${PROJECT_ROOT}/frontend/dist" ]]; then
    cp -r "${PROJECT_ROOT}/frontend/dist/." "${BUNDLE_DIR}/frontend/"
else
    echo "   WARN frontend/dist/ not found — bundle will have empty frontend/"
fi

# Database migrations
if [[ -d "${PROJECT_ROOT}/migrations" ]]; then
    cp "${PROJECT_ROOT}/migrations/"*.sql "${BUNDLE_DIR}/migrations/" 2>/dev/null || true
fi

# Config template
if [[ -f "${PROJECT_ROOT}/.env.example" ]]; then
    cp "${PROJECT_ROOT}/.env.example" "${BUNDLE_DIR}/config/io.env.example"
fi

# nginx config
if [[ -f "${PROJECT_ROOT}/nginx/io.nginx.conf" ]]; then
    cp "${PROJECT_ROOT}/nginx/io.nginx.conf" "${BUNDLE_DIR}/nginx/io.nginx.conf"
fi

# systemd units
if [[ -d "${PROJECT_ROOT}/systemd" ]]; then
    cp "${PROJECT_ROOT}/systemd/"io-*.service "${BUNDLE_DIR}/systemd/" 2>/dev/null || true
fi

# Installer scripts — substitute __VERSION__ placeholder
if [[ -f "${PROJECT_ROOT}/install.sh" ]]; then
    sed "s/__VERSION__/${VERSION}/g" "${PROJECT_ROOT}/install.sh" > "${BUNDLE_DIR}/install.sh"
    chmod +x "${BUNDLE_DIR}/install.sh"
else
    echo "   WARN install.sh not found at project root"
fi

if [[ -f "${PROJECT_ROOT}/uninstall.sh" ]]; then
    cp "${PROJECT_ROOT}/uninstall.sh" "${BUNDLE_DIR}/uninstall.sh"
    chmod +x "${BUNDLE_DIR}/uninstall.sh"
fi

# ── Create tarball ────────────────────────────────────────────────────────────
TARBALL="${PROJECT_ROOT}/dist/${BUNDLE_NAME}.tar.gz"
echo "-> Creating tarball..."
tar -czf "$TARBALL" -C "${PROJECT_ROOT}/dist" "${BUNDLE_NAME}/"
rm -rf "$BUNDLE_DIR"

SHA=$(sha256sum "$TARBALL" | awk '{print $1}')

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Build complete!"
echo "║"
echo "║  Output:  dist/${BUNDLE_NAME}.tar.gz"
echo "║  SHA256:  ${SHA}"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  To deploy to Server 2:"
echo "    scp dist/${BUNDLE_NAME}.tar.gz user@server2:~/"
echo "    ssh user@server2"
echo "    tar -xzf ${BUNDLE_NAME}.tar.gz"
echo "    sudo ./${BUNDLE_NAME}/install.sh"
echo ""
