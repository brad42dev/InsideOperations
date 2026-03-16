#!/usr/bin/env bash
# Inside/Operations — Installer Packaging Script (runs on Server 1 / Build machine)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

VERSION="${1:-$(git describe --tags --always --dirty 2>/dev/null || echo 'dev')}"
PACKAGE_NAME="io-${VERSION}"
DIST_DIR="$PROJECT_ROOT/dist"
PKG_DIR="$DIST_DIR/$PACKAGE_NAME"

echo "Building Inside/Operations installer package ${VERSION}..."

# Clean
rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR/bin" "$PKG_DIR/migrations" "$PKG_DIR/frontend" \
         "$PKG_DIR/systemd" "$PKG_DIR/scripts" "$PKG_DIR/config"

# Build Rust services (release)
# BINDGEN_EXTRA_CLANG_ARGS: samael crate uses bindgen against libxmlsec1.
# The GCC include path provides stddef.h and other builtins that clang's
# bundled headers may not supply on this build host.
echo "-> Building Rust services..."
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" \
    cargo build --release --workspace 2>&1 | tail -3

# Copy binaries
echo "-> Copying binaries..."
for svc in api-gateway data-broker opc-service event-service parser-service \
           archive-service import-service alert-service email-service \
           auth-service recognition-service; do
    cp "target/release/$svc" "$PKG_DIR/bin/"
done

# Build frontend
echo "-> Building frontend..."
if [[ -d frontend ]] && [[ -f frontend/package.json ]]; then
    cd frontend
    pnpm install --frozen-lockfile
    pnpm build
    cd "$PROJECT_ROOT"
    cp -r frontend/dist/* "$PKG_DIR/frontend/"
else
    echo "  (frontend not yet built — skipping)"
    mkdir -p "$PKG_DIR/frontend"
    echo "<html><body>Frontend not built</body></html>" > "$PKG_DIR/frontend/index.html"
fi

# Copy migrations
echo "-> Copying migrations..."
cp -r migrations/* "$PKG_DIR/migrations/"

# Copy systemd units
echo "-> Copying systemd units..."
cp systemd/*.service systemd/*.target systemd/*.timer "$PKG_DIR/systemd/"

# Copy installer scripts
echo "-> Copying installer scripts..."
cp installer/deploy.sh "$PKG_DIR/scripts/"
cp installer/smoke-test.sh "$PKG_DIR/scripts/"
chmod +x "$PKG_DIR/scripts/deploy.sh" "$PKG_DIR/scripts/smoke-test.sh"

# Copy health check script
cp scripts/healthcheck.sh "$PKG_DIR/scripts/"
chmod +x "$PKG_DIR/scripts/healthcheck.sh"

# Copy config template (deploy.sh seeds /opt/io/config/io.env from this on first install)
echo "-> Copying config template..."
cp config/io.env.example "$PKG_DIR/config/"

# Generate manifest
echo "-> Generating manifest..."
cat > "$PKG_DIR/manifest.json" << MANIFEST
{
  "version": "$VERSION",
  "built_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "services": [
    "api-gateway", "data-broker", "opc-service", "event-service",
    "parser-service", "archive-service", "import-service", "alert-service",
    "email-service", "auth-service", "recognition-service"
  ]
}
MANIFEST

# Create tarball
echo "-> Creating tarball..."
cd "$DIST_DIR"
tar -czf "${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"

echo ""
echo "OK Package built: $DIST_DIR/${PACKAGE_NAME}.tar.gz"
echo "  Transfer to Server 2 and run: ./scripts/deploy.sh ${VERSION}"
