#!/usr/bin/env bash
# Inside/Operations — Health Check Watchdog
# Runs every 30s via systemd timer.
# Checks each service's /health/live endpoint.
# If a service fails 3 consecutive checks (tracked in /tmp/io-health-failures/),
# attempts a systemctl restart. If restart fails, sends a notification.

set -euo pipefail

SERVICES=(
    "io-api-gateway:3000"
    "io-data-broker:3001"
    "io-opc-service:3002"
    "io-event-service:3003"
    "io-parser-service:3004"
    "io-archive-service:3005"
    "io-import-service:3006"
    "io-alert-service:3007"
    "io-email-service:3008"
    "io-auth-service:3009"
    "io-recognition-service:3010"
)

FAIL_DIR="/tmp/io-health-failures"
MAX_FAILURES=3
TIMEOUT=5

mkdir -p "$FAIL_DIR"

for entry in "${SERVICES[@]}"; do
    svc="${entry%%:*}"
    port="${entry##*:}"
    fail_file="$FAIL_DIR/$svc"

    # Check health endpoint
    http_code=$(curl -sf -o /dev/null -w "%{http_code}" \
        --max-time $TIMEOUT \
        "http://localhost:${port}/health/live" 2>/dev/null || echo "000")

    if [[ "$http_code" == "200" ]]; then
        # Healthy — clear failure count
        rm -f "$fail_file"
        continue
    fi

    # Unhealthy — increment failure count
    count=1
    if [[ -f "$fail_file" ]]; then
        count=$(($(cat "$fail_file") + 1))
    fi
    echo "$count" > "$fail_file"

    echo "WARN: $svc health check failed (HTTP $http_code), consecutive failures: $count"

    if [[ "$count" -ge "$MAX_FAILURES" ]]; then
        echo "ERROR: $svc has failed $count consecutive health checks — restarting..."

        if systemctl restart "$svc" 2>/dev/null; then
            echo "OK: $svc restarted successfully"
            echo "1" > "$fail_file"  # Reset to 1, not 0 — still watching
        else
            echo "CRITICAL: $svc restart FAILED — service may be down"
            # Notify via the io-alert mechanism if it's not the email/alert service itself
            if [[ "$svc" != "io-email-service" ]] && [[ "$svc" != "io-alert-service" ]]; then
                systemctl start "io-alert@${svc}.service" 2>/dev/null || true
            fi
        fi
    fi
done
