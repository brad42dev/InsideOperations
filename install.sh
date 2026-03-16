#!/usr/bin/env bash
# Inside/Operations — Installer
# Handles fresh installs and in-place upgrades.
# Must be run as root or via sudo.
#
# Usage:
#   sudo ./install.sh [OPTIONS]
#
# Options:
#   --non-interactive           Skip all prompts, use defaults
#   --db-mode=local|remote      PostgreSQL setup mode (default: local)
#   --db-url=URL                Connection URL when --db-mode=remote
#   --host=HOSTNAME_OR_IP       Server access address
#   --tls=self-signed|letsencrypt
#   --le-domain=DOMAIN          Domain name for Let's Encrypt
#   --no-admin                  Skip initial admin account creation
#   --no-backup                 Skip backup during upgrade
#   --version                   Print installer version and exit
set -euo pipefail

IO_VERSION="__VERSION__"
IO_INSTALL_DIR="/opt/io"
IO_USER="io"
IO_GROUP="io"
IO_CONFIG_FILE="${IO_INSTALL_DIR}/config/io.env"
IO_BACKUP_DIR="${IO_INSTALL_DIR}/backup"
INSTALLER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Runtime state (set by parse_args / ask_questions) ─────────────────────────
NON_INTERACTIVE="false"
DB_MODE="local"
DB_URL=""
SERVER_HOST=""
TLS_MODE="self-signed"
LE_DOMAIN=""
CREATE_ADMIN="true"
ADMIN_USER="admin"
ADMIN_PASS=""
CREATE_BACKUP="true"
MODE="fresh"                    # set by detect_mode
LAST_BACKUP_PATH=""

# Distro detection outputs
PKG_MGR=""
DISTRO_FAMILY=""
DISTRO_ID=""
DISTRO_VERSION=""
ARCH=""

# PostgreSQL service name (differs by distro — set in install_packages)
PG_SERVICE="postgresql"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}->  ${*}${RESET}"; }
ok()      { echo -e "${GREEN}    OK  ${*}${RESET}"; }
warn()    { echo -e "${YELLOW}   WARN ${*}${RESET}"; }
fail()    { echo -e "${RED}  ERROR ${*}${RESET}" >&2; }
bold()    { echo -e "${BOLD}${*}${RESET}"; }

# ── parse_args ────────────────────────────────────────────────────────────────
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --non-interactive)
                NON_INTERACTIVE="true"
                shift
                ;;
            --db-mode=*)
                DB_MODE="${1#*=}"
                shift
                ;;
            --db-url=*)
                DB_URL="${1#*=}"
                shift
                ;;
            --host=*)
                SERVER_HOST="${1#*=}"
                shift
                ;;
            --tls=*)
                TLS_MODE="${1#*=}"
                shift
                ;;
            --le-domain=*)
                LE_DOMAIN="${1#*=}"
                shift
                ;;
            --no-admin)
                CREATE_ADMIN="false"
                shift
                ;;
            --no-backup)
                CREATE_BACKUP="false"
                shift
                ;;
            --version)
                echo "Inside/Operations Installer v${IO_VERSION}"
                exit 0
                ;;
            --help|-h)
                head -20 "$0" | grep "^#" | sed 's/^# *//'
                exit 0
                ;;
            *)
                fail "Unknown argument: $1"
                exit 1
                ;;
        esac
    done
}

# ── check_root ────────────────────────────────────────────────────────────────
check_root() {
    if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
        fail "This installer must be run as root or with sudo."
        echo "  Try: sudo ./install.sh"
        exit 1
    fi
}

# ── detect_distro ─────────────────────────────────────────────────────────────
detect_distro() {
    DISTRO_ID="unknown"
    DISTRO_VERSION="0"

    if [[ -f /etc/os-release ]]; then
        # shellcheck source=/dev/null
        source /etc/os-release
        DISTRO_ID="${ID:-unknown}"
        DISTRO_VERSION="${VERSION_ID:-0}"
    fi

    case "$DISTRO_ID" in
        ubuntu|debian|linuxmint|pop)
            PKG_MGR="apt"
            DISTRO_FAMILY="debian"
            ;;
        rhel|centos|rocky|almalinux|fedora)
            PKG_MGR="dnf"
            DISTRO_FAMILY="rhel"
            ;;
        opensuse*|sles)
            PKG_MGR="zypper"
            DISTRO_FAMILY="suse"
            ;;
        *)
            if command -v apt-get &>/dev/null; then
                PKG_MGR="apt"
                DISTRO_FAMILY="debian"
            elif command -v dnf &>/dev/null; then
                PKG_MGR="dnf"
                DISTRO_FAMILY="rhel"
            elif command -v zypper &>/dev/null; then
                PKG_MGR="zypper"
                DISTRO_FAMILY="suse"
            else
                fail "Unsupported Linux distribution (ID=${DISTRO_ID})"
                echo "  Supported: Ubuntu, Debian, RHEL, Rocky, AlmaLinux, Fedora, openSUSE"
                exit 1
            fi
            ;;
    esac

    ok "Distribution: ${DISTRO_ID} ${DISTRO_VERSION} (${DISTRO_FAMILY}/${PKG_MGR})"
}

