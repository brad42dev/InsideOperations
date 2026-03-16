#!/usr/bin/env bash
# Inside/Operations — Smoke Test Suite (runs post-deployment on Server 2)
set -euo pipefail

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
)

PASS=0
FAIL=0

check() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local extra_args="${4:-}"

    local actual_status
    # shellcheck disable=SC2086
    actual_status=$(curl -sk -o /dev/null -w "%{http_code}" $extra_args "$url" 2>/dev/null || echo "000")

    if [[ "$actual_status" == "$expected_status" ]]; then
        echo "  OK $name"
        PASS=$((PASS+1))
    else
        echo "  FAIL $name (expected HTTP $expected_status, got $actual_status)"
        FAIL=$((FAIL+1))
    fi
}

check_json() {
    local name="$1"
    local url="$2"
    local extra_args="${3:-}"
    local body

    # shellcheck disable=SC2086
    body=$(curl -sk $extra_args "$url" 2>/dev/null || echo "{}")
    local status
    status=$(curl -sk -o /dev/null -w "%{http_code}" $extra_args "$url" 2>/dev/null || echo "000")

    if [[ "$status" == "200" ]]; then
        echo "  OK $name"
        PASS=$((PASS+1))
        echo "$body"
    else
        echo "  FAIL $name (HTTP $status)"
        FAIL=$((FAIL+1))
        echo ""
    fi
}

echo "Inside/Operations Smoke Tests"
echo "=============================="
echo ""

# ---------------------------------------------------------------------------
# 1. Health checks — all 11 services
# ---------------------------------------------------------------------------
echo "--- Service health checks ---"
for svc in "${SERVICES[@]}"; do
    name="${svc%%:*}"
    port="${svc##*:}"
    check "${name} /health/live" "http://localhost:${port}/health/live" "200"
done

# ---------------------------------------------------------------------------
# 2. Auth: login with default admin credentials
# ---------------------------------------------------------------------------
echo ""
echo "--- Authentication ---"
LOGIN_RESPONSE=$(curl -sk -X POST "http://localhost:3000/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}' 2>/dev/null || echo '{}')

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('data', {}).get('access_token', d.get('access_token', '')))
except Exception:
    print('')
" 2>/dev/null || echo "")

if [[ -n "$TOKEN" ]]; then
    echo "  OK login → access token obtained"
    PASS=$((PASS+1))
else
    echo "  FAIL login → no access token in response"
    echo "       Response: $LOGIN_RESPONSE"
    FAIL=$((FAIL+1))
fi

# ---------------------------------------------------------------------------
# 3. Authenticated API calls (require valid token)
# ---------------------------------------------------------------------------
echo ""
echo "--- Authenticated API calls ---"
if [[ -n "$TOKEN" ]]; then
    AUTH="-H 'Authorization: Bearer $TOKEN'"
    check "GET /api/auth/me" \
        "http://localhost:3000/api/auth/me" "200" "-H \"Authorization: Bearer $TOKEN\""
    check "GET /api/dashboards" \
        "http://localhost:3000/api/dashboards" "200" "-H \"Authorization: Bearer $TOKEN\""
    check "GET /api/console/workspaces" \
        "http://localhost:3000/api/console/workspaces" "200" "-H \"Authorization: Bearer $TOKEN\""
    check "GET /api/alarms/active" \
        "http://localhost:3000/api/alarms/active" "200" "-H \"Authorization: Bearer $TOKEN\""
else
    echo "  SKIP (no token — auth failed)"
    FAIL=$((FAIL+4))
fi

# ---------------------------------------------------------------------------
# 4. Security: unauthenticated requests must be rejected
# ---------------------------------------------------------------------------
echo ""
echo "--- Security checks ---"
check "GET /api/dashboards without token → 401" \
    "http://localhost:3000/api/dashboards" "401"
check "GET /api/users without token → 401" \
    "http://localhost:3000/api/users" "401"

# ---------------------------------------------------------------------------
# 5. Frontend: index.html is served
# ---------------------------------------------------------------------------
echo ""
echo "--- Frontend ---"
check "nginx / → index.html" "https://localhost/" "200"
check "nginx /assets/ path → 404 (no such asset, not index)" \
    "https://localhost/assets/nonexistent.js" "404"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=============================="
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "=============================="
[[ $FAIL -eq 0 ]]
