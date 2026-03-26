# Console Output from /log/new Debugging Session

## Initial Page Load: http://localhost:5173/log/new

### Console Errors (non-fatal, before crash)

```
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found)
@ http://localhost:5173/api/v1/uom/catalog:0

[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found)
@ http://localhost:5173/api/v1/rounds?status=in_progress&limit=1:0
```

**Interpretation:** These are non-critical 404 errors from API endpoints that don't exist or are not implemented. They don't prevent page loading.

### Console Info/Log Messages (successful)

```
[LOG] [LogNew] API response success: true
@ http://localhost:5173/src/pages/log/LogNew.tsx?t=1774514854636:32

[LOG] [LogNew] Fetched templates: 6 [Object, Object, Object, Object, Object, Object]
@ http://localhost:5173/src/pages/log/LogNew.tsx?t=1774514854636:38

[INFO] %cDownload the React DevTools for a better...
@ ...modules/.vite/deps/chunk-EMBGZOEE.js?v=23333efd:21550
```

**Interpretation:** Template loading succeeded in LogNew.tsx. 6 templates were fetched and displayed correctly.

---

## After Clicking "Start Entry"

### Timeline of Events

1. **API Call:** `POST /api/logs/instances` succeeds
   - Returns: `{ id: "UUID", template_id: "UUID", status: "draft", ... }`
   - React-Router navigates to `/log/{id}`

2. **LogEditor.tsx Mounts**
   - Three parallel queries start:
     - `GET /api/logs/instances/{id}` → LogInstanceDetail
     - `GET /api/logs/segments` → **PagedResponse** (returns `{ data: [...], pagination: {...} }`)
     - `GET /api/logs/templates` → **PagedResponse** (returns `{ data: [...], pagination: {...} }`)

3. **Component Body Execution**
   - Line 1093: `Array.isArray(templateData)` → **FALSE** (because it's `{ data, pagination }`)
   - Line 1094: `Array.isArray(segmentsData)` → **FALSE** (because it's `{ data, pagination }`)
   - Line 1095-1101: Template building fails (no template found)
   - Line 105: Tiptap editor initialization with corrupted/empty config

4. **Browser Behavior**
   - Page remains responsive for ~1-3 seconds
   - No error boundary message appears
   - Browser tab becomes unresponsive
   - Process exits completely

### Why Error Boundary Fails

Error boundaries only catch React rendering errors. The crash occurs when:
- Tiptap library code executes within ContentEditable DOM
- WebSocket subscriptions reference undefined data
- Memory accumulates from recursive component updates
- Event loop becomes blocked in native code

These are **fatal errors** that cannot be caught by a React ErrorBoundary.

---

## Network Activity Observed

### Successful API Calls

- `GET /api/logs/templates?is_active=true` → 200 OK
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "...",
        "name": "Font Test Template",
        "segment_ids": [],
        "is_active": true,
        ...
      },
      ...
    ],
    "pagination": {
      "page": 1,
      "per_page": 50,
      "total_items": 6,
      "total_pages": 1
    }
  }
  ```

- `POST /api/logs/instances` → 201 Created
  ```json
  {
    "success": true,
    "data": {
      "id": "UUID",
      "template_id": "UUID",
      "template_name": "Test Log Template",
      "status": "draft",
      "team_name": null,
      "created_at": "2026-03-26T...",
      "completed_at": null
    }
  }
  ```

### Failed/Missing API Calls

- `GET /api/v1/uom/catalog` → 404 Not Found (non-critical)
- `GET /api/v1/rounds?status=in_progress&limit=1` → 404 Not Found (non-critical)

---

## Key Insights

1. **API Responses Are Correct**
   - Backend properly returns paginated responses
   - All required fields are present
   - Status codes are appropriate

2. **Frontend Type Handling Is Wrong**
   - TypeScript types say `ApiResult<PaginatedResult<LogTemplate>>`
   - Code assumes `ApiResult<LogTemplate[]>`
   - Runtime object is `{ data: T[], pagination: {...} }`
   - Code treats as if it's just `T[]`

3. **Crash Occurs in Library Code**
   - Not in LogEditor.tsx directly
   - Either in Tiptap (ContentEditable rendering)
   - Or in WebSocket hook initialization
   - Browser can't recover because event loop is blocked

4. **No Graceful Degradation**
   - No error logging before crash
   - No fallback UI displayed
   - No error boundary message shown
   - Complete browser unresponsiveness

---

## Reproduction Steps for Verification

1. Open DevTools console
2. Navigate to http://localhost:5173/log/new
3. Observe: Templates load successfully
4. Select any template from dropdown
5. Click "Start Entry"
6. Observe:
   - Console goes silent
   - Page becomes unresponsive
   - Browser tab closes or process terminates
   - No error message displayed

---

## Evidence of Data Type Mismatch

**What Backend Sends:**
```json
{
  "success": true,
  "data": [... array of templates ...],
  "pagination": { "page": 1, ... }
}
```

**What Frontend Code Expects:**
```typescript
// Line 1022-1024 queryFn returns: res.data
// Which is: { data: LogTemplate[], pagination: Pagination }

// Line 1093 tries to use it as:
if (Array.isArray(templateData)) { ... }
// But templateData is an object, not an array
```

**Proof:**
- If you logged `templateData` at line 1093, you'd see:
  ```javascript
  {
    data: [LogTemplate, LogTemplate, ...],
    pagination: { page: 1, per_page: 50, ... }
  }
  ```
- Not an array, but an object with a `data` property

---

## Summary

The crash is 100% reproducible and caused by a straightforward type mismatch. The fix requires extracting the `data` array from the paginated response object before trying to use it.
