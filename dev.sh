#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env if present
if [[ -f .env ]]; then
    set -a
    source .env
    set +a
fi

SERVICES=(
    "api-gateway:3000"
    "data-broker:3001"
    "opc-service:3002"
    "event-service:3003"
    "parser-service:3004"
    "archive-service:3005"
    "import-service:3006"
    "alert-service:3007"
    "email-service:3008"
    "auth-service:3009"
    "recognition-service:3010"
    "video-export-service:3011"
)

PID_DIR="/tmp/io-dev-pids"
LOG_DIR="/tmp/io-dev-logs"

usage() {
    echo "Inside/Operations Development Script"
    echo ""
    echo "Usage: ./dev.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start         Start all services and the database"
    echo "  stop          Stop all services"
    echo "  restart       Restart all services"
    echo "  status        Show status of all services"
    echo "  logs [svc]    Show logs (all services or a specific one)"
    echo "  db start      Start only the database"
    echo "  db stop       Stop the database"
    echo "  db reset      Drop and recreate the database"
    echo "  db migrate    Run pending database migrations"
    echo "  db seed       Run database seed data"
    echo "  build         Build all Rust services and restart any that were running"
    echo "  build-only    Build all Rust services without restarting (CI / manual control)"
    echo "  frontend      Start the frontend dev server (Vite, port 5173)"
    echo "  nginx         Install/update nginx + TLS for HTTPS access on port 443"
    echo "  deploy-front  Build frontend and copy to /opt/io/frontend (nginx serve)"
    echo "  clean         Stop services and clean build artifacts"
    echo "  build-installer   Build a release installer tarball (uses scripts/build-installer.sh)"
    echo "  health            Check /health/live on all 12 services"
    echo "  shapes export     Snapshot all library shapes from DB to shapes-snapshot.json"
    echo "  shapes import [--force]"
    echo "                    Import shapes-source/ files into DB."
    echo "                    Blocks removal of addon IDs, connection IDs, or"
    echo "                    bindableParts keys (use --force to override)."
    echo "  shapes restore    Restore library shapes from shapes-snapshot.json"
    echo ""
}

check_deps() {
    local missing=()
    for dep in docker cargo sqlx; do
        if ! command -v "$dep" &>/dev/null; then
            missing+=("$dep")
        fi
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "ERROR: Missing dependencies: ${missing[*]}"
        echo "Install them before running dev.sh"
        exit 1
    fi
}

db_start() {
    echo "-> Starting database..."
    docker compose up -d db
    echo "-> Waiting for database to be ready..."
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if docker compose exec db pg_isready -U io -d io_dev &>/dev/null; then
            echo "OK Database ready"
            return 0
        fi
        retries=$((retries - 1))
        sleep 2
    done
    echo "FAIL Database failed to start"
    exit 1
}

db_stop() {
    echo "-> Stopping database..."
    docker compose stop db
    echo "OK Database stopped"
}

db_reset() {
    echo "-> Resetting database (DROP and recreate)..."
    docker compose exec db psql -U io -d postgres -c "DROP DATABASE IF EXISTS io_dev;" || true
    docker compose exec db psql -U io -d postgres -c "CREATE DATABASE io_dev;"
    docker compose exec db psql -U io -d io_dev -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"
    docker compose exec db psql -U io -d io_dev -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
    echo "OK Database reset"
}

db_migrate() {
    echo "-> Running database migrations..."
    local db_url="${IO_DATABASE_URL:-postgresql://io:io_password@localhost:5432/io_dev}"
    sqlx migrate run --database-url "$db_url" --source ./migrations
    echo "OK Migrations complete"
}

build_only_services() {
    echo "-> Building all Rust services..."
    cargo build --workspace 2>&1 | tail -5
    echo "OK Build complete"
}

