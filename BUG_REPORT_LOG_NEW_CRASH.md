# Bug Report: /log/new Route Browser Crash

**Severity:** CRITICAL
**Impact:** Users cannot create new log entries
**Reproducibility:** 100% (every attempt to create a log entry causes browser crash)
**Root Cause:** Type mismatch between API response format and frontend data handling

---

## Executive Summary

When a user navigates to `/log/new`, selects a template, and clicks "Start Entry", the following happens:

1. LogNew.tsx successfully creates a log instance via `createInstance()` API
2. Navigation triggers: `navigate('/log/{result.data.id}')`
3. LogEditor.tsx mounts and initiates 3 parallel queries
4. `listTemplates()` returns `PagedResponse<LogTemplate>` (object with `{ data, pagination }`)
5. `listSegments()` returns `PagedResponse<LogSegment>` (object with `{ data, pagination }`)
6. Frontend code incorrectly treats these paginated responses as plain arrays
7. Templates and segments become empty arrays due to `Array.isArray()` check failing
8. LogEditor attempts to initialize Tiptap editor with corrupted/empty segment data
9. **Browser crashes entirely** — not an error boundary, but a fatal crash

---

## Detailed Root Cause Analysis

### Problem #1: templateData Type Mismatch

**File:** `/frontend/src/pages/log/LogEditor.tsx`
**Lines:** 1019-1027 and 1093

**The Code:**
```typescript
const { data: templateData } = useQuery({
  queryKey: ['log-templates'],
  queryFn: async () => {
    const res = await logsApi.listTemplates()
    if (!res.success) throw new Error(res.error.message)
    return res.data  // <-- THIS IS THE OBJECT: { data: [], pagination: {...} }
  },
  enabled: !!instanceData,
})

// ...later on line 1093:
const templateList: LogTemplate[] = Array.isArray(templateData) ? templateData : []
//                                   ^^^^^^^^^^^^^^^^^^^^^^^ ALWAYS FALSE
//                                   because templateData = { data: [...], pagination: {...} }
```

**API Response Structure (from backend):**
```json
{
  "success": true,
  "data": [
    {"id": "...", "name": "Font Test Template", "segment_ids": [...], ...},
    {"id": "...", "name": "Test Log Template", "segment_ids": [...], ...}
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total_items": 6,
    "total_pages": 1
  }
}
```

**Backend Handler:**
- File: `/services/api-gateway/src/handlers/logs.rs:224`
- Code: `Json(PagedResponse::new(templates, pg, limit, total as u64)).into_response()`

**Actual Frontend Receives:**
After `res.data` unwrapping in the queryFn, `templateData` becomes:
```javascript
{
  data: [LogTemplate, LogTemplate, ...],
  pagination: {...}
}
```

**The Bug:**
- Line 1093 calls `Array.isArray(templateData)`
- Since `templateData` is `{ data, pagination }` (an object), not an array, this returns `false`
- Therefore: `templateList = []` (empty array)
- The UI then tries to render an empty template list, but more critically:
- Lines 1095-1101 try to match segments with `template.segment_ids`
- With `template = undefined` (because templateList is empty), `template.segment_ids` fails
- This cascades to an infinite loop or memory exhaustion in the Tiptap initialization

---

### Problem #2: segmentsData Type Mismatch (Same Issue)

**File:** `/frontend/src/pages/log/LogEditor.tsx`
**Lines:** 1009-1017 and 1094

**The Code:**
```typescript
const { data: segmentsData } = useQuery({
  queryKey: ['log-segments'],
  queryFn: async () => {
    const res = await logsApi.listSegments()
    if (!res.success) throw new Error(res.error.message)
    return res.data  // <-- ALSO AN OBJECT: { data: [], pagination: {...} }
  },
  enabled: !!instanceData,
})

// ...later on line 1094:
const segmentList: LogSegment[] = Array.isArray(segmentsData) ? segmentsData : []
//                                ^^^^^^^^^^^^^^^^^^^^^^^ ALWAYS FALSE
```

**Backend Handler:**
- File: `/services/api-gateway/src/handlers/logs.rs:425`
- Code: `Json(PagedResponse::new(segments, pg, limit, total as u64)).into_response()`

**Result:** `segmentList = []` (empty array)

---

## Error Flow Diagram

```
/log/new (LogNew.tsx) ✅ Works
    ↓
[User selects template and clicks "Start Entry"]
    ↓
createMutation.mutate() ✅ API call succeeds
    ↓
navigate('/log/{id}') ✅ Navigation succeeds
    ↓
LogEditor.tsx mounts
    ↓
useQuery: listTemplates() → PagedResponse returned ❌
useQuery: listSegments() → PagedResponse returned ❌
useQuery: getInstance() → LogInstanceDetail returned ✅
    ↓
Line 1093: Array.isArray(templateData) = false ❌
Line 1094: Array.isArray(segmentsData) = false ❌
    ↓
templateList = [] (empty) ❌
segmentList = [] (empty) ❌
    ↓
Line 1095: template = undefined (can't find in empty list) ❌
Line 1096-1101: orderedSegments = [] (can't match segments) ❌
    ↓
Line 105: useEditor({...}) initializes with corrupted/empty config ❌
    ↓
Tiptap editor initialization encounters infinite loop OR
WebSocket hook tries to subscribe to undefined point IDs OR
Memory exhaustion from recursive state updates
    ↓
💥 BROWSER CRASH
```

