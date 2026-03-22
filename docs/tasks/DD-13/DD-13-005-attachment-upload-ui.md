---
id: DD-13-005
title: Implement attachment upload UI (photo, video, audio, 10MB limit)
unit: DD-13
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Operators must be able to attach photos (equipment condition), videos (procedures), and audio recordings (voice notes) to log entries. Files are limited to 10MB each. Attachments are uploaded to the server and referenced by `file_path` in `log_media`. On mobile, photo attachments are a primary workflow for documenting equipment issues.

## Spec Excerpt (verbatim)

> - Photo upload (equipment condition)
> - Video upload (procedures)
> - Audio recording (voice notes)
> - File size limits (10 MB per file)
> - Stored on server filesystem, referenced by file_path in database
> — design-docs/13_LOG_MODULE.md, §Attachments

> `POST /api/logs/instances/:id/attachments` - Upload attachment
> — design-docs/13_LOG_MODULE.md, §API Endpoints

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/log/LogEditor.tsx` — attachment panel must be added here (instance-level, below segments)
- `frontend/src/api/logs.ts` — `uploadAttachment` method is absent; needs to be added
- `frontend/src/pages/log/LogEditor.tsx:582-635` — existing mutations for reference on how to add upload mutation

## Verification Checklist

- [ ] An "Attachments" section appears in `LogEditor.tsx` below the segments, visible when instance is not `submitted`/`reviewed`
- [ ] File input accepts `image/*`, `video/*`, `audio/*` MIME types
- [ ] Client-side file size validation rejects files over 10MB with an inline error message (not a browser alert)
- [ ] `logsApi.uploadAttachment(instanceId, file)` posts to `POST /api/logs/instances/:id/attachments` using `multipart/form-data`
- [ ] Uploaded attachments are listed below the upload control with filename, type badge, and remove option
- [ ] The section is hidden (not shown) when `readOnly === true` (instance is submitted/reviewed)

## Assessment

- **Status**: ❌ Missing
- No attachment UI exists in any file under `frontend/src/pages/log/`
- `frontend/src/api/logs.ts` has no `uploadAttachment` method
- The API endpoint `POST /api/logs/instances/:id/attachments` exists in the spec but is not called from any frontend code

## Fix Instructions

1. Add to `frontend/src/api/logs.ts`:
   ```ts
   uploadAttachment: (instanceId: string, file: File): Promise<ApiResult<{ id: string; filename: string; file_path: string; media_type: string }>> => {
     const form = new FormData()
     form.append('file', file)
     return api.postForm(`/api/logs/instances/${instanceId}/attachments`, form)
   },
   ```
   Note: `api.postForm` must use `Content-Type: multipart/form-data` — check the `api` client for an existing `postForm` helper or add one.

2. Create a new `AttachmentPanel` component inside `LogEditor.tsx` or in a separate file. It should:
   - Show a file input button for adding files
   - List attached files with filename, type (photo/video/audio), and a remove button
   - Enforce the 10MB limit with an inline error: `if (file.size > 10 * 1024 * 1024) { setError('File exceeds 10 MB limit') }`
   - Use a `useMutation` that calls `logsApi.uploadAttachment`
   - On success, invalidate `['log-instance', id]` to refresh the entry

3. In `LogEditor.tsx`, add `<AttachmentPanel instanceId={id!} readOnly={readOnly} />` after the segments `div` (after line 837, before `{showSubmitDialog …}`).

Do NOT:
- Use `window.alert()` for file size errors — use inline UI
- Accept all MIME types — restrict to `image/*,video/*,audio/*`
- Show the upload control when `readOnly` is true (submitted/reviewed instances)
- Implement audio recording in v1 — a file upload for audio files is sufficient (the spec does not require browser-native audio recording)