build_and_restart_services() {
    # Capture which services are currently running before the build
    local running_services=()
    for svc in "${SERVICES[@]}"; do
        local name="${svc%%:*}"
        local pid_file="$PID_DIR/${name}.pid"
        if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
            running_services+=("$svc")
        fi
    done

    if [[ ${#running_services[@]} -gt 0 ]]; then
        echo "-> Detected ${#running_services[@]} running service(s): ${running_services[*]%%:*}"
    else
        echo "-> No services currently running — build only"
    fi

    # Build
    build_only_services

    # Restart only the services that were running before the build
    if [[ ${#running_services[@]} -gt 0 ]]; then
        echo "-> Restarting services with new binaries..."
        for svc in "${running_services[@]}"; do
            stop_service "$svc"
        done
        for svc in "${running_services[@]}"; do
            start_service "$svc"
        done
        echo "OK Services restarted — running processes now use the new binary"
    fi
}

start_service() {
    local name="${1%%:*}"
    local port="${1##*:}"
    local log_file="$LOG_DIR/${name}.log"
    local pid_file="$PID_DIR/${name}.pid"

    if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "  -> ${name} already running ($(cat "$pid_file"))"
        return 0
    fi

    mkdir -p "$LOG_DIR" "$PID_DIR"

    # Ensure the report export directory exists (used by api-gateway)
    mkdir -p /tmp/io-exports

    PORT="$port" \
    IO_DATABASE_URL="${IO_DATABASE_URL:-postgresql://io:io_password@localhost:5432/io_dev}" \
    IO_JWT_SECRET="${IO_JWT_SECRET:-dev_jwt_secret_change_in_production}" \
    IO_SERVICE_SECRET="${IO_SERVICE_SECRET:-dev_service_secret_change_in_production}" \
    RUST_LOG="${IO_LOG_LEVEL:-info}" \
    ./target/debug/"$name" >> "$log_file" 2>&1 &

    echo $! > "$pid_file"
    sleep 0.5

    if kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "  OK ${name} started (pid=$(cat "$pid_file"), port=${port})"
    else
        echo "  FAIL ${name} failed to start (check $log_file)"
    fi
}

stop_service() {
    local name="${1%%:*}"
    local pid_file="$PID_DIR/${name}.pid"

    if [[ -f "$pid_file" ]]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            rm -f "$pid_file"
            echo "  OK ${name} stopped"
        else
            rm -f "$pid_file"
            echo "  -> ${name} was not running"
        fi
    else
        echo "  -> ${name} not found"
    fi
}

cmd_start() {
    check_deps
    db_start
    db_migrate
    echo "-> Building services..."
    cargo build --workspace --quiet
    echo "-> Starting services..."
    for svc in "${SERVICES[@]}"; do
        start_service "$svc"
    done
    echo ""
    echo "OK All services started. Run './dev.sh status' to check health."
}

cmd_stop() {
    echo "-> Stopping services..."
    for svc in "${SERVICES[@]}"; do
        stop_service "$svc"
    done
    db_stop
}

cmd_status() {
    echo "Inside/Operations Service Status"
    echo "================================="
    for svc in "${SERVICES[@]}"; do
        local name="${svc%%:*}"
        local port="${svc##*:}"
        local pid_file="$PID_DIR/${name}.pid"
        local status="stopped"
        local pid=""

        if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
            pid="(pid=$(cat "$pid_file"))"
            # Check health endpoint
            if curl -sf "http://localhost:${port}/health/live" &>/dev/null; then
                status="running OK"
            else
                status="running (health check failed)"
            fi
        fi

        printf "  %-25s port=%-5s %s %s\n" "$name" "$port" "$status" "$pid"
    done
    echo ""
    echo "Database:"
    if docker compose ps db 2>/dev/null | grep -q "running"; then
        echo "  PostgreSQL          running OK"
    else
        echo "  PostgreSQL          stopped"
    fi
}

cmd_logs() {
    local svc="${1:-}"
    if [[ -n "$svc" ]]; then
        local log_file="$LOG_DIR/${svc}.log"
        if [[ -f "$log_file" ]]; then
            tail -f "$log_file"
        else
            echo "No log file for service: $svc"
            exit 1
        fi
    else
        # Show all logs with service prefix
        if command -v multitail &>/dev/null; then
            local args=()
            for svc in "${SERVICES[@]}"; do
                local svc_name="${svc%%:*}"
                local log_file="$LOG_DIR/${svc_name}.log"
                [[ -f "$log_file" ]] && args+=("-l" "tail -f $log_file" "-t" "$svc_name")
            done
            multitail "${args[@]}"
        else
            echo "Tip: install multitail for combined log view"
            echo "Tailing api-gateway log (most recent service):"
            tail -f "$LOG_DIR/api-gateway.log" 2>/dev/null || echo "No logs yet"
        fi
    fi
}

DOCKER_PSQL="docker exec io_dev_db psql -U io -d io_dev"

shapes_export() {
    local out="services/api-gateway/shapes-snapshot.json"
    $DOCKER_PSQL -At -c "
        SELECT jsonb_pretty(jsonb_agg(
            jsonb_build_object(
                'shape_id', metadata->>'shape_id',
                'name', name,
                'type', type,
                'svg_data', svg_data,
                'metadata', metadata
            )
            ORDER BY metadata->>'shape_id'
        ))
        FROM design_objects
        WHERE type IN ('shape', 'shape_part')
          AND metadata->>'source' = 'library';
    " > "$out"
    echo "Wrote $(wc -l < "$out") lines to $out ($(jq 'length' "$out") shapes)"
}

# Diff incoming sidecar against DB version for a library shape.
# Prints error lines and returns 1 if any addon IDs, connection IDs,
# or bindableParts keys were removed. Returns 0 if OK (no removals or new shape).
check_append_only() {
    local shape_id="$1"
    local new_sidecar="$2"

    local existing
    existing=$($DOCKER_PSQL -t -A -c \
        "SELECT metadata->'sidecar' FROM design_objects \
         WHERE metadata->>'shape_id' = '$shape_id' \
           AND type IN ('shape','shape_part') \
           AND metadata->>'source' = 'library' \
         LIMIT 1;" 2>/dev/null | tr -d '[:space:]')

    if [[ -z "$existing" || "$existing" == "null" ]]; then
        return 0
    fi

    local removals=""

    while IFS= read -r old_id; do
        [[ -z "$old_id" ]] && continue
        if ! echo "$new_sidecar" | jq -r '[.addons[]?.id // empty] | .[]' 2>/dev/null \
            | grep -qxF "$old_id"; then
            removals+="  REMOVED addon ID: $old_id\n"
        fi
    done < <(echo "$existing" | jq -r '[.addons[]?.id // empty] | .[]' 2>/dev/null)

    while IFS= read -r old_id; do
        [[ -z "$old_id" ]] && continue
        if ! echo "$new_sidecar" | jq -r '[.connections[]?.id // empty] | .[]' 2>/dev/null \
            | grep -qxF "$old_id"; then
            removals+="  REMOVED connection ID: $old_id\n"
        fi
    done < <(echo "$existing" | jq -r '[.connections[]?.id // empty] | .[]' 2>/dev/null)

    while IFS= read -r old_id; do
        [[ -z "$old_id" ]] && continue
        if ! echo "$new_sidecar" | jq -r '[.bindableParts[]?.partId // empty] | .[]' 2>/dev/null \
            | grep -qxF "$old_id"; then
            removals+="  REMOVED bindablePart: $old_id\n"
        fi
    done < <(echo "$existing" | jq -r '[.bindableParts[]?.partId // empty] | .[]' 2>/dev/null)

    if [[ -n "$removals" ]]; then
        echo "ERROR: Append-only violation in '$shape_id':"
        echo -e "$removals"
        return 1
    fi

    return 0
}

shapes_import() {
    local force=false
    if [[ "${1:-}" == "--force" ]]; then
        force=true
        echo "WARNING: --force mode — append-only ID checks disabled"
    fi

    local src="frontend/shapes-source"
    if [ ! -d "$src" ]; then
        echo "ERROR: $src not found — run from repo root"
        exit 1
    fi

    local count=0
    local skipped=0

    # Iterate every sidecar JSON (not the schema dir)
    while IFS= read -r json_file; do
        local category dir base shape_id svg_file svg_path sidecar display_name view_box shape_type

        dir=$(dirname "$json_file")
        base=$(basename "$json_file" .json)
        category=$(basename "$dir")

        # Skip schema files
        [[ "$category" == "_schema" ]] && continue

        sidecar=$(cat "$json_file")
        display_name=$(echo "$sidecar" | jq -r '.display_name // .label // ""')
        view_box=$(echo "$sidecar" | jq -r '.geometry.viewBox // "0 0 100 100"')
        shape_id=$(echo "$sidecar" | jq -r '.id // ""')
        [[ -z "$shape_id" ]] && shape_id="$base"

        # Shape type: shape_part if ID contains "part-", else shape
        if [[ "$base" == part-* ]]; then
            shape_type="shape_part"
        else
            shape_type="shape"
        fi

        # Find matching SVG
        svg_file="$dir/${base}.svg"
        if [ ! -f "$svg_file" ]; then
            echo "  WARN: no SVG for $shape_id (expected $svg_file) — skipping"
            (( skipped++ )) || true
            continue
        fi
        svg_path=$(cat "$svg_file")

        # Compute sidecar hash (RFC 8785: keys sorted, no whitespace)
        local sidecar_hash svg_hash_val
        sidecar_hash=$(echo "$sidecar" | python3 -c "
import json, sys, hashlib
data = json.load(sys.stdin)
canonical = json.dumps(data, sort_keys=True, separators=(',',':'), ensure_ascii=False)
print(hashlib.sha256(canonical.encode('utf-8')).hexdigest())
")
        # Compute SVG hash (LF-normalized bytes)
        svg_hash_val=$(sed 's/\r$//' "$svg_file" 2>/dev/null | sha256sum | cut -d' ' -f1)

        local metadata
        metadata=$(jq -n \
            --arg sid "$shape_id" \
            --arg src "library" \
            --arg dn "$display_name" \
            --arg cat "$category" \
            --arg vb "$view_box" \
            --argjson sc "$sidecar" \
            --arg sh "$sidecar_hash" \
            --arg svh "$svg_hash_val" \
            '{shape_id:$sid,source:$src,display_name:$dn,category:$cat,view_box:$vb,schema:"io-shape-v1",sidecar:$sc,sidecar_hash:$sh,svg_hash:$svh}')

        # Append-only enforcement for library shapes
        if [[ "$force" != "true" ]]; then
            if ! check_append_only "$shape_id" "$sidecar"; then
                echo "  BLOCKED: $shape_id"
                echo "  Use './dev.sh shapes import --force' to override (breaks existing graphics)"
                (( skipped++ )) || true
                continue
            fi
        fi

        $DOCKER_PSQL -c "
            INSERT INTO design_objects (id, name, type, svg_data, metadata, created_at, updated_at)
            VALUES (gen_random_uuid(), \$\$${display_name}\$\$, \$\$${shape_type}\$\$,
                    \$\$${svg_path}\$\$, \$\$${metadata}\$\$::jsonb, NOW(), NOW())
            ON CONFLICT ((metadata->>'shape_id'))
                WHERE type IN ('shape', 'shape_part') AND metadata->>'source' = 'library'
            DO UPDATE SET
                name       = EXCLUDED.name,
                svg_data   = EXCLUDED.svg_data,
                metadata   = EXCLUDED.metadata,
                updated_at = NOW();
        " > /dev/null 2>&1
        (( count++ )) || true

    done < <(find "$src" -name '*.json' | sort)

    echo "OK Imported/updated $count library shapes ($skipped skipped — no SVG)."
}

shapes_restore() {
    local in="services/api-gateway/shapes-snapshot.json"
    if [ ! -f "$in" ]; then
        echo "ERROR: $in not found"
        exit 1
    fi
    read -p "Restore will DELETE all library shapes and reload from snapshot. Continue? [y/N] " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || exit 0

    local count
    count=$(jq 'length' "$in")
    echo "-> Restoring $count library shapes from $in..."

    $DOCKER_PSQL -c "
        DELETE FROM design_objects
        WHERE type IN ('shape', 'shape_part')
          AND metadata->>'source' = 'library';
    "

    jq -c '.[]' "$in" | while IFS= read -r row; do
        local shape_id name type svg_data metadata
        shape_id=$(echo "$row" | jq -r '.shape_id')
        name=$(echo "$row" | jq -r '.name')
        type=$(echo "$row" | jq -r '.type')
        svg_data=$(echo "$row" | jq -r '.svg_data')
        metadata=$(echo "$row" | jq -c '.metadata')

        $DOCKER_PSQL -c "
            INSERT INTO design_objects (id, name, type, svg_data, metadata, created_at, updated_at)
            VALUES (gen_random_uuid(), \$\$${name}\$\$, \$\$${type}\$\$, \$\$${svg_data}\$\$, \$\$${metadata}\$\$::jsonb, NOW(), NOW())
            ON CONFLICT ((metadata->>'shape_id'))
                WHERE type IN ('shape', 'shape_part') AND metadata->>'source' = 'library'
            DO UPDATE SET
                name = EXCLUDED.name,
                svg_data = EXCLUDED.svg_data,
                metadata = EXCLUDED.metadata,
                updated_at = NOW();
        " > /dev/null
    done

    echo "OK Restored $count library shapes."
}

# Main dispatch
case "${1:-help}" in
    start)    cmd_start ;;
    stop)     cmd_stop ;;
    restart)  cmd_stop; cmd_start ;;
    status)   cmd_status ;;
    logs)     cmd_logs "${2:-}" ;;
    build)      build_and_restart_services ;;
    build-only) build_only_services ;;
    clean)
        cmd_stop
        cargo clean
        rm -rf "$PID_DIR" "$LOG_DIR"
        ;;
    db)
        case "${2:-}" in
            start)   db_start ;;
            stop)    db_stop ;;
            reset)   db_reset ;;
            migrate) db_migrate ;;
            seed)
                echo "-> Running seed data..."
                cargo run -p api-gateway -- seed 2>/dev/null || echo "Seed command not yet implemented (Phase 2)"
                ;;
            *)
                echo "Usage: ./dev.sh db {start|stop|reset|migrate|seed}"
                ;;
        esac
        ;;
    frontend)
        cd frontend
        pnpm dev
        ;;
    nginx)
        echo "-> Setting up nginx + TLS (requires sudo)..."
        sudo "$SCRIPT_DIR/scripts/setup-nginx.sh" "${@:2}"
        ;;
    deploy-front)
        echo "-> Building frontend..."
        cd frontend
        pnpm install --silent
        pnpm build
        echo "-> Deploying to /opt/io/frontend..."
        sudo mkdir -p /opt/io/frontend
        sudo rm -rf /opt/io/frontend/*
        sudo cp -r dist/* /opt/io/frontend/
        echo "OK Frontend deployed. Reload nginx if needed: sudo systemctl reload nginx"
        ;;
    build-installer)
        bash "$SCRIPT_DIR/scripts/build-installer.sh" "${@:2}"
        ;;
    health)
        echo "Inside/Operations — Service Health"
        echo "==================================="
        all_ok=true
        for svc in "${SERVICES[@]}"; do
            name="${svc%%:*}"
            port="${svc##*:}"
            code=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 2 \
                "http://localhost:${port}/health/live" 2>/dev/null || echo "000")
            if [[ "$code" == "200" ]]; then
                printf "  \033[32m●\033[0m %-25s  HTTP %s\n" "$name" "$code"
            else
                printf "  \033[31m●\033[0m %-25s  HTTP %s  (DOWN)\n" "$name" "$code"
                all_ok=false
            fi
        done
        echo ""
        if $all_ok; then
            echo "All services healthy."
        else
            echo "One or more services are not responding."
            exit 1
        fi
        ;;
    shapes)
        case "${2:-}" in
            export)  shapes_export ;;
            import)  shapes_import "${@:3}" ;;
            restore) shapes_restore ;;
            *)       echo "Usage: $0 shapes {export|import [--force]|restore}" ;;
        esac
        ;;
    help|--help|-h) usage ;;
    *) echo "Unknown command: ${1}"; usage; exit 1 ;;
esac
