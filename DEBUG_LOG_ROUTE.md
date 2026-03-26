# Debug Report: /log/new Route Crash

## Summary
The `/log/new` route successfully loads and displays the template selection form. However, when a user clicks "Start Entry" after selecting a template, the browser crashes entirely (tabs close, process terminates).

## Test Steps Executed
1. Navigated to http://localhost:5173/log/new
2. Page loaded successfully with templates list visible
3. Console showed 2 initial errors (non-critical):
   - Failed to load: GET /api/v1/uom/catalog (404)
   - Failed to load: GET /api/v1/rounds?status=in_progress&limit=1 (404)
4. Templates loaded: 6 templates visible in the select dropdown
5. Clicked on the template dropdown
6. Attempted to click "Start Entry" button
7. **Browser crashed** - `Target page, context or browser has been closed` error

## Root Cause Analysis

### Issue 1: templateData Type Mismatch in LogEditor.tsx (Line 1022-1024)

**Location:** `/frontend/src/pages/log/LogEditor.tsx:1022-1024`

```typescript
const { data: templateData } = useQuery({
  queryKey: ['log-templates'],
  queryFn: async () => {
    const res = await logsApi.listTemplates()  // ← Returns Promise<ApiResult<PagedResponse<LogTemplate>>>
    if (!res.success) throw new Error(res.error.message)
    return res.data  // ← Returns PagedResponse<LogTemplate>
  },
  enabled: !!instanceData,
})
```

**The Problem:**
- Backend returns: `PagedResponse<LogTemplate>` with structure:
  ```json
  {
    "success": true,
    "data": [...templates...],
    "pagination": {...}
  }
  ```
- Frontend API type signature is correct: `ApiResult<PaginatedResult<LogTemplate>>`
- But `PaginatedResult` and actual backend `PagedResponse` have different names/locations
- After unwrapping `res.data` in the queryFn, `templateData` is `{ data: LogTemplate[], pagination: {...} }`
- On line 1093, the code incorrectly assumes it's a plain array: `Array.isArray(templateData) ? templateData : []`
- Since `templateData` is an object, not an array, `Array.isArray()` returns `false`
- Result: `templateList = []` (empty array) ❌

**Backend Response (from `/services/api-gateway/src/handlers/logs.rs:224`):**
```rust
Json(PagedResponse::new(templates, pg, limit, total as u64)).into_response()
```

**Actual Response Structure:**
```json
{
  "success": true,
  "data": [
    { "id": "...", "name": "Font Test Template", ... },
    ...
  ],
  "pagination": { "page": 1, "per_page": 50, "total_items": 6, "total_pages": 1 }
}
```

**Expected Fix:**
```typescript
const templateList: LogTemplate[] = Array.isArray(templateData)
  ? templateData
  : (templateData as any)?.data ?? []
```

### Issue 2: Browser Crash on Navigation (More Severe)

The fact that the browser crashes completely rather than showing an error boundary suggests:

1. **WebSocket Worker Hang** - The `wsWorker.ts` SharedWorker may be entering an infinite loop or creating runaway resources when trying to connect with invalid data

2. **Infinite Loop in useEditor (Tiptap)** - The Tiptap editor initialization on line 105 of LogEditor may be attempting to render with corrupted segment data due to the empty `orderedSegments` array

3. **Memory Leak** - Multiple re-renders of components with corrupted state causing memory exhaustion

4. **Circular Reference in State** - The `pendingContentRef` or editor state may contain a circular reference when building content from corrupted templates

### Reproduction Path
1. Navigate to `/log/new` → ✅ Works
2. Select template → ✅ Works
3. Click "Start Entry" → Calls `createMutation.mutate()`
4. API call to `POST /api/logs/instances` succeeds
5. `navigate('/log/{result.data.id}')` → Routes to `/log/{id}`
6. LogEditor mounts
7. Three parallel queries start:
   - `getInstance(id)` → ✅ Returns log instance
   - `listSegments()` → May return paginated result with wrong type
   - `listTemplates()` → Returns paginated result, code treats as empty array
8. LogEditor tries to initialize Tiptap with empty `orderedSegments`
9. WebSocket hook tries to subscribe to an undefined set of points
10. **Browser crashes**

## Evidence

**Console Errors at /log/new:**
```
[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found)
  @ http://localhost:5173/api/v1/uom/catalog:0
[ERROR] Failed to load resource: the server responded with a status of 404
  @ http://localhost:5173/api/v1/rounds?status=in_progress&limit=1:0
[LOG] [LogNew] API response success: true
[LOG] [LogNew] Fetched templates: 6 [Object, Object, ...]
```

**Browser State After Crash:**
```
Error: page._wrapApiCall: Target page, context or browser has been closed
```

## Affected Files
1. `/frontend/src/pages/log/LogEditor.tsx` - Line 1093
2. `/frontend/src/pages/log/LogNew.tsx` - No issues detected
3. `/frontend/src/api/logs.ts` - API types are correct
4. `/frontend/src/shared/hooks/useWebSocket.ts` - Hook logic appears sound
5. `/frontend/src/workers/wsWorker.ts` - Worker logic appears sound

## Critical Findings

### Type Contract Violation
The API contract in `logs.ts` line 80 is:
```typescript
listTemplates: (...) => Promise<ApiResult<PaginatedResult<LogTemplate>>>
```

But LogEditor treats the resolved `data` as though it's an array directly, not a `PaginatedResult`.

Similarly, line 1009-1015 calls `listSegments()` which per the API should return a `LogSegment[]` but the response handling suggests it might also be paginated.

### Similar Issue with Segments
Line 1009-1015 in LogEditor may have the same issue:
```typescript
const { data: segmentsData } = useQuery({
  queryKey: ['log-segments'],
  queryFn: async () => {
    const res = await logsApi.listSegments()
    if (!res.success) throw new Error(res.error.message)
    return res.data
  },
  enabled: !!instanceData,
})
```

Line 1094 assumes it's an array: `Array.isArray(segmentsData) ? segmentsData : []`

**API definition (line 104-105):** `listSegments: () => Promise<ApiResult<LogSegment[]>>`

This one might actually be OK since it returns an array directly, not paginated. **But needs verification with actual API response.**

## Non-Critical Issues

1. **404 errors on non-critical APIs:**
   - UOM catalog endpoint missing (not blocking)
   - Rounds status check missing (not blocking)

2. **Type casting:** Multiple `any` type casts suggest incomplete type safety

## Recommended Fixes (Priority Order)

1. **CRITICAL** - Fix templateData/segmentsData type handling in LogEditor.tsx to properly extract from paginated responses
2. **CRITICAL** - Verify that `getInstance()` response structure matches expectations
3. **HIGH** - Add null/undefined guards in segment building logic (lines 1084-1102)
4. **HIGH** - Check wsWorker subscription logic when orderedSegments is empty
5. **MEDIUM** - Implement proper error handling for Tiptap editor initialization
6. **MEDIUM** - Add recovery mode when templates or segments fail to load

## Next Steps

1. Verify the actual response format from `/api/logs/templates` endpoint
2. Verify the actual response format from `/api/logs/segments` endpoint
3. Verify the actual response format from `/api/logs/instances/{id}` endpoint
4. Add comprehensive null/undefined checks before rendering LogEditor content
5. Add error logging before Tiptap initialization
6. Consider adding a loading/skeleton state for better UX during data loading