# ── detect_arch ───────────────────────────────────────────────────────────────
detect_arch() {
    local machine
    machine="$(uname -m)"
    case "$machine" in
        x86_64)  ARCH="x86_64" ;;
        aarch64) ARCH="aarch64" ;;
        *)
            warn "Unrecognised machine architecture: ${machine}. Proceeding anyway."
            ARCH="$machine"
            ;;
    esac
    ok "Architecture: ${ARCH}"
}

# ── detect_mode ───────────────────────────────────────────────────────────────
detect_mode() {
    if [[ -f "${IO_INSTALL_DIR}/.version" ]]; then
        MODE="upgrade"
    else
        MODE="fresh"
    fi
    ok "Install mode: ${MODE}"
}

# ── print_banner ──────────────────────────────────────────────────────────────
print_banner() {
    echo ""
    bold "╔══════════════════════════════════════════════════╗"
    bold "║        Inside/Operations  v${IO_VERSION}               ║"
    bold "║        Industrial Process Monitoring             ║"
    bold "╚══════════════════════════════════════════════════╝"
    echo ""
    if [[ "$MODE" == "upgrade" ]]; then
        local installed
        installed="$(cat "${IO_INSTALL_DIR}/.version" 2>/dev/null || echo "unknown")"
        info "Upgrading: ${installed} → ${IO_VERSION}"
    else
        info "Fresh installation"
    fi
    info "Distribution: ${DISTRO_ID} ${DISTRO_VERSION}"
    info "Architecture: ${ARCH}"
    echo ""
}

# ── ask_input / ask_choice helpers ───────────────────────────────────────────
ask_input() {
    local prompt="$1"
    local default="$2"
    local reply
    read -rp "  ${prompt} [${default}]: " reply
    REPLY="${reply:-$default}"
}

ask_choice() {
    local prompt="$1"
    local default="$2"
    shift 2
    local options=("$@")
    local reply
    read -rp "  ${prompt} ($(IFS=/ ; echo "${options[*]}")) [${default}]: " reply
    REPLY="${reply:-$default}"
}

# ── ask_questions ─────────────────────────────────────────────────────────────
ask_questions() {
    if [[ "$NON_INTERACTIVE" == "true" ]]; then
        # Apply defaults for unset values
        [[ -z "$SERVER_HOST" ]] && SERVER_HOST="$(hostname -I | awk '{print $1}')"
        if [[ "$DB_MODE" == "remote" && -z "$DB_URL" ]]; then
            fail "--db-mode=remote requires --db-url=URL"
            exit 1
        fi
        if [[ "$TLS_MODE" == "letsencrypt" && -z "$LE_DOMAIN" ]]; then
            fail "--tls=letsencrypt requires --le-domain=DOMAIN"
            exit 1
        fi
        if [[ "$CREATE_ADMIN" == "true" ]]; then
            ADMIN_PASS="$(openssl rand -base64 12 | tr -d '/+=')"
        fi
        return
    fi

    echo ""
    echo "┌──────────────────────────────────────────────────┐"
    echo "│      Inside/Operations — Configuration           │"
    echo "└──────────────────────────────────────────────────┘"
    echo ""

    # Q1: Database mode
    if [[ -z "$DB_MODE" || "$DB_MODE" == "local" ]]; then
        ask_choice "PostgreSQL setup" "local" "local" "remote"
        DB_MODE="$REPLY"
    fi

    if [[ "$DB_MODE" == "remote" ]]; then
        if [[ -z "$DB_URL" ]]; then
            ask_input "PostgreSQL connection URL" "postgresql://user:pass@host:5432/io_dev"
            DB_URL="$REPLY"
        fi
    fi

    # Q2: Server hostname / IP
    if [[ -z "$SERVER_HOST" ]]; then
        local detected_ip
        detected_ip="$(hostname -I | awk '{print $1}')"
        ask_input "Server hostname or IP address" "$detected_ip"
        SERVER_HOST="$REPLY"
    fi

    # Q3: TLS
    if [[ -z "$TLS_MODE" || "$TLS_MODE" == "self-signed" ]]; then
        ask_choice "TLS certificate" "self-signed" "self-signed" "letsencrypt"
        TLS_MODE="$REPLY"
    fi

    if [[ "$TLS_MODE" == "letsencrypt" && -z "$LE_DOMAIN" ]]; then
        ask_input "Domain name for Let's Encrypt" "$SERVER_HOST"
        LE_DOMAIN="$REPLY"
    fi

    # Q4: Admin account (fresh install only)
    if [[ "$MODE" == "fresh" && "$CREATE_ADMIN" == "true" ]]; then
        ask_choice "Create initial admin account" "yes" "yes" "no"
        if [[ "$REPLY" == "no" ]]; then
            CREATE_ADMIN="false"
        else
            ask_input "Admin username" "admin"
            ADMIN_USER="$REPLY"
            ADMIN_PASS="$(openssl rand -base64 12 | tr -d '/+=')"
            echo ""
            echo "  Auto-generated admin password: ${BOLD}${ADMIN_PASS}${RESET}"
            echo "  (Save this — it will not be shown again)"
            echo ""
        fi
    fi
}

