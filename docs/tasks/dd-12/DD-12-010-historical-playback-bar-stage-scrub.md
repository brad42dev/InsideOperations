---
id: DD-12-010
title: Replace datetime-local input for graphic snapshot timestamp with Historical Playback Bar
unit: DD-12
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

When the investigator adds a graphic snapshot to a stage, the timestamp picker should use the shared Historical Playback Bar in its "Forensics mode" — providing scrub and step controls scoped to the stage's time range with alarm markers — rather than a plain `<input type="datetime-local">`.

## Spec Excerpt (verbatim)

> The timestamp picker for graphic snapshots uses the shared **Historical Playback Bar** (doc 32) in its simplified Forensics mode — scrub and step controls scoped to the stage's time range, with alarm markers. This lets the investigator scrub through the stage timeline to find the exact moment to capture, rather than typing a timestamp manually.
> — 12_FORENSICS_MODULE.md, §Evidence Toolkit > Graphic Snapshots

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/forensics/InvestigationWorkspace.tsx` — snapshot dialog at lines 362–468; timestamp input at line 419 uses `type="datetime-local"`
- `frontend/src/shared/components/` — look for a `PlaybackBar` or `HistoricalPlaybackBar` shared component

## Verification Checklist

- [ ] The graphic snapshot dialog shows a PlaybackBar scoped to the stage's time range, not a datetime-local input
- [ ] The PlaybackBar has scrub (slider) and step forward/backward controls
- [ ] Alarm markers are visible on the playback bar timeline
- [ ] The selected timestamp from the PlaybackBar is passed to `addEvidenceMutation` as the snapshot timestamp
- [ ] Fallback to datetime-local input if PlaybackBar is not yet implemented (with a TODO comment)

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: StageCard snapshot dialog (InvestigationWorkspace.tsx:415–431) uses `<input type="datetime-local">`. No PlaybackBar import or usage found anywhere in the forensics module.

## Fix Instructions

In `frontend/src/pages/forensics/InvestigationWorkspace.tsx`, inside the snapshot dialog (lines 415–431):

1. Import the shared PlaybackBar component (likely `frontend/src/shared/components/PlaybackBar.tsx` or similar).

2. Replace the `datetime-local` input with:
   ```tsx
   <PlaybackBar
     startTime={stage.time_range_start}
     endTime={stage.time_range_end}
     value={snapshotTimestamp}
     onChange={(ts) => setSnapshotTimestamp(ts)}
     mode="forensics"  // simplified mode: scrub + step, no play/pause/speed
     showAlarmMarkers={true}
     pointIds={/* points in this investigation for alarm marker data */}
   />
   ```

3. If `PlaybackBar` is not yet available as a shared component, keep the `datetime-local` input as a temporary fallback and add a TODO comment referencing this task.

4. Ensure the `onChange` value from PlaybackBar is an ISO string compatible with the existing `snapshotTimestamp` state.

Do NOT:
- Remove the snapshot capability — just upgrade the timestamp input method
- Block the snapshot feature on PlaybackBar availability — datetime-local is acceptable as a temporary fallback