---

## Affected Code Locations

| File | Lines | Issue | Severity |
|------|-------|-------|----------|
| `/frontend/src/pages/log/LogEditor.tsx` | 1019-1027 | templateData type mismatch | CRITICAL |
| `/frontend/src/pages/log/LogEditor.tsx` | 1093 | Array.isArray() check fails | CRITICAL |
| `/frontend/src/pages/log/LogEditor.tsx` | 1009-1017 | segmentsData type mismatch | CRITICAL |
| `/frontend/src/pages/log/LogEditor.tsx` | 1094 | Array.isArray() check fails | CRITICAL |
| `/frontend/src/pages/log/LogEditor.tsx` | 1095-1101 | Segment building logic fails | HIGH |
| `/frontend/src/pages/log/LogEditor.tsx` | 105 | Tiptap editor init with bad data | HIGH |

---

## Why ErrorBoundary Doesn't Catch This

The crash occurs at a level deeper than React:

1. **TypeError propagates** through Tiptap library code
2. **Tiptap** (uses ContentEditable) may enter an infinite DOM update loop
3. **Browser's event loop** becomes unresponsive
4. **Memory accumulates** from repeated state updates
5. **Browser tab/process terminates** before React's ErrorBoundary can catch it
6. **Or:** SharedWorker WebSocket connection encounters undefined state and infinite loops

---

## Fix: Type-Safe Data Extraction

### Option A: Extract Data in queryFn (Recommended)

```typescript
const { data: templateList = [] } = useQuery({
  queryKey: ['log-templates'],
  queryFn: async () => {
    const res = await logsApi.listTemplates()
    if (!res.success) throw new Error(res.error.message)
    // Extract the array directly from the PagedResponse
    return Array.isArray(res.data)
      ? res.data
      : (res.data as any)?.data ?? []
  },
  enabled: !!instanceData,
})
```

Then use `templateList` directly (no need to extract on line 1093).

### Option B: Extract in Component Body (Defensive)

```typescript
const { data: templateData } = useQuery({
  queryKey: ['log-templates'],
  queryFn: async () => {
    const res = await logsApi.listTemplates()
    if (!res.success) throw new Error(res.error.message)
    return res.data
  },
  enabled: !!instanceData,
})

// Safe extraction with full type guards
const templateList: LogTemplate[] = (() => {
  if (Array.isArray(templateData)) return templateData
  if (templateData && typeof templateData === 'object' && 'data' in templateData) {
    return Array.isArray(templateData.data) ? templateData.data : []
  }
  return []
})()
```

### Option C: Fix API Type Signature (Best Long-Term)

Update `/frontend/src/api/logs.ts:80` to properly document the response:

```typescript
// Current (misleading):
listTemplates: (...) => Promise<ApiResult<PaginatedResult<LogTemplate>>>

// Better:
listTemplates: (...) => Promise<ApiResult<{ data: LogTemplate[], pagination: Pagination }>>
```

Or create a shared type that matches the backend exactly.

---

## Testing the Fix

### Reproduction Steps
1. Navigate to http://localhost:5173/log/new
2. Select "Test Log Template" from dropdown
3. Click "Start Entry"
4. **Expected (after fix):** Page loads with empty log entry editor
5. **Actual (before fix):** Browser crashes after 1-3 seconds

### Verification After Fix
```bash
# 1. Apply fix to LogEditor.tsx lines 1093-1094
# 2. Restart dev server: pnpm dev
# 3. Test scenario above
# 4. Check browser console for any errors
# 5. Verify templates and segments load correctly in developer tools
```

---

## Prevention: Code Review Checklist

- [ ] API response structure matches frontend expectations
- [ ] Test paginated vs. non-paginated responses separately
- [ ] Use TypeScript strict mode to catch type mismatches
- [ ] Add integration tests that call actual API endpoints
- [ ] Document response format in API client comments
- [ ] Validate response structure before assuming format

---

## Related Files to Review

1. **Frontend API types:** `/frontend/src/api/logs.ts:80-126`
2. **Backend response:** `/services/api-gateway/src/handlers/logs.rs:165-227, 378-427`
3. **Shared types:** `/crates/io-models/src/lib.rs:49-74` (PagedResponse, Pagination)
4. **Component using data:** `/frontend/src/pages/log/LogEditor.tsx:1000-1105`

---

## Immediate Action Items

1. **CRITICAL:** Fix lines 1093-1094 in LogEditor.tsx to properly extract arrays from PagedResponse
2. **HIGH:** Add null/undefined guards in segment building logic (lines 1095-1101)
3. **MEDIUM:** Add type guards before Tiptap editor initialization
4. **LOW:** Update API type signatures to match actual response format

---

## Additional Notes

- The issue only manifests when navigating to an existing log instance
- LogNew.tsx itself works fine because it doesn't use the problematic queries
- Logs module is otherwise functional — only breaks on the edit flow
- This is a data-handling bug, not a missing feature