# ── install_packages ──────────────────────────────────────────────────────────
install_packages() {
    info "Installing system packages (PostgreSQL 16, TimescaleDB, nginx)..."

    case "$DISTRO_FAMILY" in
        debian)
            _install_packages_apt
            PG_SERVICE="postgresql"
            ;;
        rhel)
            _install_packages_dnf
            PG_SERVICE="postgresql-16"
            ;;
        suse)
            _install_packages_zypper
            PG_SERVICE="postgresql"
            ;;
    esac
}

_install_packages_apt() {
    export DEBIAN_FRONTEND=noninteractive

    apt-get update -qq

    # Install prerequisites for repo setup
    apt-get install -y -qq curl gnupg lsb-release ca-certificates

    # PostgreSQL PGDG repo
    local codename
    codename="$(lsb_release -cs)"
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] \
https://apt.postgresql.org/pub/repos/apt ${codename}-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list

    # TimescaleDB repo
    curl -fsSL https://packagecloud.io/timescale/timescaledb/gpgkey \
        | gpg --dearmor -o /usr/share/keyrings/timescaledb-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/timescaledb-keyring.gpg] \
https://packagecloud.io/timescale/timescaledb/ubuntu/ ${codename} main" \
        > /etc/apt/sources.list.d/timescaledb.list

    apt-get update -qq
    apt-get install -y \
        postgresql-16 \
        timescaledb-2-postgresql-16 \
        nginx \
        curl \
        openssl

    ok "Packages installed (apt)"
}

_install_packages_dnf() {
    local rhel_ver
    rhel_ver="$(rpm -E '%{rhel}' 2>/dev/null || echo "0")"
    local fedora_ver
    fedora_ver="$(rpm -E '%{fedora}' 2>/dev/null || echo "0")"

    # PostgreSQL PGDG repo
    if [[ "$rhel_ver" != "0" && "$rhel_ver" != "%{rhel}" ]]; then
        dnf install -y \
            "https://download.postgresql.org/pub/repos/yum/reporpms/EL-${rhel_ver}-x86_64/pgdg-redhat-repo-latest.noarch.rpm" \
            2>/dev/null || true
    elif [[ "$fedora_ver" != "0" && "$fedora_ver" != "%{fedora}" ]]; then
        dnf install -y \
            "https://download.postgresql.org/pub/repos/yum/reporpms/F-${fedora_ver}-x86_64/pgdg-fedora-repo-latest.noarch.rpm" \
            2>/dev/null || true
    fi
    dnf -qy module disable postgresql 2>/dev/null || true

    # TimescaleDB repo
    local el_ver
    el_ver="$(rpm -E '%{rhel}' 2>/dev/null || echo "8")"
    [[ "$el_ver" == "%{rhel}" ]] && el_ver="8"
    tee /etc/yum.repos.d/timescaledb.repo > /dev/null <<EOF
[timescaledb]
name=timescaledb
baseurl=https://packagecloud.io/timescale/timescaledb/el/${el_ver}/\$basearch
repo_gpgcheck=1
gpgcheck=0
enabled=1
gpgkey=https://packagecloud.io/timescale/timescaledb/gpgkey
sslverify=1
EOF

    dnf install -y \
        postgresql16-server \
        timescaledb-2-postgresql-16 \
        nginx \
        curl \
        openssl

    # Initialise PostgreSQL data directory (idempotent)
    /usr/pgsql-16/bin/postgresql-16-setup initdb 2>/dev/null || true

    ok "Packages installed (dnf)"
}

_install_packages_zypper() {
    zypper addrepo \
        https://download.postgresql.org/pub/repos/zypp/repo/pgdg-sles-16.repo \
        2>/dev/null || true
    zypper --gpg-auto-import-keys refresh

    zypper install -y postgresql16-server nginx curl openssl || true
    warn "TimescaleDB packages may not be available for SUSE. Install manually if needed."
    warn "See: https://docs.timescale.com/self-hosted/latest/install/"

    ok "Packages installed (zypper)"
}

# ── create_io_user ────────────────────────────────────────────────────────────
create_io_user() {
    if ! id -u "$IO_USER" &>/dev/null; then
        info "Creating system user: ${IO_USER}"
        useradd \
            --system \
            --no-create-home \
            --shell /usr/sbin/nologin \
            --home-dir "${IO_INSTALL_DIR}" \
            --comment "Inside/Operations service account" \
            "$IO_USER"
        ok "User ${IO_USER} created"
    else
        ok "User ${IO_USER} already exists"
    fi
}

