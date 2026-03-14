#!/usr/bin/env bash
# =============================================================================
# Inside/Operations — System Dependencies (requires sudo)
# =============================================================================
#
# Purpose:  Installs system-level packages that require root privileges.
#           Run this ONCE, then run install_project.sh as your normal user.
#
# Installs: build tools, libssl, libpq, unixODBC, git, jq, Node.js 22,
#           corepack/pnpm, Docker + Compose plugin
#
# OS:       Ubuntu 22.04+ LTS, Debian 12+, RHEL 9+ / Rocky 9+
# Re-run:   Safe — idempotent. Skips already-installed components.
#
# Usage:    chmod +x install_system.sh && sudo ./install_system.sh
#
# Next:     Log out and back in (for docker group), then:
#           ./install_project.sh
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
# Pre-flight
# ---------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
    err "This script must be run as root (or via sudo)."
    exit 1
fi

REAL_USER="${SUDO_USER:-$USER}"

if [[ "$REAL_USER" == "root" ]]; then
    warn "Running as literal root. Prefer 'sudo ./install_system.sh'."
fi

# ---------------------------------------------------------------------------
# Detect OS
# ---------------------------------------------------------------------------
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS_ID="${ID}"
    OS_VERSION="${VERSION_ID:-unknown}"
else
    err "Cannot detect OS — /etc/os-release not found."
    exit 1
fi

case "$OS_ID" in
    ubuntu|debian)      PKG_FAMILY="apt" ;;
    rhel|rocky|almalinux|centos) PKG_FAMILY="dnf" ;;
    *)
        err "Unsupported OS: $OS_ID. Expected Ubuntu/Debian/RHEL/Rocky."
        exit 1
        ;;
esac

info "Detected OS: $OS_ID $OS_VERSION (package family: $PKG_FAMILY)"

DOCKER_GROUP_ADDED=false

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
info "Installing system packages..."

if [[ "$PKG_FAMILY" == "apt" ]]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq

    apt-get install -y -qq \
        build-essential gcc g++ make pkg-config \
        libssl-dev libpq-dev \
        unixodbc-dev \
        git curl wget \
        jq \
        ca-certificates gnupg lsb-release \
        > /dev/null 2>&1
    ok "APT packages installed."

elif [[ "$PKG_FAMILY" == "dnf" ]]; then
    dnf groupinstall -y "Development Tools" > /dev/null 2>&1 || true
    dnf install -y \
        gcc gcc-c++ make pkg-config \
        openssl-devel libpq-devel \
        unixODBC-devel \
        git curl wget \
        jq \
        ca-certificates gnupg2 \
        > /dev/null 2>&1
    ok "DNF packages installed."
fi

# ---------------------------------------------------------------------------
# 2. Node.js 22 LTS
# ---------------------------------------------------------------------------
if command -v node &> /dev/null; then
    ok "Node.js already installed: $(node --version)"
else
    info "Installing Node.js 22 LTS..."

    if [[ "$PKG_FAMILY" == "apt" ]]; then
        mkdir -p /etc/apt/keyrings
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
            | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
            > /etc/apt/sources.list.d/nodesource.list
        apt-get update -qq
        apt-get install -y -qq nodejs > /dev/null 2>&1

    elif [[ "$PKG_FAMILY" == "dnf" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
        dnf install -y nodejs > /dev/null 2>&1
    fi

    ok "Node.js installed: $(node --version)"
fi

# ---------------------------------------------------------------------------
# 3. Enable corepack (provides pnpm without global npm install)
# ---------------------------------------------------------------------------
if command -v pnpm &> /dev/null; then
    ok "pnpm already available: $(pnpm --version 2>/dev/null)"
else
    info "Enabling corepack (provides pnpm in user-space)..."
    corepack enable > /dev/null 2>&1
    corepack prepare pnpm@latest --activate > /dev/null 2>&1 || true
    ok "corepack enabled — pnpm available: $(pnpm --version 2>/dev/null || echo 'will download on first use')"
fi

# ---------------------------------------------------------------------------
# 4. Docker + Docker Compose plugin
# ---------------------------------------------------------------------------
if command -v docker &> /dev/null; then
    ok "Docker already installed: $(docker --version)"
else
    info "Installing Docker..."

    if [[ "$PKG_FAMILY" == "apt" ]]; then
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/${OS_ID}/gpg \
            | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
        chmod a+r /etc/apt/keyrings/docker.gpg

        echo \
            "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
            https://download.docker.com/linux/${OS_ID} \
            $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
            > /etc/apt/sources.list.d/docker.list

        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
            docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1

    elif [[ "$PKG_FAMILY" == "dnf" ]]; then
        dnf config-manager --add-repo \
            https://download.docker.com/linux/centos/docker-ce.repo > /dev/null 2>&1 || \
        dnf config-manager --add-repo \
            https://download.docker.com/linux/rhel/docker-ce.repo > /dev/null 2>&1

        dnf install -y docker-ce docker-ce-cli containerd.io \
            docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1
    fi

    systemctl enable --now docker
    ok "Docker installed."
fi

# Add user to docker group (so they can use docker without sudo)
if ! groups "$REAL_USER" | grep -q docker; then
    usermod -aG docker "$REAL_USER"
    DOCKER_GROUP_ADDED=true
    ok "Added $REAL_USER to docker group."
else
    ok "$REAL_USER already in docker group."
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================================================="
echo -e "${GREEN} System dependencies installed${NC}"
echo "============================================================================="
echo ""
echo -e "${CYAN}Versions:${NC}"
echo "  OS:       ${OS_ID} ${OS_VERSION}"
echo "  Node.js:  $(node --version 2>/dev/null || echo 'not found')"
echo "  pnpm:     $(pnpm --version 2>/dev/null || echo 'via corepack')"
echo "  Docker:   $(docker --version 2>/dev/null || echo 'not found')"
echo "  Compose:  $(docker compose version 2>/dev/null || echo 'not found')"
echo "  git:      $(git --version 2>/dev/null || echo 'not found')"
echo ""

if [[ "$DOCKER_GROUP_ADDED" == "true" ]]; then
    echo -e "${YELLOW}IMPORTANT: You were just added to the docker group.${NC}"
    echo -e "${YELLOW}Log out and back in before running the next script.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Log out and back in (required for docker group)"
    echo "  2. ./install_project.sh    (no sudo needed)"
else
    echo "Next step:"
    echo "  ./install_project.sh    (no sudo needed)"
fi
echo ""
