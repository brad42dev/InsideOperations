#!/usr/bin/env bash
# Inside/Operations — Uninstaller
# Stops and removes Inside/Operations services, binaries, and nginx config.
# Does NOT remove PostgreSQL, its data, or the database by default.
#
# Usage:
#   sudo ./uninstall.sh [--purge] [--yes]
#
# Options:
#   --purge   Also remove /opt/io entirely (including data/exports/backups),
#             the 'io' system user, and the io_dev database.
#   --yes     Skip confirmation prompt (non-interactive).
set -euo pipefail

IO_INSTALL_DIR="/opt/io"
IO_USER="io"
IO_GROUP="io"

PURGE="false"
NON_INTERACTIVE="false"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info() { echo -e "${CYAN}->  ${*}${RESET}"; }
ok()   { echo -e "${GREEN}    OK  ${*}${RESET}"; }
warn() { echo -e "${YELLOW}   WARN ${*}${RESET}"; }
fail() { echo -e "${RED}  ERROR ${*}${RESET}" >&2; }

# ── parse_args ────────────────────────────────────────────────────────────────
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --purge)
                PURGE="true"
                shift
                ;;
            --yes|-y)
                NON_INTERACTIVE="true"
                shift
                ;;
            --help|-h)
                head -14 "$0" | grep "^#" | sed 's/^# *//'
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
        fail "This uninstaller must be run as root or with sudo."
        echo "  Try: sudo ./uninstall.sh"
        exit 1
    fi
}

# ── confirm ───────────────────────────────────────────────────────────────────
confirm() {
    if [[ "$NON_INTERACTIVE" == "true" ]]; then return 0; fi

    local installed_version="unknown"
    [[ -f "${IO_INSTALL_DIR}/.version" ]] && installed_version="$(cat "${IO_INSTALL_DIR}/.version")"

    echo ""
    echo -e "${BOLD}Inside/Operations v${installed_version} — Uninstaller${RESET}"
    echo ""

    if [[ "$PURGE" == "true" ]]; then
        echo -e "${RED}WARNING: --purge will remove ALL data under ${IO_INSTALL_DIR},"
        echo -e "         the '${IO_USER}' system user, and the io_dev database.${RESET}"
    else
        echo "  This will stop all io-* services, remove binaries, systemd units,"
        echo "  nginx config, and the sudoers snippet."
        echo "  PostgreSQL, its data, and /opt/io/backup/ will NOT be removed."
    fi
    echo ""

    local reply
    read -rp "  Continue? [yes/no]: " reply
    case "${reply:-}" in
        yes|YES|y|Y) return 0 ;;
        *)
            echo "Uninstall cancelled."
            exit 0
            ;;
    esac
}

# ── stop_and_disable_services ─────────────────────────────────────────────────
stop_and_disable_services() {
    info "Stopping io-* services..."

    local stopped=0
    local services
    # shellcheck disable=SC2012
    services="$(ls /etc/systemd/system/io-*.service 2>/dev/null | xargs -I{} basename {} .service || true)"

    for svc in $services; do
        if systemctl is-active --quiet "$svc" 2>/dev/null; then
            systemctl stop "$svc" 2>/dev/null && ok "Stopped ${svc}" || warn "Could not stop ${svc}"
            stopped=$((stopped + 1))
        fi
        systemctl disable "$svc" 2>/dev/null || true
    done

    # Also stop by glob pattern in case unit files are already gone
    systemctl stop 'io-*.service' 2>/dev/null || true

    if [[ $stopped -gt 0 ]]; then
        ok "Stopped ${stopped} service(s)"
    else
        ok "No running io-* services found"
    fi
}

# ── remove_systemd_units ──────────────────────────────────────────────────────
remove_systemd_units() {
    info "Removing systemd unit files..."
    local count=0

    for f in /etc/systemd/system/io-*.service /etc/systemd/system/io.target; do
        if [[ -f "$f" ]]; then
            rm -f "$f"
            count=$((count + 1))
        fi
    done

    if [[ $count -gt 0 ]]; then
        systemctl daemon-reload
        ok "Removed ${count} systemd unit file(s)"
    else
        ok "No systemd unit files found"
    fi
}

# ── remove_sudoers ────────────────────────────────────────────────────────────
remove_sudoers() {
    if [[ -f /etc/sudoers.d/io-services ]]; then
        rm -f /etc/sudoers.d/io-services
        ok "Removed /etc/sudoers.d/io-services"
    else
        ok "No sudoers snippet found"
    fi
}

# ── remove_nginx_config ───────────────────────────────────────────────────────
remove_nginx_config() {
    info "Removing nginx configuration..."
    local removed=false

    # Debian-family: sites-available + sites-enabled
    if [[ -f /etc/nginx/sites-enabled/io ]]; then
        rm -f /etc/nginx/sites-enabled/io
        removed=true
    fi
    if [[ -f /etc/nginx/sites-available/io ]]; then
        rm -f /etc/nginx/sites-available/io
        removed=true
    fi

    # RHEL/SUSE: conf.d
    if [[ -f /etc/nginx/conf.d/io.conf ]]; then
        rm -f /etc/nginx/conf.d/io.conf
        removed=true
    fi

    # Remove TLS config include
    if [[ -d /etc/io/nginx ]]; then
        rm -rf /etc/io/nginx
        removed=true
    fi

    if [[ "$removed" == "true" ]]; then
        systemctl reload nginx 2>/dev/null || warn "nginx reload failed — may need manual reload"
        ok "nginx configuration removed"
    else
        ok "No nginx configuration found"
    fi
}