# ── setup_directories ─────────────────────────────────────────────────────────
setup_directories() {
    info "Creating installation directories..."
    local dirs=(
        "${IO_INSTALL_DIR}/bin"
        "${IO_INSTALL_DIR}/frontend"
        "${IO_INSTALL_DIR}/config"
        "${IO_INSTALL_DIR}/migrations"
        "${IO_INSTALL_DIR}/exports"
        "${IO_INSTALL_DIR}/uploads"
        "${IO_INSTALL_DIR}/backups"
        "${IO_BACKUP_DIR}"
        "/var/log/io"
    )

    for d in "${dirs[@]}"; do
        mkdir -p "$d"
    done

    chown -R "${IO_USER}:${IO_GROUP}" "${IO_INSTALL_DIR}"
    chown -R "${IO_USER}:${IO_GROUP}" "/var/log/io"
    chmod 750 "${IO_INSTALL_DIR}"
    chmod 750 "${IO_INSTALL_DIR}/config"

    ok "Directories created under ${IO_INSTALL_DIR}"
}

# ── setup_postgres ────────────────────────────────────────────────────────────
setup_postgres() {
    info "Configuring PostgreSQL..."

    # Enable TimescaleDB preload
    local pg_conf
    pg_conf="$(find /etc/postgresql /var/lib/pgsql -name "postgresql.conf" 2>/dev/null | head -1 || true)"
    if [[ -n "$pg_conf" ]]; then
        if ! grep -q "timescaledb" "$pg_conf"; then
            echo "shared_preload_libraries = 'timescaledb'" >> "$pg_conf"
            ok "TimescaleDB added to shared_preload_libraries"
        fi
    else
        warn "postgresql.conf not found — TimescaleDB preload must be set manually"
    fi

    # Enable and start PostgreSQL
    systemctl enable "$PG_SERVICE" 2>/dev/null || systemctl enable postgresql 2>/dev/null || true
    systemctl start  "$PG_SERVICE" 2>/dev/null || systemctl start  postgresql 2>/dev/null || true

    # Wait for PostgreSQL to become ready
    info "Waiting for PostgreSQL to become ready..."
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if pg_isready -U postgres &>/dev/null; then
            break
        fi
        retries=$((retries - 1))
        sleep 2
    done

    if [[ $retries -eq 0 ]]; then
        fail "PostgreSQL did not become ready in time."
        exit 1
    fi
    ok "PostgreSQL is ready"

    # Generate a random password for the io DB user
    local db_password
    db_password="$(openssl rand -base64 24 | tr -d '/+=')"

    # Create user and database
    sudo -u postgres psql -c "CREATE USER ${IO_USER} WITH PASSWORD '${db_password}';" 2>/dev/null \
        || sudo -u postgres psql -c "ALTER USER ${IO_USER} WITH PASSWORD '${db_password}';"
    sudo -u postgres psql -c "CREATE DATABASE io_dev OWNER ${IO_USER};" 2>/dev/null || true
    sudo -u postgres psql -d io_dev -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;" || true
    sudo -u postgres psql -d io_dev -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" || true
    sudo -u postgres psql -d io_dev -c "GRANT ALL PRIVILEGES ON DATABASE io_dev TO ${IO_USER};" || true
    sudo -u postgres psql -d io_dev -c "GRANT ALL ON SCHEMA public TO ${IO_USER};" || true

    ok "Database io_dev created with user ${IO_USER}"

    # Add scram-sha-256 authentication entries to pg_hba.conf
    local pg_hba
    pg_hba="$(find /etc/postgresql /var/lib/pgsql -name "pg_hba.conf" 2>/dev/null | head -1 || true)"
    if [[ -n "$pg_hba" ]]; then
        if ! grep -qE "^host.*io_dev.*io.*(md5|scram)" "$pg_hba"; then
            echo "host    io_dev          ${IO_USER}      127.0.0.1/32            scram-sha-256" >> "$pg_hba"
            echo "host    io_dev          ${IO_USER}      ::1/128                 scram-sha-256" >> "$pg_hba"
            systemctl reload "$PG_SERVICE" 2>/dev/null || systemctl reload postgresql 2>/dev/null || true
            ok "pg_hba.conf updated"
        fi
    fi

    DB_URL="postgresql://${IO_USER}:${db_password}@localhost:5432/io_dev"
    ok "Database URL configured"
}

