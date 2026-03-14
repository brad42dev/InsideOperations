#!/usr/bin/env bash
# =============================================================================
# Inside/Operations — Project Setup (no sudo required)
# =============================================================================
#
# Purpose:  Sets up the Rust toolchain, dev database, and Claude Code project.
#           Everything here runs as your normal user. No sudo.
#
# Prereqs:  Run install_system.sh first (sudo), then log out/in for docker.
#
# Installs: Rust (rustup → ~/.cargo/), cargo-watch, sqlx-cli
# Creates:  ~/io-dev/io/  (Claude Code project with 40 design docs)
#           ~/io-dev/docker-compose.yml (PostgreSQL 16 + TimescaleDB)
#
# Re-run:   Safe — idempotent. Skips already-installed components.
#
# Usage:    ./install_project.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()     { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------------------------------------------------------------------------
# Refuse to run as root
# ---------------------------------------------------------------------------
if [[ $EUID -eq 0 ]]; then
    err "Do NOT run this script as root or with sudo."
    err "This script sets up user-space tools and the project directory."
    err "Run it as your normal user: ./install_project.sh"
    exit 1
fi

# Resolve the script's own directory (for finding sibling build package files)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Pre-flight: verify system dependencies from install_system.sh
# ---------------------------------------------------------------------------
preflight() {
    local FAIL=false

    info "Checking system prerequisites..."

    if ! command -v git &> /dev/null; then
        err "git not found. Run install_system.sh first."
        FAIL=true
    fi

    if ! command -v node &> /dev/null; then
        err "Node.js not found. Run install_system.sh first."
        FAIL=true
    fi

    if ! command -v docker &> /dev/null; then
        err "Docker not found. Run install_system.sh first."
        FAIL=true
    fi

    # Test docker access without sudo
    if ! docker info > /dev/null 2>&1; then
        err "Cannot access Docker. Did you log out and back in after install_system.sh?"
        err "Your user must be in the docker group. Check: groups \$(whoami)"
        FAIL=true
    fi

    if ! command -v gcc &> /dev/null; then
        err "gcc not found. Run install_system.sh first."
        FAIL=true
    fi

    if [[ "$FAIL" == "true" ]]; then
        exit 1
    fi

    ok "All system prerequisites met."
}

preflight

# ---------------------------------------------------------------------------
# Track what was installed vs. already present
# ---------------------------------------------------------------------------
declare -a INSTALLED=()
declare -a SKIPPED=()

track_installed() { INSTALLED+=("$1"); }
track_skipped()   { SKIPPED+=("$1"); }

# ---------------------------------------------------------------------------
# 1. Rust toolchain (installs to ~/.cargo/ — fully user-owned)
# ---------------------------------------------------------------------------
install_rust() {
    local CARGO_BIN="${HOME}/.cargo/bin"

    if [[ -x "${CARGO_BIN}/rustc" ]]; then
        ok "Rust already installed: $("${CARGO_BIN}/rustc" --version 2>/dev/null)"
        track_skipped "rust"
    else
        info "Installing Rust via rustup (into ~/.cargo/)..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
        ok "Rust installed."
        track_installed "rust"
    fi

    # Ensure PATH for subsequent cargo commands in this script
    export PATH="${CARGO_BIN}:${PATH}"

    # Update to latest stable (idempotent)
    "${CARGO_BIN}/rustup" update stable > /dev/null 2>&1
    ok "Rust stable toolchain up to date."
}

install_rust

install_cargo_tool() {
    local TOOL_NAME="$1"
    local DISPLAY_NAME="$2"
    shift 2
    local CARGO_BIN="${HOME}/.cargo/bin"

    if [[ -x "${CARGO_BIN}/${TOOL_NAME}" ]]; then
        ok "${DISPLAY_NAME} already installed."
        track_skipped "$DISPLAY_NAME"
    else
        info "Installing ${DISPLAY_NAME} (into ~/.cargo/bin/)..."
        "${CARGO_BIN}/cargo" install "$@" > /dev/null 2>&1
        ok "${DISPLAY_NAME} installed."
        track_installed "$DISPLAY_NAME"
    fi
}

