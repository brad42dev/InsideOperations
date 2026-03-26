# UAT Scenarios — DD-10

## Dashboard Page Renders

Scenario 1: [DD-10-021] Dashboards page renders without error — navigate to /dashboards → page loads, no error boundary, dashboard list or empty state visible

## Data Flow

Scenario 2: [DD-10-021] — data flow: GET /api/v1/dashboards —
  1. Navigate to /dashboards
  2. Wait for page to load: browser_wait_for time=3000
  3. Snapshot and check: dashboard list or named dashboard cards visible
  Pass: dashboard names/cards present AND no "Loading..." spinner stuck AND no error boundary
  Fail: error boundary, stuck loading, or "Something went wrong"

## Open in New Window Button

Scenario 3: [DD-10-021] Open in New Window button visible in dashboard viewer toolbar — navigate to /dashboards, open a dashboard → toolbar shows "Open in New Window" button or icon

Scenario 4: [DD-10-021] Open in New Window button triggers new window/tab — click "Open in New Window" button → browser opens the dashboard URL in a new window or tab (window.open behavior, or link with target=_blank)

## Toolbar Integrity

Scenario 5: [DD-10-021] Dashboard viewer toolbar renders with controls — open any dashboard → toolbar visible with at least one action button (Open in New Window, Export, or similar)

## Edge Case / Empty State

Scenario 6: [DD-10-021] Empty dashboard list handled gracefully — navigate to /dashboards with no dashboards → empty state message or CTA shown, no crash