# ── generate_env ──────────────────────────────────────────────────────────────
generate_env() {
    info "Generating runtime configuration..."

    local jwt_secret service_secret
    jwt_secret="$(openssl rand -base64 48 | tr -d '/+=\n')"
    service_secret="$(openssl rand -base64 48 | tr -d '/+=\n')"

    cat > "$IO_CONFIG_FILE" <<EOF
# Inside/Operations — Runtime Configuration
# Generated by installer v${IO_VERSION} on $(date -u +"%Y-%m-%d %H:%M:%S UTC")
#
# Edit this file to change configuration, then restart services:
#   sudo systemctl restart 'io-*.service'

IO_DATABASE_URL=${DB_URL}
IO_JWT_SECRET=${jwt_secret}
IO_SERVICE_SECRET=${service_secret}
IO_LOG_LEVEL=info
IO_TRACING_ENABLED=false
IO_METRICS_COLLECTOR_ENABLED=true
IO_EXPORT_DIR=${IO_INSTALL_DIR}/exports

AUTH_SERVICE_URL=http://127.0.0.1:3009
EVENT_SERVICE_URL=http://127.0.0.1:3003
EOF

    chmod 640 "$IO_CONFIG_FILE"
    chown "root:${IO_GROUP}" "$IO_CONFIG_FILE"
    ok "Config written to ${IO_CONFIG_FILE}"
}