install_cargo_tool "cargo-watch" "cargo-watch" cargo-watch
install_cargo_tool "sqlx"       "sqlx-cli"     sqlx-cli --no-default-features --features rustls,postgres

# ---------------------------------------------------------------------------
# 2. Dev directory structure
# ---------------------------------------------------------------------------
setup_dev_dirs() {
    info "Setting up dev directory structure..."

    local DIRS=(
        "${HOME}/io-dev"
        "${HOME}/io-dev/installers"
        "${HOME}/io-dev/backups"
    )

    for dir in "${DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            ok "Directory exists: $dir"
        else
            mkdir -p "$dir"
            ok "Created: $dir"
        fi
    done

    track_installed "dev-directories"
}

setup_dev_dirs

# ---------------------------------------------------------------------------
# 3. Docker Compose — PostgreSQL 16 + TimescaleDB
# ---------------------------------------------------------------------------
setup_postgres() {
    local COMPOSE_FILE="${HOME}/io-dev/docker-compose.yml"

    info "Setting up PostgreSQL 16 + TimescaleDB via Docker Compose..."

    cat > "$COMPOSE_FILE" << 'COMPOSEOF'
# Inside/Operations — Dev Database
# PostgreSQL 16 + TimescaleDB 2.13+
# This is the ONLY Docker container in the I/O dev setup.
# Manage with: docker compose -f ~/io-dev/docker-compose.yml up -d
#              docker compose -f ~/io-dev/docker-compose.yml down

services:
  io-db:
    image: timescale/timescaledb:latest-pg16
    container_name: io-db
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: iodev
      POSTGRES_PASSWORD: iodev
      POSTGRES_DB: iodb
    volumes:
      - io-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U iodev -d iodb"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  io-pgdata:
    driver: local
COMPOSEOF

    ok "docker-compose.yml written to ${COMPOSE_FILE}"

    # Start the container
    info "Starting PostgreSQL container..."
    if docker compose -f "$COMPOSE_FILE" up -d 2>/dev/null; then
        ok "PostgreSQL container started."
    else
        err "Failed to start PostgreSQL container."
        err "Check: docker compose -f ~/io-dev/docker-compose.yml logs"
        return 1
    fi

    track_installed "postgresql-docker"
}

setup_postgres

# ---------------------------------------------------------------------------
# 4. Test PostgreSQL connection
# ---------------------------------------------------------------------------
test_postgres() {
    info "Testing PostgreSQL connection..."

    local RETRIES=10
    local WAIT=3

    for (( i=1; i<=RETRIES; i++ )); do
        if docker exec io-db pg_isready -U iodev -d iodb > /dev/null 2>&1; then
            ok "PostgreSQL is accepting connections."

            local TSDB_VER
            TSDB_VER=$(docker exec io-db psql -U iodev -d iodb -tAc \
                "CREATE EXTENSION IF NOT EXISTS timescaledb; SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';" 2>/dev/null | tr -d '[:space:]')

            if [[ -n "$TSDB_VER" ]]; then
                ok "TimescaleDB extension active: v${TSDB_VER}"
            else
                warn "TimescaleDB extension could not be verified."
            fi
            return 0
        fi
        info "Waiting for PostgreSQL... (${i}/${RETRIES})"
        sleep "$WAIT"
    done

    warn "PostgreSQL did not become ready in time. Check: docker logs io-db"
    return 1
}

test_postgres

