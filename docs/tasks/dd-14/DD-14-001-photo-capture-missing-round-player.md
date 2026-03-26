---
id: DD-14-001
title: Implement photo capture in RoundPlayer checkpoint input
unit: DD-14
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a checkpoint has `media_requirements.photo` set to `"optional"` or `"required"`, the RoundPlayer must show a camera/photo capture UI at that checkpoint. On mobile, this opens the device camera. On desktop, this opens a file picker accepting images. If photo is `"required"`, the player must block advancement to the next checkpoint until a photo is captured.

## Spec Excerpt (verbatim)

> **Take a photo** — equipment condition documentation
> Each of these can be configured per checkpoint as: not available, optional, or **required**. Required media forces the operator to capture before moving to the next checkpoint.
> — 14_ROUNDS_MODULE.md, §Every Checkpoint Can

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/RoundPlayer.tsx` — CheckpointInput component (lines 513-833); video/audio capture implemented here but photo is absent
- `frontend/src/pages/rounds/TemplateDesigner.tsx` — `photo` field in EditableCheckpoint type (line 31); media config at line 115,121 — already wired into the API payload

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] CheckpointInput renders a "Take Photo" button or file input when `checkpoint.media_requirements?.photo` is `"optional"` or `"required"`
- [ ] Photo capture uses `<input type="file" accept="image/*" capture="environment">` for mobile camera access
- [ ] When photo is `"required"`, saveCurrentResponse() blocks advancement (returns false) if no photo captured — same pattern as video at RoundPlayer.tsx:977-980
- [ ] Captured photo is converted to base64 and included in the ResponseItem payload (same pattern as `video_attachment` at line 1028-1031)
- [ ] A "Re-take" option exists once a photo is captured (same pattern as video re-record at lines 746-752)

## Assessment

After checking:
- **Status**: ❌ Missing
- **What's missing**: CheckpointInput (RoundPlayer.tsx:628) handles video (line 731-771), audio (line 773-813), and comments (line 815-830). There is no code block for `checkpoint.media_requirements?.photo`. The `photo` field is tracked in TemplateDesigner.tsx and sent to the API but never read in the player.

## Fix Instructions (if needed)

In `frontend/src/pages/rounds/RoundPlayer.tsx`:

1. Add photo state to `CheckpointInput` alongside the video/audio states (around line 534):
   ```
   const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
   ```

2. Add a photo capture section in the CheckpointInput JSX between the main input block and the video section (around line 731). Pattern:
   ```tsx
   {checkpoint.media_requirements?.photo && (
     <div>
       <label>Photo {checkpoint.media_requirements.photo === 'required' && <span>*</span>}</label>
       {photoBlob ? (
         <div>
           <span>Photo captured</span>
           <button onClick={() => setPhotoBlob(null)}>Re-take</button>
         </div>
       ) : (
         <input
           type="file"
           accept="image/*"
           capture="environment"
           onChange={(e) => {
             const file = e.target.files?.[0]
             if (file) setPhotoBlob(file)
           }}
         />
       )}
     </div>
   )}
   ```

3. In `saveCurrentResponse()` (around line 977), add a block after the video required check:
   ```
   if (cp.media_requirements?.photo === 'required' && !photoBlobs[cpIndex]) {
     setError('Photo capture is required for this checkpoint.')
     return false
   }
   ```
   This requires threading `photoBlobs` state up to the parent (same pattern as `videoBlobs` state at line 857).

4. In the ResponseItem construction (around line 1037), add `photo_attachment` field similarly to `video_attachment`.

5. Update the `CheckpointInput` props signature to add `onPhotoCapture` and `photoCaptured` props, matching the video pattern at lines 519-522.

Do NOT:
- Use getUserMedia for photo (use `<input type="file" capture>` — simpler, better cross-browser)
- Store the full Blob in the response body if it's large — convert to base64 the same way as video (blobToBase64 at line 1020)
- Render the photo section when `media_requirements.photo` is `undefined` or `"none"`