# ── merge_env ─────────────────────────────────────────────────────────────────
merge_env() {
    local example="${INSTALLER_DIR}/config/io.env.example"
    [[ -f "$example" ]] || return 0

    info "Merging new configuration keys..."
    local added=0

    while IFS= read -r line; do
        # Skip comments and blank lines
        [[ "$line" =~ ^#|^[[:space:]]*$ ]] && continue
        local key="${line%%=*}"
        if ! grep -q "^${key}=" "$IO_CONFIG_FILE" 2>/dev/null; then
            echo "$line" >> "$IO_CONFIG_FILE"
            ok "+ Added new config key: ${key}"
            added=$((added + 1))
        fi
    done < "$example"

    if [[ $added -eq 0 ]]; then
        ok "No new config keys to add"
    fi
}

# ── run_migrations ────────────────────────────────────────────────────────────
run_migrations() {
    local db_url="$1"
    local sqlx_bin="${INSTALLER_DIR}/bin/sqlx"

    info "Running database migrations..."

    if [[ -x "$sqlx_bin" ]]; then
        "$sqlx_bin" migrate run \
            --database-url "$db_url" \
            --source "${INSTALLER_DIR}/migrations"
        ok "Migrations applied via sqlx-cli"
    else
        # Fallback: run .sql files directly via psql in filename order
        warn "sqlx-cli not found — running migrations directly via psql"
        local migration_dir="${INSTALLER_DIR}/migrations"
        if [[ ! -d "$migration_dir" ]]; then
            warn "No migrations directory found at ${migration_dir}"
            return 0
        fi

        local count=0
        for f in "${migration_dir}"/*.sql; do
            [[ -f "$f" ]] || continue
            psql "$db_url" -f "$f" -q 2>&1 | grep -v "^$" || true
            count=$((count + 1))
        done
        ok "Applied ${count} migration file(s) via psql"
    fi
}

# ── deploy_binaries ───────────────────────────────────────────────────────────
deploy_binaries() {
    info "Deploying service binaries..."
    local count=0

    for bin in "${INSTALLER_DIR}/bin/"*; do
        [[ -f "$bin" ]] || continue
        local name
        name="$(basename "$bin")"
        cp "$bin" "${IO_INSTALL_DIR}/bin/${name}"
        chmod +x "${IO_INSTALL_DIR}/bin/${name}"
        count=$((count + 1))
    done

    chown -R "${IO_USER}:${IO_GROUP}" "${IO_INSTALL_DIR}/bin"
    ok "Deployed ${count} binary/binaries to ${IO_INSTALL_DIR}/bin/"
}

# ── deploy_frontend ───────────────────────────────────────────────────────────
deploy_frontend() {
    info "Deploying frontend assets..."

    if [[ ! -d "${INSTALLER_DIR}/frontend" ]]; then
        warn "No frontend/ directory in installer — skipping"
        return 0
    fi

    rm -rf "${IO_INSTALL_DIR}/frontend"
    mkdir -p "${IO_INSTALL_DIR}/frontend"
    cp -r "${INSTALLER_DIR}/frontend/." "${IO_INSTALL_DIR}/frontend/"
    chown -R "${IO_USER}:${IO_GROUP}" "${IO_INSTALL_DIR}/frontend"
    ok "Frontend deployed to ${IO_INSTALL_DIR}/frontend/"
}

# ── install_systemd_units ─────────────────────────────────────────────────────
install_systemd_units() {
    info "Installing systemd service units..."
    local count=0

    for svc_file in "${INSTALLER_DIR}/systemd/"*.service; do
        [[ -f "$svc_file" ]] || continue
        cp "$svc_file" /etc/systemd/system/
        count=$((count + 1))
    done

    if [[ $count -eq 0 ]]; then
        warn "No .service files found in ${INSTALLER_DIR}/systemd/"
        return 0
    fi

    systemctl daemon-reload

    for svc_file in "${INSTALLER_DIR}/systemd/"*.service; do
        [[ -f "$svc_file" ]] || continue
        local name
        name="$(basename "$svc_file" .service)"
        systemctl enable "$name" 2>/dev/null || true
    done

    ok "Installed and enabled ${count} systemd unit(s)"
}

# ── install_sudoers ───────────────────────────────────────────────────────────
install_sudoers() {
    info "Installing sudoers snippet for service management..."
    cat > /etc/sudoers.d/io-services <<'EOF'
# Allow the io service account to start/stop/restart io-* systemd services
# without a password. This enables health-check-driven restarts.
io ALL=(root) NOPASSWD: /bin/systemctl start io-*.service
io ALL=(root) NOPASSWD: /bin/systemctl stop io-*.service
io ALL=(root) NOPASSWD: /bin/systemctl restart io-*.service
io ALL=(root) NOPASSWD: /bin/systemctl reload io-*.service
io ALL=(root) NOPASSWD: /bin/systemctl status io-*.service
EOF
    chmod 440 /etc/sudoers.d/io-services
    ok "Sudoers snippet written to /etc/sudoers.d/io-services"
}

# ── setup_nginx ───────────────────────────────────────────────────────────────
setup_nginx() {
    info "Configuring nginx..."

    local nginx_conf_src="${INSTALLER_DIR}/nginx/io.nginx.conf"
    [[ -f "$nginx_conf_src" ]] || { warn "nginx/io.nginx.conf not found — skipping nginx setup"; return 0; }

    local serve_dir="${IO_INSTALL_DIR}/frontend"
    local tls_cert tls_key

    # ── TLS certificates ──────────────────────────────────────────────────────
    mkdir -p /etc/io/tls /etc/io/nginx

    if [[ "$TLS_MODE" == "letsencrypt" ]]; then
        if command -v certbot &>/dev/null; then
            certbot certonly \
                --standalone \
                --non-interactive \
                --agree-tos \
                --email "admin@${LE_DOMAIN}" \
                -d "$LE_DOMAIN" \
                2>/dev/null || warn "certbot failed — falling back to self-signed"

            local le_path="/etc/letsencrypt/live/${LE_DOMAIN}"
            if [[ -f "${le_path}/fullchain.pem" ]]; then
                tls_cert="${le_path}/fullchain.pem"
                tls_key="${le_path}/privkey.pem"
                ok "Let's Encrypt certificate obtained for ${LE_DOMAIN}"
            else
                warn "Let's Encrypt cert not found — falling back to self-signed"
                TLS_MODE="self-signed"
            fi
        else
            warn "certbot not installed — falling back to self-signed"
            TLS_MODE="self-signed"
        fi
    fi

    if [[ "$TLS_MODE" == "self-signed" ]]; then
        local host="${SERVER_HOST:-$(hostname -I | awk '{print $1}')}"
        tls_cert="/etc/io/tls/self-signed.crt"
        tls_key="/etc/io/tls/self-signed.key"

        if [[ ! -f "$tls_cert" ]]; then
            info "Generating self-signed TLS certificate for ${host}..."
            openssl req -x509 -nodes -newkey rsa:2048 \
                -keyout "$tls_key" \
                -out   "$tls_cert" \
                -days  3650 \
                -subj  "/CN=${host}/O=InsideOperations/C=US" \
                -addext "subjectAltName=IP:${host},DNS:${host}" \
                2>/dev/null
            chmod 600 "$tls_key"
            ok "Self-signed certificate generated"
        else
            ok "Existing self-signed certificate found"
        fi
    fi

    # Write the tls.conf include
    cat > /etc/io/nginx/tls.conf <<EOF
ssl_certificate     ${tls_cert};
ssl_certificate_key ${tls_key};
ssl_protocols       TLSv1.2 TLSv1.3;
ssl_ciphers         HIGH:!aNULL:!MD5;
ssl_session_cache   shared:SSL:10m;
ssl_session_timeout 10m;
EOF

    # Install nginx config, substituting placeholders
    local nginx_dest
    if [[ "$DISTRO_FAMILY" == "rhel" || "$DISTRO_FAMILY" == "suse" ]]; then
        nginx_dest="/etc/nginx/conf.d/io.conf"
        # Disable any default config that might clash
        rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
    else
        mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
        nginx_dest="/etc/nginx/sites-available/io"
        rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    fi

    sed \
        -e "s|__SERVER_HOST__|${SERVER_HOST:-_}|g" \
        -e "s|__SERVE_DIR__|${serve_dir}|g" \
        -e "s|__TLS_CERT__|${tls_cert}|g" \
        -e "s|__TLS_KEY__|${tls_key}|g" \
        "$nginx_conf_src" > "$nginx_dest"

    # Enable site on Debian-family
    if [[ "$DISTRO_FAMILY" == "debian" ]]; then
        ln -sf "$nginx_dest" /etc/nginx/sites-enabled/io 2>/dev/null || true
    fi

    # Test nginx config then enable and start
    nginx -t 2>/dev/null && ok "nginx config syntax OK" || warn "nginx config test failed — check ${nginx_dest}"

    systemctl enable nginx 2>/dev/null || true
    systemctl restart nginx 2>/dev/null || warn "Could not restart nginx — check manually"

    ok "nginx configured: ${nginx_dest}"
}

# ── create_backup ─────────────────────────────────────────────────────────────
create_backup() {
    local backup_path="${IO_BACKUP_DIR}/$(date +%Y%m%d_%H%M%S)"
    info "Creating backup at ${backup_path}..."
    mkdir -p "$backup_path"

    # Binaries
    [[ -d "${IO_INSTALL_DIR}/bin" ]] && cp -r "${IO_INSTALL_DIR}/bin" "${backup_path}/"

    # Config (copy but restrict permissions)
    [[ -f "$IO_CONFIG_FILE" ]] && cp "$IO_CONFIG_FILE" "${backup_path}/" && chmod 600 "${backup_path}/$(basename "$IO_CONFIG_FILE")"

    # Frontend
    [[ -d "${IO_INSTALL_DIR}/frontend" ]] && cp -r "${IO_INSTALL_DIR}/frontend" "${backup_path}/"

    # Version file
    cat "${IO_INSTALL_DIR}/.version" > "${backup_path}/.version" 2>/dev/null || true

    ok "Backup complete: ${backup_path}"
    LAST_BACKUP_PATH="$backup_path"
}

# ── do_rollback ───────────────────────────────────────────────────────────────
do_rollback() {
    if [[ -z "${LAST_BACKUP_PATH:-}" ]]; then
        fail "No backup available for rollback"
        return 1
    fi

    info "Rolling back to previous version..."
    systemctl stop 'io-*.service' 2>/dev/null || true

    if [[ -d "${LAST_BACKUP_PATH}/bin" ]]; then
        cp -r "${LAST_BACKUP_PATH}/bin/." "${IO_INSTALL_DIR}/bin/"
    fi

    if [[ -d "${LAST_BACKUP_PATH}/frontend" ]]; then
        cp -r "${LAST_BACKUP_PATH}/frontend/." "${IO_INSTALL_DIR}/frontend/"
    fi

    if [[ -f "${LAST_BACKUP_PATH}/$(basename "$IO_CONFIG_FILE")" ]]; then
        cp "${LAST_BACKUP_PATH}/$(basename "$IO_CONFIG_FILE")" "$IO_CONFIG_FILE"
    fi

    systemctl start 'io-*.service' 2>/dev/null || true
    ok "Rolled back to $(cat "${LAST_BACKUP_PATH}/.version" 2>/dev/null || echo "previous version")"
}

# ── prune_backups ─────────────────────────────────────────────────────────────
prune_backups() {
    local count
    count="$(ls -1d "${IO_BACKUP_DIR}"/20* 2>/dev/null | wc -l)"
    if [[ $count -gt 3 ]]; then
        local to_remove=$(( count - 3 ))
        # shellcheck disable=SC2012
        ls -1d "${IO_BACKUP_DIR}"/20* 2>/dev/null | head -"${to_remove}" | xargs rm -rf
        ok "Pruned ${to_remove} old backup(s) (keeping 3)"
    fi
}

# ── start_services ────────────────────────────────────────────────────────────
start_services() {
    info "Starting Inside/Operations services..."
    systemctl start 'io-*.service' 2>/dev/null || true
    ok "Services started"
}

# ── health_check ──────────────────────────────────────────────────────────────
health_check() {
    local -a svc_ports=(
        "api-gateway:3000"
        "auth-service:3009"
        "data-broker:3001"
        "event-service:3003"
        "archive-service:3005"
    )

    info "Waiting for services to pass health checks (60s timeout)..."
    local timeout=60
    local all_ok=true

    for svc_port in "${svc_ports[@]}"; do
        local svc="${svc_port%%:*}"
        local port="${svc_port##*:}"
        local passed=false
        local elapsed=0

        while [[ $elapsed -lt $timeout ]]; do
            if curl -sf "http://localhost:${port}/health/live" &>/dev/null; then
                ok "${svc} is healthy"
                passed=true
                break
            fi
            sleep 2
            elapsed=$(( elapsed + 2 ))
        done

        if [[ "$passed" == "false" ]]; then
            fail "${svc} did not become healthy within ${timeout}s"
            all_ok=false
        fi
    done

    echo "$all_ok"
}

# ── seed_admin ────────────────────────────────────────────────────────────────
seed_admin() {
    [[ "$CREATE_ADMIN" == "true" && -n "$ADMIN_PASS" ]] || return 0

    info "Creating initial admin account (${ADMIN_USER})..."

    # Call the API if the gateway is up, otherwise log for later
    if curl -sf "http://localhost:3000/health/live" &>/dev/null; then
        curl -sf -X POST "http://localhost:3000/api/v1/internal/seed-admin" \
            -H "Content-Type: application/json" \
            -H "X-Service-Secret: $(grep "^IO_SERVICE_SECRET=" "$IO_CONFIG_FILE" | cut -d= -f2-)" \
            -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}" \
            &>/dev/null && ok "Admin account created" \
            || warn "Could not create admin via API — use the CLI tool post-install"
    else
        warn "API gateway not yet reachable — admin account not seeded automatically"
        warn "Create it manually: see documentation for io-cli seed-admin"
    fi
}

# ── print_success ─────────────────────────────────────────────────────────────
print_success() {
    local host="${SERVER_HOST:-$(hostname -I | awk '{print $1}')}"
    echo ""
    bold "╔══════════════════════════════════════════════════════╗"
    bold "║   Inside/Operations v${IO_VERSION} — Installation Complete!  ║"
    bold "╚══════════════════════════════════════════════════════╝"
    echo ""
    echo "  URL:      https://${host}/"
    echo "  API:      https://${host}/api/"
    echo ""
    if [[ -n "${ADMIN_USER:-}" && -n "${ADMIN_PASS:-}" && "$CREATE_ADMIN" == "true" ]]; then
        echo "  Admin user:     ${ADMIN_USER}"
        echo "  Admin password: ${BOLD}${ADMIN_PASS}${RESET}"
        echo "  (Change this password after first login)"
        echo ""
    fi
    echo "  Manage services:  systemctl status 'io-*.service'"
    echo "  View logs:        journalctl -u io-api-gateway -f"
    echo "  Edit config:      ${IO_CONFIG_FILE}"
    echo ""
    echo "  To upgrade later, transfer the new installer tarball and run:"
    echo "    sudo ./install.sh"
    echo ""
}

# ── do_fresh_install ──────────────────────────────────────────────────────────
do_fresh_install() {
    info "Starting fresh installation of Inside/Operations v${IO_VERSION}"
    echo ""

    ask_questions
    install_packages
    create_io_user
    setup_directories

    if [[ "$DB_MODE" == "local" ]]; then
        setup_postgres
    else
        ok "Using remote database: ${DB_URL}"
    fi

    generate_env
    run_migrations "$DB_URL"
    deploy_binaries
    deploy_frontend
    install_systemd_units
    install_sudoers
    setup_nginx
    start_services

    # Health check
    local health_result
    health_result="$(health_check)"
    if [[ "$health_result" != "true" ]]; then
        echo ""
        warn "Some services failed health checks. Installation may be incomplete."
        warn "Check service logs: journalctl -u io-api-gateway -f"
    fi

    seed_admin

    # Write installed version
    echo "$IO_VERSION" > "${IO_INSTALL_DIR}/.version"

    print_success
}

# ── do_upgrade ────────────────────────────────────────────────────────────────
do_upgrade() {
    local installed_version
    installed_version="$(cat "${IO_INSTALL_DIR}/.version" 2>/dev/null || echo "unknown")"

    info "Upgrading Inside/Operations: ${installed_version} → ${IO_VERSION}"
    echo ""

    # Prompt for backup unless non-interactive or --no-backup
    if [[ "$NON_INTERACTIVE" != "true" && "${CREATE_BACKUP}" == "true" ]]; then
        local reply
        read -rp "  Create backup before upgrade? [yes]: " reply
        reply="${reply:-yes}"
        if [[ "$reply" == "no" ]]; then
            CREATE_BACKUP="false"
        fi
    fi

    if [[ "${CREATE_BACKUP}" == "true" ]]; then
        create_backup
    fi

    # Stop services before replacing binaries
    info "Stopping services..."
    systemctl stop 'io-*.service' 2>/dev/null || true
    ok "Services stopped"

    # Deploy new binaries and frontend
    deploy_binaries
    deploy_frontend

    # Merge any new environment variables (does not overwrite existing keys)
    merge_env

    # Run any new migrations
    local db_url
    db_url="$(grep "^IO_DATABASE_URL=" "$IO_CONFIG_FILE" | cut -d= -f2-)"
    if [[ -z "$db_url" ]]; then
        fail "Could not read IO_DATABASE_URL from ${IO_CONFIG_FILE}"
        exit 1
    fi
    run_migrations "$db_url"

    # Update systemd units (in case they changed)
    install_systemd_units

    # Start services
    info "Starting services..."
    systemctl start 'io-*.service' 2>/dev/null || true
    ok "Services started"

    # Health check — rollback on failure
    local health_result
    health_result="$(health_check)"
    if [[ "$health_result" != "true" ]]; then
        echo ""
        fail "Health check failed after upgrade. Rolling back..."
        do_rollback
        exit 1
    fi

    # Commit new version
    echo "$IO_VERSION" > "${IO_INSTALL_DIR}/.version"

    # Prune old backups (keep last 3)
    prune_backups

    print_success
}

# ── main ──────────────────────────────────────────────────────────────────────
main() {
    parse_args "$@"
    check_root
    detect_distro
    detect_arch
    detect_mode
    print_banner

    if [[ "$MODE" == "upgrade" ]]; then
        do_upgrade
    else
        do_fresh_install
    fi
}

main "$@"