# ---------------------------------------------------------------------------
# 5. Git user config (needed for Claude Code commits)
# ---------------------------------------------------------------------------
setup_git_config() {
    local GIT_NAME GIT_EMAIL

    GIT_NAME=$(git config --global user.name 2>/dev/null || true)
    GIT_EMAIL=$(git config --global user.email 2>/dev/null || true)

    if [[ -n "$GIT_NAME" && -n "$GIT_EMAIL" ]]; then
        ok "Git config already set: ${GIT_NAME} <${GIT_EMAIL}>"
        track_skipped "git-config"
    else
        info "Setting default git config..."

        if [[ -z "$GIT_NAME" ]]; then
            git config --global user.name "I/O Build"
            warn "Set git user.name to 'I/O Build' — change with: git config --global user.name 'Your Name'"
        fi

        if [[ -z "$GIT_EMAIL" ]]; then
            git config --global user.email "io-build@localhost"
            warn "Set git user.email to 'io-build@localhost' — change with: git config --global user.email 'you@example.com'"
        fi

        track_installed "git-config"
    fi
}

setup_git_config

# ---------------------------------------------------------------------------
# 6. Create Claude Code project
# ---------------------------------------------------------------------------
setup_project() {
    local PROJECT_DIR="${HOME}/io-dev/io"

    info "Setting up Claude Code project at ${PROJECT_DIR}..."

    # Verify the build package files exist alongside this script
    if [[ ! -d "${SCRIPT_DIR}/design-docs" ]]; then
        err "design-docs/ not found next to this script (${SCRIPT_DIR})."
        err "The install script must be run from the extracted build package."
        return 1
    fi

    if [[ ! -f "${SCRIPT_DIR}/IO_initial.md" ]]; then
        err "IO_initial.md not found in ${SCRIPT_DIR}."
        return 1
    fi

    # Create project directory
    mkdir -p "${PROJECT_DIR}"

    # Copy design docs (all 40 docs + 24_integrations/ connector profiles)
    if [[ -d "${PROJECT_DIR}/design-docs" ]]; then
        warn "design-docs/ already exists in ${PROJECT_DIR} — overwriting."
        rm -rf "${PROJECT_DIR}/design-docs"
    fi
    cp -r "${SCRIPT_DIR}/design-docs" "${PROJECT_DIR}/design-docs"
    ok "Copied 40 design documents + integration connector profiles."

    # Copy EULA (needed for seed data)
    cp "${SCRIPT_DIR}/EULA.md" "${PROJECT_DIR}/EULA.md"
    ok "Copied EULA.md."

    # Copy README
    cp "${SCRIPT_DIR}/README.md" "${PROJECT_DIR}/README.md"
    ok "Copied README.md."

    # IO_initial.md becomes CLAUDE.md (the master prompt for Claude Code)
    cp "${SCRIPT_DIR}/IO_initial.md" "${PROJECT_DIR}/CLAUDE.md"
    ok "Installed IO_initial.md as CLAUDE.md (master build prompt)."

    # Keep install scripts in the project for reference
    cp "${SCRIPT_DIR}/install_system.sh" "${PROJECT_DIR}/install_system.sh" 2>/dev/null || true
    cp "${SCRIPT_DIR}/install_project.sh" "${PROJECT_DIR}/install_project.sh" 2>/dev/null || true
    ok "Copied install scripts."

    # Create .claude/ directory for Claude Code
    mkdir -p "${PROJECT_DIR}/.claude"
    ok "Created .claude/ directory."

    # Create .env.example template
    cat > "${PROJECT_DIR}/.env.example" << 'ENVEOF'
# Inside/Operations — Development Environment
# Copy to .env and adjust values as needed.
# This file is committed to git; .env is not.

# Database (matches docker-compose.yml in ~/io-dev/)
DATABASE_URL=postgres://iodev:iodev@localhost:5432/iodb

# Service ports (defaults from design doc 02)
IO_API_PORT=3000
IO_BROKER_PORT=3001
IO_OPC_PORT=3002
IO_EVENT_PORT=3003
IO_PARSER_PORT=3004
IO_ARCHIVE_PORT=3005
IO_IMPORT_PORT=3006
IO_ALERT_PORT=3007
IO_EMAIL_PORT=3008
IO_AUTH_PORT=3009
IO_RECOGNITION_PORT=3010

# Inter-service auth (generate a random secret for dev)
IO_SERVICE_SECRET=change-me-dev-only

# Logging
RUST_LOG=info,io=debug
ENVEOF
    ok "Created .env.example template."

    # Create .gitignore
    cat > "${PROJECT_DIR}/.gitignore" << 'GITIGNOREOF'
# Build artifacts
/target/
/node_modules/
/dist/

# Environment (secrets — never commit)
.env
.env.local
.env.*.local
!.env.example

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Credentials / secrets
*.key
*.pem
*.p12
*.pfx
credentials.json

# Claude Code session data (keep .claude/settings.json, agents, etc.)
.claude/session-state.md
.claude/agent-output/

# Installer packages
/installers/
GITIGNOREOF
    ok "Created .gitignore."

    # Initialize git repo
    if [[ -d "${PROJECT_DIR}/.git" ]]; then
        ok "Git repo already initialized."
    else
        git -C "${PROJECT_DIR}" init -b main > /dev/null 2>&1
        ok "Initialized git repo (main branch)."
    fi

    # Initial commit
    git -C "${PROJECT_DIR}" add -A > /dev/null 2>&1
    git -C "${PROJECT_DIR}" commit \
        -m "Initial commit: 40 design docs, CLAUDE.md master prompt, EULA, install scripts" \
        > /dev/null 2>&1
    ok "Created initial git commit."

    track_installed "claude-code-project"
}

