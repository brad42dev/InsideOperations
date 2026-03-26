---
id: DD-14-002
title: Implement video and audio media capture in RoundPlayer checkpoint inputs
unit: DD-14
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a checkpoint has `media_requirements.video` or `media_requirements.audio` configured, the RoundPlayer must render capture controls for those media types. Video capture opens the device camera for recording. Audio capture opens the microphone for voice notes. Both can be configured as optional or required per checkpoint. If required, the operator cannot advance to the next checkpoint without capturing the media.

## Spec Excerpt (verbatim)

> **Take a video** — procedure recording
> **Record audio** — voice notes
> Each of these can be configured per checkpoint as: not available, optional, or **required**. Required media forces the operator to capture before moving to the next checkpoint.
> — 14_ROUNDS_MODULE.md, §Every Checkpoint Can

> **Camera access for photos/video**
> **Microphone access for audio notes**
> — 14_ROUNDS_MODULE.md, §Mobile Capabilities

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/RoundPlayer.tsx` — CheckpointInput component at lines 249–400; this is where video/audio controls must be added
- `frontend/src/pages/rounds/TemplateDesigner.tsx` — CheckpointEditor at lines 503–521; currently only configures `photo` and `comments`; needs `video` and `audio` fields added
- `frontend/src/api/rounds.ts` — CheckpointMediaRequirements type at lines 17–20; only `photo` and `comments` are defined; `video` and `audio` are missing

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `CheckpointMediaRequirements` in api/rounds.ts includes `video` and `audio` fields with same value type as `photo`
- [ ] TemplateDesigner CheckpointEditor renders video and audio requirement selectors (none/optional/required)
- [ ] CheckpointInput renders a video capture button when `checkpoint.media_requirements?.video` is truthy
- [ ] CheckpointInput renders an audio record button when `checkpoint.media_requirements?.audio` is truthy
- [ ] handleNext (RoundPlayer.tsx:576) blocks advancement when a required video/audio is not captured
- [ ] Captured media is attached to the ResponseItem sent to saveResponses (as base64 or multipart)

## Assessment

- **Status**: ❌ Missing — CheckpointMediaRequirements type only has photo/comments; no video/audio UI in CheckpointInput; TemplateDesigner only exposes photo and comments selectors (lines 503–521)

## Fix Instructions (if needed)

1. **Update the type** in `frontend/src/api/rounds.ts` — add `video` and `audio` to CheckpointMediaRequirements (lines 17–20):
   ```ts
   export interface CheckpointMediaRequirements {
     photo?: 'optional' | 'required' | 'required_on_alarm'
     video?: 'optional' | 'required' | 'required_on_alarm'
     audio?: 'optional' | 'required' | 'required_on_alarm'
     comments?: 'optional' | 'required' | 'required_on_alarm'
   }
   ```

2. **Update TemplateDesigner** at lines 503–521 — add two more Field/select rows for video and audio alongside the existing photo and comments rows. Follow the identical pattern used for photo (lines 505–512) — 4 options: none / optional / required / required_on_alarm.

3. **Update CheckpointInput** in RoundPlayer.tsx (after the comments textarea, ~line 382) — add:
   - A video capture section: button opens MediaRecorder against `getUserMedia({ video: true, audio: true })`; on stop, stores blob in component state; shows thumbnail or "Video recorded" confirmation
   - An audio capture section: button triggers `getUserMedia({ audio: true })`; MediaRecorder records; on stop, shows "Audio recorded" with playback control

4. **Block advancement on required media** — in `saveCurrentResponse` (line 516) or in `handleNext` (line 576), check that if `cp.media_requirements?.video === 'required'`, a video blob is present; same for audio. If not, call `setError('Video capture is required for this checkpoint.')` and return false.

5. Media blobs should be converted to base64 and included in the ResponseItem payload or uploaded via a separate attachment endpoint.

Do NOT:
- Remove the existing photo and comments requirement handling
- Use MediaDevices API directly without checking for browser support and gracefully degrading
- Require video/audio to block on alarm-only checkpoints that haven't triggered an alarm
