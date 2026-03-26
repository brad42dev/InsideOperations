# DD-13-020 Investigation Summary

**Date:** 2026-03-26
**Task:** Re-verify WYSIWYG font-family toolbar when log backend API is available
**Status:** BLOCKED (depends on DD-13-023)

---

## Findings

### ✅ Font-Family Control Implementation — COMPLETE

The WYSIWYG font-family toolbar control is **fully implemented and correct**:

**Location:** `frontend/src/pages/log/LogEditor.tsx:267-294`

**Implementation Details:**
```tsx
<select
  title="Font family"
  value={editor.getAttributes('textStyle').fontFamily ?? ''}
  onChange={(e) => {
    const value = e.target.value
    if (value) {
      editor.chain().focus().setFontFamily(value).run()
    } else {
      editor.chain().focus().unsetFontFamily().run()
    }
  }}
  style={...}
>
  <option value="">Default</option>
  <option value="Inter, sans-serif">Inter</option>
  <option value="serif">Serif</option>
  <option value="monospace">Monospace</option>
  <option value="Arial, sans-serif">Arial</option>
  <option value="Georgia, serif">Georgia</option>
</select>
```

**Configuration:**
- Tiptap `FontFamily` extension imported (line 116) ✓
- Extension configured in editor (line 116) ✓
- Event handler uses correct Tiptap API ✓
- 6 font options provided ✓

---

### ❌ Backend Blocker — MISSING HANDLER

The `POST /api/logs/instances` endpoint is **not implemented**:

**Error:** HTTP 405 Method Not Allowed

**Missing Component:**
- Handler: `services/api-gateway/src/handlers/logs.rs::create_instance` — **DOES NOT EXIST**
- Route: `POST /api/logs/instances` — **NOT WIRED**

**Impact:**
- Users cannot create log instances via the UI
- Frontend API client (logs.ts:117) calls this endpoint but gets 405
- LogEditor is unreachable
- Entire Log module workflow is broken

---

## Backend Status (Partial)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| /api/logs/templates | GET | ✅ Working | Returns 2 seed templates |
| /api/logs/templates | POST | ⚠️ Unknown | Not tested |
| /api/logs/instances | GET | ✅ Route registered | Can list instances (if any exist) |
| /api/logs/instances | POST | ❌ Missing | Returns 405 — handler not implemented |
| /api/logs/instances/:id | GET | ✅ Route registered | Handler exists |
| /api/logs/instances/:id | PUT | ✅ Route registered | Handler exists |

---

## What Was Tested

### Code Inspection ✓
- ✅ LogEditor.tsx implementation verified
- ✅ Font-family extension configured correctly
- ✅ Event handler calls setFontFamily with correct Tiptap API
- ✅ 6 fonts provided in dropdown

### Frontend API Client ✓
- ✅ logs.ts correctly calls `/api/logs/templates`
- ✅ logs.ts correctly calls `/api/logs/instances`
- ✅ API paths match backend route definitions

### Backend Endpoints ✓
- ✅ GET /api/logs/templates returns 2 seed templates
- ✅ Routes registered in main.rs

### Interactive Testing ❌ BLOCKED
- ❌ Cannot create log instances (POST endpoint missing)
- ❌ Cannot access LogEditor in browser
- ❌ Cannot verify visual behavior (text appearance changes when font selected)
- ❌ Cannot test dropdown interaction

---

## Root Cause

The backend implementation of the Log module is incomplete. The following handlers exist:
- list_instances
- get_instance
- update_instance
- submit_instance

But the critical **create_instance** handler is missing. This breaks the entire user workflow:
1. User navigates to /log
2. User clicks "New Log"
3. User selects a template
4. Frontend calls `POST /api/logs/instances` to create instance
5. **Backend returns 405** ← FAILURE
6. User cannot access LogEditor
7. Font-family control cannot be tested

---

## Next Steps

**Blockin Task:** [DD-13-023] Implement POST /api/logs/instances handler

Once DD-13-023 is completed:
1. Users can create log instances
2. LogEditor becomes accessible
3. DD-13-020 can be re-verified with interactive testing
4. Font-family control behavior can be validated in browser

---

## Evidence

### Curl Test Results
```bash
# GET /api/logs/templates — WORKS
curl http://localhost:3000/api/logs/templates \
  -H "Authorization: Bearer <token>"
# → 200 OK with 2 templates

# POST /api/logs/instances — FAILS
curl -X POST http://localhost:3000/api/logs/instances \
  -H "Authorization: Bearer <token>" \
  -d '{"template_id":"...","team_name":"Test"}'
# → 405 Method Not Allowed
```

### Code Grep Results
```bash
# create_instance handler — MISSING
grep "pub async fn create_instance" \
  services/api-gateway/src/handlers/logs.rs
# → (no results)

# POST /api/logs/instances route — NOT WIRED
grep "post.*logs.*instances\|instances.*post" \
  services/api-gateway/src/main.rs
# → (no results)
```

---

## Conclusion

**DD-13-020 Status: BLOCKED**

The font-family control implementation is complete and correct, but UAT cannot be completed because the backend is missing a critical handler (`POST /api/logs/instances`). This is tracked in [DD-13-023].

The implementation itself passes code inspection and is spec-compliant. Once the backend handler is implemented, a simple re-run of this UAT will complete verification.
