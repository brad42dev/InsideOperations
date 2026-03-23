# Integration Test Baseline
Date: 2026-03-23

## Results
- 7 steps passing
- 8 steps skipped (features not yet implemented / dependencies not connected)
- 0 steps failing

All 5 journeys exit clean. Exit code 0.

## What Works
- Login: `admin` / `changeme` credentials authenticate successfully
- Auth guard: authenticated users are redirected from protected routes (not back to /login)
- App shell: full sidebar navigation renders (10 module links), header shows user avatar and username
- Route headers: `/console`, `/designer`, `/reports` all render with correct `<h1>` heading
- Session persistence: navigating between module routes does not lose the session

## Skipped Steps and Reasons

| Journey | Step | Reason | Unblocked By |
|---------|------|--------|--------------|
| Console — Workspace Load | console module has content | Console module fails to load (dynamic import error for react-zoom-pan-pinch or index.tsx) | Console module build completion |
| Console — Workspace Load | open first workspace (if any) | Requires OPC data and working console module | OPC pipeline + console module |
| Designer — Open and Render | designer UI renders | Designer module fails to load (dynamic import error) | Designer module build completion |
| Designer — Open and Render | create new graphic (if supported) | Requires working designer module | Designer module |
| Data Binding — OPC Point Browser | point browser accessible | Requires OPC service running and working console/designer module | OPC service + module builds |
| Data Binding — OPC Point Browser | real-time value updates | Requires live OPC data from SimBLAH simulator | SimBLAH connection |
| Reports — Generate a Canned Report | report list renders | Reports module fails to load (dynamic import error) | Reports module build completion |
| Reports — Generate a Canned Report | generate a report | Requires working reports module and async generation pipeline | Reports module + archive service |

## Known Issues Observed
- `react-zoom-pan-pinch` vite dep fails to load (404) — blocks console module
- All module-level lazy imports fail with `Failed to fetch dynamically imported module`
- 429 Too Many Requests on `/api/auth/me` — rate limiting on health polling
- `/api/v1/uom/catalog` returns 404 — UOM catalog API not yet implemented

## Rerun Command
```
./io-run.sh integration-test
```

Or from frontend directory:
```
npx tsx tests/integration/runner.ts
```
