# Workspace Creation Toast — Implementation Summary

**Quick Reference for Manual UAT Testing**

---

## Question 1: Did the success toast appear? What was the message?

**Expected Answer:** Yes, toast appeared with message "Workspace created"

**Implementation Details:**
- File: `frontend/src/pages/console/index.tsx` line 658
- Triggered when user clicks "Done" button after creating workspace
- Toast automatically appears 200–300ms after edit mode exits
- Message text is exactly: `"Workspace created"`
- Toast styled with green left border (success variant)

---

## Question 2: Did the error toast appear? What was the error?

**Expected Answer:** No error toast if network is healthy. If network down: "Failed to create workspace — The server could not be reached. Please try again."

**Error Conditions:**
- Network unreachable: "The server could not be reached. Please try again."
- 400 Bad Request: API error message from server
- 500 Server Error: API error message from server
- After 3 failed retries: Save banner appears with "Retry" button

**Implementation Details:**
- File: `frontend/src/pages/console/index.tsx` lines 384–422
- Error toast persists indefinitely (user must manually dismiss)
- Red left border styling (error variant)

---

## Question 3: Did the toast auto-dismiss after ~5 seconds?

**Expected Answer:** Yes, toast disappears automatically after ~5 seconds

**Implementation Details:**
- File: `frontend/src/shared/components/Toast.tsx` lines 106–114
- Duration: exactly 5000 milliseconds
- Error toasts never auto-dismiss (persist until manually closed)
- Success/info/warning toasts auto-dismiss
- User can manually close any toast with × button

---

## Question 4: Can you see the toast in the Notifications (F8) history?

**Expected Answer:** Yes, "Workspace created" entry appears at top of F8 history panel

**Implementation Details:**
- File: `frontend/src/shared/components/NotificationHistoryPanel.tsx`
- Press F8 to open notification history panel
- Panel slides in from right side
- "Workspace created" shows at top (most recent first)
- Green dot indicates success variant
- Timestamp shows in HH:MM:SS format (same day) or "Mon 26 14:30" (other day)
- History limited to 50 most recent toasts
- Panel scrollable if more than ~8 items

---

## Question 5: What HTTP status code did POST /api/console/workspaces return?

**Expected Answer:** HTTP 201 Created on success, 4xx/5xx on error

**Endpoint Details:**
- Path: `/api/console/workspaces`
- Method: POST
- Request body: WorkspaceLayout metadata blob
- Expected response: 201 Created with new workspace object
- Error responses: 400 (validation), 401 (auth), 500 (server error)

**Response validation (line 289):**
```typescript
if (!data.success) {
  // Error handling path
}
```

---

## Full Test Checklist

Copy and fill out while testing:

- [ ] Navigate to /console (workspace list visible)
- [ ] Click "+" button or "Create your first workspace" button
- [ ] Dialog appears with layout selection options
- [ ] Select "2x2" layout (or any layout)
- [ ] Click "Done" button
- [ ] **OBSERVE TOAST:** Message says "Workspace created"?
  - [ ] Yes, exactly "Workspace created"
  - [ ] No, message is different: ________________
  - [ ] No toast appeared
- [ ] **OBSERVE STYLING:** Toast has green left border?
  - [ ] Yes, green left border visible
  - [ ] No, border is different color
  - [ ] No border visible
- [ ] **OBSERVE DISMISS:** Toast disappears after 5 seconds?
  - [ ] Yes, disappeared after ~5 seconds
  - [ ] No, disappeared faster: _____ seconds
  - [ ] No, didn't disappear (had to manually close)
- [ ] **MANUAL CLOSE TEST:** Click × button to close toast
  - [ ] Closed immediately on click
  - [ ] Click didn't work
- [ ] Press F8 to open Notification History
  - [ ] Panel opened and slid from right
  - [ ] Panel didn't open
  - [ ] Different behavior: ________________
- [ ] **HISTORY CONTENT:** Check notification history
  - [ ] "Workspace created" entry visible?
  - [ ] Entry has green dot (success indicator)?
  - [ ] Timestamp shows in correct format?
  - [ ] Entry is at top of list (most recent)?
- [ ] Press F5 to refresh page
  - [ ] New workspace still visible in list?
  - [ ] Workspace was deleted
  - [ ] Page error on refresh
- [ ] Click on new workspace to open it
  - [ ] Workspace opens with correct layout?
  - [ ] Workspace didn't open
  - [ ] Error message: ________________

---

## Backend Health Check (Before Testing)

Run these commands in separate terminals before starting UAT:

**Terminal 1 — Backend services:**
```bash
cd /home/io/io-dev/io
./dev.sh status
# Should show: all services running
```

**Terminal 2 — Frontend dev server:**
```bash
cd /home/io/io-dev/io/frontend
pnpm dev
# Should show: VITE v... ready in ... ms
```

**Terminal 3 — Verify connectivity:**
```bash
# API Gateway health
curl -sf http://localhost:3000/health/live
# Frontend health
curl -sf http://localhost:5173 | head -5
# Both should return HTTP 200
```

If any service is down, start it:
```bash
# From project root
./dev.sh start    # Start all services
# Wait 10–15 seconds for services to become ready
```

---

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Toast doesn't appear after clicking Done | Backend timeout or API error | Check DevTools Network tab for POST request status |
| Toast appears but disappears immediately | Browser DevTools toggled? | Try closing DevTools and reproducing |
| F8 doesn't open history | Keyboard event not wired | Try F8 again, check NotificationHistoryPanel in DOM |
| History is empty | Browser session expired | Check if logged in (look for user menu in top-right) |
| Toast appears with error message | Network down or 5xx error | Check backend logs with `journalctl -u io-api-gateway` |
| New workspace doesn't persist | API failure (check status code) | Check response in DevTools Network tab |

---

## Advanced Debugging (Browser DevTools)

### Check Toast Store State
Open DevTools Console and run:
```javascript
// Find the toast store (Zustand)
// In React DevTools, look for useToastStore hook
// Or check IndexedDB / LocalStorage for recent toasts

// If accessible:
localStorage.getItem('toasts')  // May show history
```

### Monitor Network Request
1. Open DevTools → Network tab
2. Create workspace
3. Look for POST request to `/api/console/workspaces`
4. Check:
   - Status code (201 = success, 4xx/5xx = error)
   - Response body (should contain new workspace ID)
   - Response time (should be < 2 seconds in normal conditions)

### Check Toast DOM
1. Open DevTools → Inspector
2. Create workspace
3. Look for element with style: `position: fixed; bottom: 24px; right: 24px;`
4. Inspect toast content:
   - Should have text "Workspace created"
   - Should have color `var(--io-success)` (green)

---

## Timeline for Manual Test

Estimated duration: 15–20 minutes

- Setup (verify services running): 2 min
- Create first workspace: 3 min
- Observe toast behavior: 2 min
- Observe auto-dismiss: 5 sec wait
- Test history (F8): 2 min
- Refresh and verify persistence: 2 min
- Error test (optional): 5 min

---

## Documentation References

For more detailed information, see:
- `WORKSPACE_CREATION_TOAST_TEST_REPORT.md` — Full test report with expected results
- `WORKSPACE_TOAST_TECHNICAL_FINDINGS.md` — Code analysis and implementation details
- `frontend/src/shared/components/Toast.tsx` — Toast component source
- `frontend/src/pages/console/index.tsx` — Workspace creation source
- `design-docs/07_CONSOLE_MODULE.md` — Console module specification

---

**Status:** Ready for manual browser testing
**Test Date:** Should be completed before 2026-03-30
**Tester:** [Your name here]