setup_project

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================================================="
echo -e "${GREEN} Inside/Operations — Project Setup Complete${NC}"
echo "============================================================================="
echo ""

echo -e "${CYAN}Rust (in ~/.cargo/ — user-owned):${NC}"
echo "  rustc:        $("${HOME}/.cargo/bin/rustc" --version 2>/dev/null || echo 'not found')"
echo "  cargo:        $("${HOME}/.cargo/bin/cargo" --version 2>/dev/null || echo 'not found')"
echo "  cargo-watch:  $("${HOME}/.cargo/bin/cargo-watch" --version 2>/dev/null || echo 'not found')"
echo "  sqlx-cli:     $("${HOME}/.cargo/bin/sqlx" --version 2>/dev/null || echo 'not found')"
echo ""

echo -e "${CYAN}Database:${NC}"
echo "  Host:         localhost:5432"
echo "  User:         iodev"
echo "  Password:     iodev"
echo "  Database:     iodb"
echo "  Container:    io-db"
echo "  Manage:       docker compose -f ~/io-dev/docker-compose.yml up/down"
echo ""

echo -e "${CYAN}Claude Code Project:${NC}"
echo "  Project dir:  ~/io-dev/io/"
echo "  CLAUDE.md:    ~/io-dev/io/CLAUDE.md (master build prompt)"
echo "  Design docs:  ~/io-dev/io/design-docs/ (40 documents)"
echo "  .env.example: ~/io-dev/io/.env.example (copy to .env)"
echo "  Git repo:     initialized (main branch, initial commit)"
echo ""

echo -e "${CYAN}Other Directories:${NC}"
echo "  Working root: ~/io-dev/"
echo "  Installers:   ~/io-dev/installers/"
echo "  Backups:      ~/io-dev/backups/"
echo "  Compose file: ~/io-dev/docker-compose.yml"
echo ""

if [[ ${#INSTALLED[@]} -gt 0 ]]; then
    echo -e "${GREEN}Installed this run:${NC} ${INSTALLED[*]}"
fi
if [[ ${#SKIPPED[@]} -gt 0 ]]; then
    echo -e "${YELLOW}Already present:${NC}   ${SKIPPED[*]}"
fi

echo ""
echo "Ready to build. Next steps:"
echo "  1. cd ~/io-dev/io"
echo "  2. cp .env.example .env"
echo "  3. claude"
echo "  4. Claude reads CLAUDE.md + all 40 design docs, then begins Phase 1"
echo ""