# ── remove_install_dir ────────────────────────────────────────────────────────
remove_install_dir() {
    if [[ "$PURGE" == "true" ]]; then
        info "Removing ${IO_INSTALL_DIR} (--purge)..."
        rm -rf "${IO_INSTALL_DIR}"
        ok "Removed ${IO_INSTALL_DIR}"
    else
        # Remove binaries and frontend only — preserve config, backups, exports
        info "Removing binaries and frontend from ${IO_INSTALL_DIR}..."

        [[ -d "${IO_INSTALL_DIR}/bin" ]] && rm -rf "${IO_INSTALL_DIR}/bin" && ok "Removed bin/"
        [[ -d "${IO_INSTALL_DIR}/frontend" ]] && rm -rf "${IO_INSTALL_DIR}/frontend" && ok "Removed frontend/"
        [[ -f "${IO_INSTALL_DIR}/.version" ]] && rm -f "${IO_INSTALL_DIR}/.version"

        warn "Preserved: ${IO_INSTALL_DIR}/config/, backup/, exports/, uploads/"
        warn "Run with --purge to remove everything."
    fi
}

# ── remove_user ───────────────────────────────────────────────────────────────
remove_user() {
    if [[ "$PURGE" == "true" ]]; then
        if id -u "$IO_USER" &>/dev/null; then
            info "Removing system user: ${IO_USER}..."
            userdel "$IO_USER" 2>/dev/null || true
            ok "User ${IO_USER} removed"
        else
            ok "User ${IO_USER} not found"
        fi
    fi
}

# ── remove_database ───────────────────────────────────────────────────────────
remove_database() {
    if [[ "$PURGE" != "true" ]]; then return 0; fi

    info "Removing io_dev database and io user from PostgreSQL..."

    # Check that postgres is running
    if ! pg_isready -U postgres &>/dev/null; then
        warn "PostgreSQL is not running — skipping database removal"
        return 0
    fi

    sudo -u postgres psql -c "DROP DATABASE IF EXISTS io_dev;" 2>/dev/null && ok "Database io_dev dropped" || warn "Could not drop io_dev"
    sudo -u postgres psql -c "DROP USER IF EXISTS io;" 2>/dev/null && ok "PostgreSQL user io dropped" || warn "Could not drop PostgreSQL user io"
}

# ── remove_tls_certs ──────────────────────────────────────────────────────────
remove_tls_certs() {
    if [[ "$PURGE" == "true" && -d /etc/io/tls ]]; then
        info "Removing self-signed TLS certificates..."
        rm -rf /etc/io/tls
        # Remove parent dir if empty
        rmdir /etc/io 2>/dev/null || true
        ok "TLS certificates removed"
    fi
}

# ── remove_log_dir ────────────────────────────────────────────────────────────
remove_log_dir() {
    if [[ "$PURGE" == "true" && -d /var/log/io ]]; then
        info "Removing log directory /var/log/io..."
        rm -rf /var/log/io
        ok "Log directory removed"
    fi
}

# ── print_summary ─────────────────────────────────────────────────────────────
print_summary() {
    echo ""
    echo -e "${BOLD}Uninstall Summary${RESET}"
    echo "  ─────────────────────────────────────────────"
    echo "  Removed:  io-* systemd services and units"
    echo "  Removed:  nginx site configuration"
    echo "  Removed:  /etc/sudoers.d/io-services"
    echo "  Removed:  Service binaries and frontend assets"

    if [[ "$PURGE" == "true" ]]; then
        echo "  Removed:  ${IO_INSTALL_DIR} (all data)"
        echo "  Removed:  System user '${IO_USER}'"
        echo "  Removed:  io_dev PostgreSQL database"
        echo "  Removed:  TLS certificates and log directory"
    else
        echo ""
        echo "  Preserved:"
        echo "    ${IO_INSTALL_DIR}/config/   (environment config)"
        echo "    ${IO_INSTALL_DIR}/backup/   (version backups)"
        echo "    ${IO_INSTALL_DIR}/exports/  (generated reports)"
        echo "    PostgreSQL data             (use --purge to remove)"
    fi

    echo ""
    echo "  PostgreSQL itself was NOT uninstalled."
    if [[ "$PURGE" != "true" ]]; then
        echo "  Re-run with --purge to remove all data."
    fi
    echo ""
    ok "Inside/Operations has been removed."
    echo ""
}

# ── main ──────────────────────────────────────────────────────────────────────
main() {
    parse_args "$@"
    check_root
    confirm
    stop_and_disable_services
    remove_systemd_units
    remove_sudoers
    remove_nginx_config
    remove_install_dir
    remove_tls_certs
    remove_log_dir
    remove_user
    remove_database
    print_summary
}

main "$@"
