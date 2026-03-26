# Debug Session Index: /log/new Route Crash

**Session Date:** 2026-03-26
**Issue:** Browser crashes completely when user attempts to create a new log entry
**Status:** ROOT CAUSE IDENTIFIED - Type mismatch in LogEditor.tsx data handling

---

## Quick Reference

- **Critical Files:** 
  - `/frontend/src/pages/log/LogEditor.tsx` (Lines 1019-1027, 1093-1094, 1009-1017)
  - `/services/api-gateway/src/handlers/logs.rs` (Lines 165-227, 378-427)

- **Issue Type:** Data type mismatch between backend paginated response and frontend array expectation

- **Estimated Fix Time:** 5-10 minutes

- **Testing Required:** Functional test of log entry creation flow

---

## Output Files Generated

| File | Purpose | Key Findings |
|------|---------|--------------|
| `DEBUG_LOG_ROUTE.md` | Technical deep-dive | API response structure analysis, type contract violations |
| `BUG_REPORT_LOG_NEW_CRASH.md` | Comprehensive bug report | Error flow diagram, fix options, prevention checklist |
| `CONSOLE_OUTPUT.md` | Console logs analysis | Network activity, timing of crash, evidence of mismatch |
| `DEBUG_INDEX.md` | This file | Navigation and summary |

---

## The Bug in 30 Seconds

```
LogEditor.tsx receives from API:
  { data: [templates], pagination: {...} }

But code checks:
  Array.isArray(data) ? data : []
  
Since it's an object (not array):
  templateList = [] (should be [6 templates])
  
Tiptap editor initializes with corrupted/empty config:
  💥 BROWSER CRASH
```

---

## The Fix in 10 Lines

In `/frontend/src/pages/log/LogEditor.tsx`:

**Line 1093 - Change from:**
```typescript
const templateList: LogTemplate[] = Array.isArray(templateData) ? templateData : []
```

**To:**
```typescript
const templateList: LogTemplate[] = Array.isArray(templateData)
  ? templateData
  : (templateData as any)?.data ?? []
```

**Line 1094 - Change from:**
```typescript
const segmentList: LogSegment[] = Array.isArray(segmentsData) ? segmentsData : []
```

**To:**
```typescript
const segmentList: LogSegment[] = Array.isArray(segmentsData)
  ? segmentsData
  : (segmentsData as any)?.data ?? []
```

---

## Root Cause Details

The backend returns responses wrapped in a `PagedResponse` object:

```rust
// /services/api-gateway/src/handlers/logs.rs:224
Json(PagedResponse::new(templates, pg, limit, total as u64)).into_response()
```

Which produces:
```json
{
  "success": true,
  "data": [...templates...],
  "pagination": {...}
}
```

The frontend API client correctly unwraps `res.success` and `res.data`, but then:
- `res.data` becomes the full `{ data: [...], pagination: {...} }` object
- Frontend code assumes `res.data` is a plain array
- `Array.isArray()` check fails
- Empty arrays are used instead of actual data
- Tiptap editor initialization crashes the browser

---

## Verification Steps

1. **Apply the fix** to LogEditor.tsx lines 1093-1094
2. **Restart dev server:** `cd frontend && pnpm dev`
3. **Test scenario:**
   - Navigate to http://localhost:5173/log/new
   - Select "Test Log Template"
   - Click "Start Entry"
4. **Expected result:** Page loads without crash, editor is visible
5. **Verify in DevTools:** Check that templates and segments are loaded correctly

---

## Why This Happened

1. **Type Definition Mismatch:** API client types reference `PaginatedResult` but backend sends `PagedResponse`
2. **Defensive Coding Missing:** Code checks `Array.isArray()` but not `typeof === 'object'`
3. **Inconsistent Response Format:** Some endpoints return arrays, some return paginated responses
4. **No Type Validation:** Response data is not validated before use

---

## Prevention for Future

- [ ] Use TypeScript strict mode throughout
- [ ] Add runtime validation of API responses
- [ ] Document response format in API client comments
- [ ] Test with actual API endpoints, not mocks
- [ ] Use discriminated unions for response types
- [ ] Add integration tests for data-heavy flows

---

## What NOT To Do

- ❌ Don't disable TypeScript checks
- ❌ Don't ignore type errors during development
- ❌ Don't assume response format from endpoint name
- ❌ Don't test with mock data that differs from real API
- ❌ Don't use `any` type without comments

---

## What To Do

- ✅ Apply the 2-line fix immediately
- ✅ Add similar checks to other data-handling code
- ✅ Create integration tests for log entry creation
- ✅ Document API response formats clearly
- ✅ Use proper TypeScript types everywhere

---

## Related Components

The following modules also use `PagedResponse` but may have similar issues:
- Dashboards module (listDashboards)
- Reports module (listReports)
- Rounds module (listRounds)
- Any paginated endpoint

Consider a systematic audit of all API response handling.

---

## Questions Answered

**Q: Why does the page load initially?**
A: LogNew.tsx doesn't use the problematic data. It directly passes templates from the API without extracting from paginated responses.

**Q: Why doesn't the error boundary catch it?**
A: The crash occurs in native browser code (ContentEditable) or WebSocket initialization, not in React rendering.

**Q: Will reloading the page fix it?**
A: No, the issue is in the component logic, not transient state.

**Q: Why no error message?**
A: The browser enters an infinite loop or memory exhaustion before JavaScript can log anything.

---

## Next Actions

1. **Immediate (Now):** Apply the fix to lines 1093-1094
2. **Short-term (Today):** Test the fix and verify it works
3. **Medium-term (This Week):** Audit other paginated endpoints for similar issues
4. **Long-term (This Sprint):** Implement proper response validation framework

---

Generated: 2026-03-26
Status: READY FOR FIX IMPLEMENTATION
