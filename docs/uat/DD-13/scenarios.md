# UAT Scenarios — DD-13 (Log Module)

## Font-Family Selector Feature (DD-13-020)

Scenario 1: [DD-13-020] Log module loads without error — navigate to /log → page renders with Active Logs, Completed, Templates tabs visible

Scenario 2: [DD-13-020] Fetch log templates — page loads → API call GET /api/logs/templates succeeds → template list is populated and available for instantiation

Scenario 3: [DD-13-020] Create log instance from template — select a template → click create instance → instance row appears in list with status

Scenario 4: [DD-13-020] Open LogEditor for created instance — click on instance row → navigate to instance detail page → LogEditor component loads and WYSIWYG toolbar is visible

Scenario 5: [DD-13-020] Font-family dropdown is visible in toolbar — LogEditor loads → inspect toolbar for font selector dropdown with label visible

Scenario 6: [DD-13-020] Font dropdown opens when clicked — click font-family selector → dropdown opens and shows font options (Monospace, Arial, Georgia, etc.)

Scenario 7: [DD-13-020] Font selection changes editor text appearance — select a different font from dropdown → text in the editor visually changes to match selected font

Scenario 8: [DD-13-020] No JavaScript errors in console — complete all above interactions → check browser console for any errors or warnings

Scenario 9: [DD-13-020] — data flow: GET /api/logs/templates —
  1. Navigate to /log
  2. Perform action: page load triggers template fetch
  3. Wait for response: browser_wait_for time=3000
  4. Snapshot and check: template list must show at least one template option
  Pass: template names visible AND dropdown/list is not empty AND does not say "Loading..."
  Fail: no templates shown, "Loading..." still visible, or error boundary
