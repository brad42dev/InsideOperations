# Work Unit Log: workstream-4-5b-zindex-fix

read-ui-audi

Started: 2026-05-28T06:48:32+00:00
Session: 4f217d94-c8c4-4f86-a176-ee0326c01bc9

---


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (199→260 chars)

_2026-05-28T06:51:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (215→276 chars)

_2026-05-28T06:51:57+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (194→255 chars)

_2026-05-28T06:52:02+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (135→150 chars)

_2026-05-28T06:52:07+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (103→268 chars)

_2026-05-28T06:52:14+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (67→93 chars)

_2026-05-28T06:52:19+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (277→294 chars)

_2026-05-28T06:52:23+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (303→327 chars)

_2026-05-28T06:52:32+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (292→309 chars)

_2026-05-28T06:52:37+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (206→233 chars)

_2026-05-28T06:52:43+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (246→274 chars)

_2026-05-28T06:52:48+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (178→193 chars)

_2026-05-28T06:52:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (191→210 chars)

_2026-05-28T06:52:56+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (254→269 chars)

_2026-05-28T06:53:01+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (234→252 chars)

_2026-05-28T06:53:17+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (208→225 chars)

_2026-05-28T06:53:22+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (208→225 chars)

_2026-05-28T06:53:33+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (258→285 chars)

_2026-05-28T06:53:38+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (134→162 chars)

_2026-05-28T06:53:42+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (134→162 chars)

_2026-05-28T06:53:47+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (206→230 chars)

_2026-05-28T06:53:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (128→152 chars)

_2026-05-28T06:53:57+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (204→256 chars)

_2026-05-28T06:54:22+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (403→824 chars)

_2026-05-28T06:54:31+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (1637→2123 chars)

_2026-05-28T06:54:55+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (140→272 chars)

_2026-05-28T06:55:00+00:00_


## #PROMPT

_2026-05-28T06:55:13+00:00_

```
~initprompt~ workstream-4.5b-zindex-fix

Read ui-audit/11-zindex-assessment.md and index.css. The user has made these decisions:

Scope: FULL REMAP. Apply all 19 remaps in the assessment's Part Five table — both the behavior-changing moves and the zero-risk token-adoption swaps — so DesignerCanvas fully uses the permanent z-index scale.

Scale gap #1 (canvas annotation overlays): ADD a new token --io-z-canvas-overlay: 600 to the permanent scale in index.css, in all three themes. Use it for the three Tier B elements (lines 8038, 9917, 10271) INSTEAD of --io-z-dropdown. This corrects the semantic mismatch the assessment flagged and gives canvas-pane modules in the future rebuild a correct named token.

Scale gap #2 (drag cursor at 9999): DO NOT add a token and DO NOT remap to a token. Leave line 3750 at hardcoded 9999, but add a code comment documenting it as an intentional exception: an always-on-top, pointer-events:none transient drag indicator that must sit above all UI including emergency overlays, deliberately exempt from the token scale.

Scale gap #3 (ConfirmDialog vs canvas dialogs): ADD a new token --io-z-priority-modal: 1050 to the permanent scale in index.css, in all three themes, positioned between --io-z-modal (1000) and --io-z-command (1200). In THIS prompt, move the canvas-spawned dialogs (lines 332, 8621, 9426) to --io-z-modal (1000) as the assessment specifies. Do NOT modify ConfirmDialog.tsx in this prompt — that shared component's move to --io-z-priority-modal is a separate one-line change handled immediately after, to keep the canvas diff clean. Just define the token now so it exists.

Apply the remap:

1. Add the two new tokens (--io-z-canvas-overlay: 600 and --io-z-priority-modal: 1050) to index.css in all three theme blocks (dark, light, hphmi). Confirm placement is consistent with the existing --io-z-* scale ordering.

2. For each of the 19 DesignerCanvas z-index values in the assessment's Part Five table, apply the proposed token, with these adjustments to the assessment's proposals: the three Tier B elements (8038, 9917, 10271) use var(--io-z-canvas-overlay) not var(--io-z-dropdown); line 3750 stays hardcoded 9999 with the documented-exception comment. All others use the token the assessment specified.

3. For each change, state the line, the element, the old value, and the new token reference. Use calc() offsets exactly as the assessment specified for the Tier A elements so their integer values are preserved.

4. The assessment flagged 5 HIGH and 2 MEDIUM risk behavior-changing remaps (lines 8038, 9917, 10271, 9426, 9605 high; 332, 8621 medium). For each of these seven, note it explicitly in your output as needing a spot-check, because it changes observable stacking.

Constraints: stay in DesignerCanvas.tsx and index.css only. Do not touch ConfirmDialog.tsx or any other component in this prompt. Do not change any z-index value's computed result except the seven intended behavior-changing moves. Do not refactor surrounding canvas code.

Update ui-audit/11-zindex-assessment.md by marking each remap applied with the date, and note the two new tokens added to the scale.

When done print: the two new tokens added (with all-theme values), the 19 remaps applied (old value to new token), the seven behavior-changing ones flagged for spot-check, and confirmation that ConfirmDialog.tsx was NOT touched. Stop.
```


## #ASSISTANT

Reading the assessment and relevant files before making any changes.


## #BASH
_Find all z-index token definitions in index.css_

```bash
grep -n "io-z-" /home/io/io-dev/io/frontend/src/index.css | head -60
```


## #ASSISTANT

Now let me read the z-index token section of index.css and the DesignerCanvas.tsx file around the relevant lines.


## #ASSISTANT

Let me check the theme block structure and the DesignerCanvas lines that need changes.


## #BASH
_Find theme selector blocks in index.css_

```bash
grep -n "^/\*\|^:root\|^\[data-theme" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #ASSISTANT

Now let me look at all the DesignerCanvas lines that need to be changed.


## #BASH
_Check total line count of DesignerCanvas.tsx_

```bash
wc -l /home/io/io-dev/io/frontend/src/designer/DesignerCanvas.tsx
```


## #BASH
_Find DesignerCanvas.tsx location_

```bash
find /home/io/io-dev/io/frontend/src -name "DesignerCanvas.tsx" 2>/dev/null
```


## #BASH
_Check total line count_

```bash
wc -l /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx
```


## #ASSISTANT

Let me read all the remaining lines in parallel batches.


## #ASSISTANT

Let me see the full context of line 3750 for the comment placement.


## #ASSISTANT

I have all the context needed. Starting with the index.css token additions, then the 19 DesignerCanvas.tsx remaps.

**Step 1: index.css — dark theme block (`:root`)**


## #ASSISTANT

**Step 2: index.css — light theme block**


## #ASSISTANT

**Step 3: index.css — HPHMI theme block**


## #ASSISTANT

index.css done. Now the 19 DesignerCanvas.tsx remaps, working top to bottom.

**Remap 1 — Line 332: Fixed modal backdrop 2000 → `var(--io-z-modal)` [MEDIUM risk]**


## #ASSISTANT

That diagnostic is pre-existing in a different file — not related to my edits. Continuing with the remaps.

**Remap 2 — Line 3750: Drag cursor 9999 — add documented-exception comment, keep value**


## #ASSISTANT

**Remap 3 — Line 7689: SVG guide/grid line -1 → `calc(var(--io-z-base) - 1)`**


## #ASSISTANT

**Remap 4 — Line 7994: Canvas container overlay 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 5 — Line 8038: Canvas badge/overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

**Remap 6 — Line 8222: Element tooltip 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 7 — Line 8302: Selection highlight 15 → `calc(var(--io-z-panel) + 5)`**


## #ASSISTANT

**Remap 8 — Line 8377: Inline text editor 20 → `calc(var(--io-z-panel) + 10)`**


## #ASSISTANT

**Remap 9 — Line 8621: Fixed dialog backdrop 1200 → `var(--io-z-modal)` [MEDIUM risk]**


## #ASSISTANT

**Remap 10 — Line 8928: Point picker overlay 3000 → `var(--io-z-emergency)`**


## #ASSISTANT

**Remap 11 — Line 9426: Slot assignment popover 2000 → `var(--io-z-modal)` [HIGH risk]**


## #ASSISTANT

**Remap 12 — Line 9605: Canvas bottom toolbar HUD 2000 → `var(--io-z-dropdown)` [HIGH risk]**


## #ASSISTANT

**Remaps 13 & 14 — Lines 9792 and 9814: Ruler bars 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 15 — Line 9837: Ruler corner tile 11 → `calc(var(--io-z-panel) + 1)`**


## #ASSISTANT

**Remaps 16 & 17 — Lines 9863 and 9876: Guide drag handles 9 → `calc(var(--io-z-panel) - 1)`**


## #ASSISTANT

**Remap 18 — Line 9917: Tooltip/inline overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

**Remap 19 — Line 10271: Tooltip/inline overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

All 19 remaps applied. Now verifying there are no stale hardcoded z-index values left in DesignerCanvas.tsx from the remap list, then updating the assessment doc.


## #BASH
_Check for any remaining hardcoded zIndex values in DesignerCanvas.tsx_

```bash
grep -n "zIndex:" /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx | grep -v "var(--io-z" | grep -v "9999" | grep -v "string\|//\|zIndexScale\|zIndexRef"
```


## #BASH
_Check for remaining hardcoded z-index in cssText strings_

```bash
grep -n "z-index:" /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx | grep -v "var(--io-z" | grep -v "9999"
```


## #ASSISTANT

Clean — only the intentional 9999 exception remains. Let me also verify the two new tokens are in all three theme blocks.


## #BASH
_Verify new tokens are present in all three theme blocks_

```bash
grep -n "io-z-canvas-overlay\|io-z-priority-modal" /home/io/io-dev/io/frontend/src/index.css
```


## #ASSISTANT

Both tokens in all three blocks. Now updating the assessment doc.


## #ASSISTANT

Now mark each remap in the Part Five summary table with the applied date.


## #TURN_END

_2026-05-28T06:55:16+00:00_

---


## #PROMPT

_2026-05-28T07:02:11+00:00_

```
You are performing a DEEP verification review of a Claude Code work unit.

Your job is to compare what was asked (the initial prompt and any work-unit
summary) against what was actually built (the diff and the surrounding code).

Be skeptical and direct. Look for:
- The diff does something different from what was asked
- The diff regresses previously working behavior
- The diff expands scope beyond the prompt
- The diff has integration concerns with surrounding code that aren't addressed
- The diff appears to invert architectural decisions (e.g., the prompt asked
  to move from X to Y, but the diff actually reinforces X)

Output format (markdown):

## Summary
One paragraph: does the diff appear to match intent, or are there concerns?

## Concerns
If concerns exist, list them as numbered items with:
- What the concern is
- Specifically where in the code (file and line)
- Why this might be a divergence from intent

If no concerns, write "No concerns identified."

## Verification Notes
Anything else useful to know about what was built.

DO NOT include preamble. Start directly with "## Summary".
DO NOT speculate about things outside the diff. Stay grounded in what's there.

WORK UNIT LOG:
---
# Work Unit Log: workstream-4-5b-zindex-fix

read-ui-audi

Started: 2026-05-28T06:48:32+00:00
Session: 4f217d94-c8c4-4f86-a176-ee0326c01bc9

---


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (199→260 chars)

_2026-05-28T06:51:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (215→276 chars)

_2026-05-28T06:51:57+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (194→255 chars)

_2026-05-28T06:52:02+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (135→150 chars)

_2026-05-28T06:52:07+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (103→268 chars)

_2026-05-28T06:52:14+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (67→93 chars)

_2026-05-28T06:52:19+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (277→294 chars)

_2026-05-28T06:52:23+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (303→327 chars)

_2026-05-28T06:52:32+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (292→309 chars)

_2026-05-28T06:52:37+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (206→233 chars)

_2026-05-28T06:52:43+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (246→274 chars)

_2026-05-28T06:52:48+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (178→193 chars)

_2026-05-28T06:52:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (191→210 chars)

_2026-05-28T06:52:56+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (254→269 chars)

_2026-05-28T06:53:01+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (234→252 chars)

_2026-05-28T06:53:17+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (208→225 chars)

_2026-05-28T06:53:22+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (208→225 chars)

_2026-05-28T06:53:33+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (258→285 chars)

_2026-05-28T06:53:38+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (134→162 chars)

_2026-05-28T06:53:42+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (134→162 chars)

_2026-05-28T06:53:47+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (206→230 chars)

_2026-05-28T06:53:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (128→152 chars)

_2026-05-28T06:53:57+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (204→256 chars)

_2026-05-28T06:54:22+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (403→824 chars)

_2026-05-28T06:54:31+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (1637→2123 chars)

_2026-05-28T06:54:55+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (140→272 chars)

_2026-05-28T06:55:00+00:00_


## #PROMPT

_2026-05-28T06:55:13+00:00_

```
~initprompt~ workstream-4.5b-zindex-fix

Read ui-audit/11-zindex-assessment.md and index.css. The user has made these decisions:

Scope: FULL REMAP. Apply all 19 remaps in the assessment's Part Five table — both the behavior-changing moves and the zero-risk token-adoption swaps — so DesignerCanvas fully uses the permanent z-index scale.

Scale gap #1 (canvas annotation overlays): ADD a new token --io-z-canvas-overlay: 600 to the permanent scale in index.css, in all three themes. Use it for the three Tier B elements (lines 8038, 9917, 10271) INSTEAD of --io-z-dropdown. This corrects the semantic mismatch the assessment flagged and gives canvas-pane modules in the future rebuild a correct named token.

Scale gap #2 (drag cursor at 9999): DO NOT add a token and DO NOT remap to a token. Leave line 3750 at hardcoded 9999, but add a code comment documenting it as an intentional exception: an always-on-top, pointer-events:none transient drag indicator that must sit above all UI including emergency overlays, deliberately exempt from the token scale.

Scale gap #3 (ConfirmDialog vs canvas dialogs): ADD a new token --io-z-priority-modal: 1050 to the permanent scale in index.css, in all three themes, positioned between --io-z-modal (1000) and --io-z-command (1200). In THIS prompt, move the canvas-spawned dialogs (lines 332, 8621, 9426) to --io-z-modal (1000) as the assessment specifies. Do NOT modify ConfirmDialog.tsx in this prompt — that shared component's move to --io-z-priority-modal is a separate one-line change handled immediately after, to keep the canvas diff clean. Just define the token now so it exists.

Apply the remap:

1. Add the two new tokens (--io-z-canvas-overlay: 600 and --io-z-priority-modal: 1050) to index.css in all three theme blocks (dark, light, hphmi). Confirm placement is consistent with the existing --io-z-* scale ordering.

2. For each of the 19 DesignerCanvas z-index values in the assessment's Part Five table, apply the proposed token, with these adjustments to the assessment's proposals: the three Tier B elements (8038, 9917, 10271) use var(--io-z-canvas-overlay) not var(--io-z-dropdown); line 3750 stays hardcoded 9999 with the documented-exception comment. All others use the token the assessment specified.

3. For each change, state the line, the element, the old value, and the new token reference. Use calc() offsets exactly as the assessment specified for the Tier A elements so their integer values are preserved.

4. The assessment flagged 5 HIGH and 2 MEDIUM risk behavior-changing remaps (lines 8038, 9917, 10271, 9426, 9605 high; 332, 8621 medium). For each of these seven, note it explicitly in your output as needing a spot-check, because it changes observable stacking.

Constraints: stay in DesignerCanvas.tsx and index.css only. Do not touch ConfirmDialog.tsx or any other component in this prompt. Do not change any z-index value's computed result except the seven intended behavior-changing moves. Do not refactor surrounding canvas code.

Update ui-audit/11-zindex-assessment.md by marking each remap applied with the date, and note the two new tokens added to the scale.

When done print: the two new tokens added (with all-theme values), the 19 remaps applied (old value to new token), the seven behavior-changing ones flagged for spot-check, and confirmation that ConfirmDialog.tsx was NOT touched. Stop.
```


## #ASSISTANT

Reading the assessment and relevant files before making any changes.


## #BASH
_Find all z-index token definitions in index.css_

```bash
grep -n "io-z-" /home/io/io-dev/io/frontend/src/index.css | head -60
```


## #ASSISTANT

Now let me read the z-index token section of index.css and the DesignerCanvas.tsx file around the relevant lines.


## #ASSISTANT

Let me check the theme block structure and the DesignerCanvas lines that need changes.


## #BASH
_Find theme selector blocks in index.css_

```bash
grep -n "^/\*\|^:root\|^\[data-theme" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #ASSISTANT

Now let me look at all the DesignerCanvas lines that need to be changed.


## #BASH
_Check total line count of DesignerCanvas.tsx_

```bash
wc -l /home/io/io-dev/io/frontend/src/designer/DesignerCanvas.tsx
```


## #BASH
_Find DesignerCanvas.tsx location_

```bash
find /home/io/io-dev/io/frontend/src -name "DesignerCanvas.tsx" 2>/dev/null
```


## #BASH
_Check total line count_

```bash
wc -l /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx
```


## #ASSISTANT

Let me read all the remaining lines in parallel batches.


## #ASSISTANT

Let me see the full context of line 3750 for the comment placement.


## #ASSISTANT

I have all the context needed. Starting with the index.css token additions, then the 19 DesignerCanvas.tsx remaps.

**Step 1: index.css — dark theme block (`:root`)**


## #ASSISTANT

**Step 2: index.css — light theme block**


## #ASSISTANT

**Step 3: index.css — HPHMI theme block**


## #ASSISTANT

index.css done. Now the 19 DesignerCanvas.tsx remaps, working top to bottom.

**Remap 1 — Line 332: Fixed modal backdrop 2000 → `var(--io-z-modal)` [MEDIUM risk]**


## #ASSISTANT

That diagnostic is pre-existing in a different file — not related to my edits. Continuing with the remaps.

**Remap 2 — Line 3750: Drag cursor 9999 — add documented-exception comment, keep value**


## #ASSISTANT

**Remap 3 — Line 7689: SVG guide/grid line -1 → `calc(var(--io-z-base) - 1)`**


## #ASSISTANT

**Remap 4 — Line 7994: Canvas container overlay 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 5 — Line 8038: Canvas badge/overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

**Remap 6 — Line 8222: Element tooltip 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 7 — Line 8302: Selection highlight 15 → `calc(var(--io-z-panel) + 5)`**


## #ASSISTANT

**Remap 8 — Line 8377: Inline text editor 20 → `calc(var(--io-z-panel) + 10)`**


## #ASSISTANT

**Remap 9 — Line 8621: Fixed dialog backdrop 1200 → `var(--io-z-modal)` [MEDIUM risk]**


## #ASSISTANT

**Remap 10 — Line 8928: Point picker overlay 3000 → `var(--io-z-emergency)`**


## #ASSISTANT

**Remap 11 — Line 9426: Slot assignment popover 2000 → `var(--io-z-modal)` [HIGH risk]**


## #ASSISTANT

**Remap 12 — Line 9605: Canvas bottom toolbar HUD 2000 → `var(--io-z-dropdown)` [HIGH risk]**


## #ASSISTANT

**Remaps 13 & 14 — Lines 9792 and 9814: Ruler bars 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 15 — Line 9837: Ruler corner tile 11 → `calc(var(--io-z-panel) + 1)`**


## #ASSISTANT

**Remaps 16 & 17 — Lines 9863 and 9876: Guide drag handles 9 → `calc(var(--io-z-panel) - 1)`**


## #ASSISTANT

**Remap 18 — Line 9917: Tooltip/inline overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

**Remap 19 — Line 10271: Tooltip/inline overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

All 19 remaps applied. Now verifying there are no stale hardcoded z-index values left in DesignerCanvas.tsx from the remap list, then updating the assessment doc.


## #BASH
_Check for any remaining hardcoded zIndex values in DesignerCanvas.tsx_

```bash
grep -n "zIndex:" /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx | grep -v "var(--io-z" | grep -v "9999" | grep -v "string\|//\|zIndexScale\|zIndexRef"
```


## #BASH
_Check for remaining hardcoded z-index in cssText strings_

```bash
grep -n "z-index:" /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx | grep -v "var(--io-z" | grep -v "9999"
```


## #ASSISTANT

Clean — only the intentional 9999 exception remains. Let me also verify the two new tokens are in all three theme blocks.


## #BASH
_Verify new tokens are present in all three theme blocks_

```bash
grep -n "io-z-canvas-overlay\|io-z-priority-modal" /home/io/io-dev/io/frontend/src/index.css
```


## #ASSISTANT

Both tokens in all three blocks. Now updating the assessment doc.


## #ASSISTANT

Now mark each remap in the Part Five summary table with the applied date.


## #TURN_END

_2026-05-28T06:55:16+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/frontend/src/index.css b/frontend/src/index.css
index 43869db5..bb8c7023 100644
--- a/frontend/src/index.css
+++ b/frontend/src/index.css
@@ -203,14 +203,16 @@ body {
   --io-text-code: 0.8125rem;
   --io-text-code-sm: 0.75rem;
 
-  /* Z-Index (12) */
+  /* Z-Index (14) */
   --io-z-base: 0;
   --io-z-panel: 10;
   --io-z-sidebar: 100;
   --io-z-topbar: 100;
   --io-z-edge-hover: 150;
   --io-z-dropdown: 500;
+  --io-z-canvas-overlay: 600;
   --io-z-modal: 1000;
+  --io-z-priority-modal: 1050;
   --io-z-command: 1200;
   --io-z-visual-lock: 1500;
   --io-z-kiosk-auth: 1800;
@@ -423,7 +425,9 @@ body {
   --io-z-topbar: 100;
   --io-z-edge-hover: 150;
   --io-z-dropdown: 500;
+  --io-z-canvas-overlay: 600;
   --io-z-modal: 1000;
+  --io-z-priority-modal: 1050;
   --io-z-command: 1200;
   --io-z-visual-lock: 1500;
   --io-z-kiosk-auth: 1800;
@@ -628,7 +632,9 @@ body {
   --io-z-topbar: 100;
   --io-z-edge-hover: 150;
   --io-z-dropdown: 500;
+  --io-z-canvas-overlay: 600;
   --io-z-modal: 1000;
+  --io-z-priority-modal: 1050;
   --io-z-command: 1200;
   --io-z-visual-lock: 1500;
   --io-z-kiosk-auth: 1800;
diff --git a/frontend/src/pages/designer/DesignerCanvas.tsx b/frontend/src/pages/designer/DesignerCanvas.tsx
index 3fadec5d..7e9f864e 100644
--- a/frontend/src/pages/designer/DesignerCanvas.tsx
+++ b/frontend/src/pages/designer/DesignerCanvas.tsx
@@ -329,7 +329,7 @@ function NameGroupPrompt({
   const overlayStyle: React.CSSProperties = {
     position: "fixed",
     inset: 0,
-    zIndex: 2000,
+    zIndex: "var(--io-z-modal)",
     background: "rgba(0,0,0,0.5)",
     display: "flex",
     alignItems: "center",
@@ -3747,7 +3747,7 @@ export default function DesignerCanvas({
             ghost.style.cssText = [
               "position:fixed",
               "pointer-events:none",
-              "z-index:9999",
+              "z-index:9999", // intentional exception: pointer-events:none transient drag indicator; must sit above all UI including emergency overlays; deliberately exempt from the token scale
               `left:${e.clientX}px`,
               `top:${e.clientY}px`,
               `width:${bb ? bb.width : 40}px`,
@@ -7686,7 +7686,7 @@ export default function DesignerCanvas({
                       strokeWidth={1 / zoom}
                       strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                       pointerEvents="none"
-                      style={{ zIndex: -1 } as React.CSSProperties}
+                      style={{ zIndex: "calc(var(--io-z-base) - 1)" } as React.CSSProperties}
                     />
                   );
                 })()}
@@ -7991,7 +7991,7 @@ export default function DesignerCanvas({
                 position: "absolute",
                 inset: 0,
                 overflow: "hidden",
-                zIndex: 10,
+                zIndex: "var(--io-z-panel)",
               }}
               onMouseDown={(e) => e.stopPropagation()}
               onMouseMove={(e) => e.stopPropagation()}
@@ -8035,7 +8035,7 @@ export default function DesignerCanvas({
                       minWidth: 160,
                       overflow: "hidden",
                       fontSize: 12,
-                      zIndex: 1000,
+                      zIndex: "var(--io-z-canvas-overlay)",
                     }}
                   >
                     <ContextMenuPrimitive.Item
@@ -8219,7 +8219,7 @@ export default function DesignerCanvas({
                 borderRadius: "var(--io-radius)",
                 padding: "3px 10px",
                 fontSize: 11,
-                zIndex: 10,
+                zIndex: "var(--io-z-panel)",
                 boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                 whiteSpace: "nowrap",
               }}
@@ -8299,7 +8299,7 @@ export default function DesignerCanvas({
                 position: "absolute",
                 inset: 0,
                 pointerEvents: "none",
-                zIndex: 15,
+                zIndex: "calc(var(--io-z-panel) + 5)",
                 overflow: "hidden",
               }}
             >
@@ -8374,7 +8374,7 @@ export default function DesignerCanvas({
                     lineHeight: 1.4,
                     padding: 0,
                     margin: 0,
-                    zIndex: 20,
+                    zIndex: "calc(var(--io-z-panel) + 10)",
                     overflow: "hidden",
                     whiteSpace: "pre",
                   }}
@@ -8618,7 +8618,7 @@ export default function DesignerCanvas({
               style={{
                 position: "fixed",
                 inset: 0,
-                zIndex: 1200,
+                zIndex: "var(--io-z-modal)",
                 background: "rgba(0,0,0,0.55)",
                 display: "flex",
                 alignItems: "center",
@@ -8925,7 +8925,7 @@ export default function DesignerCanvas({
                   style={{
                     position: "fixed",
                     inset: 0,
-                    zIndex: 3000,
+                    zIndex: "var(--io-z-emergency)",
                     cursor: "crosshair",
                   }}
                   onMouseMove={(e) => {
@@ -9423,7 +9423,7 @@ export default function DesignerCanvas({
                     position: "fixed",
                     top: slotPopover.screenY,
                     left: slotPopover.screenX,
-                    zIndex: 2000,
+                    zIndex: "var(--io-z-modal)",
                     background: "var(--io-surface-elevated)",
                     border: "1px solid var(--io-border)",
                     borderRadius: "var(--io-radius)",
@@ -9602,7 +9602,7 @@ export default function DesignerCanvas({
             bottom: 16,
             left: "50%",
             transform: "translateX(-50%)",
-            zIndex: 2000,
+            zIndex: "var(--io-z-dropdown)",
             display: "flex",
             alignItems: "center",
             gap: 8,
@@ -9789,7 +9789,7 @@ function RulersOverlay({
           left: RULER_SIZE,
           width: `calc(100% - ${RULER_SIZE}px)`,
           height: RULER_SIZE,
-          zIndex: 10,
+          zIndex: "var(--io-z-panel)",
           cursor: "s-resize",
           pointerEvents: "all",
         }}
@@ -9811,7 +9811,7 @@ function RulersOverlay({
           left: 0,
           width: RULER_SIZE,
           height: `calc(100% - ${RULER_SIZE}px)`,
-          zIndex: 10,
+          zIndex: "var(--io-z-panel)",
           cursor: "e-resize",
           pointerEvents: "all",
         }}
@@ -9834,7 +9834,7 @@ function RulersOverlay({
           width: RULER_SIZE,
           height: RULER_SIZE,
           background: "var(--io-surface-elevated)",
-          zIndex: 11,
+          zIndex: "calc(var(--io-z-panel) + 1)",
           borderRight: "1px solid var(--io-border)",
           borderBottom: "1px solid var(--io-border)",
         }}
@@ -9860,7 +9860,7 @@ function RulersOverlay({
                     ? "rgba(255,160,0,0.5)"
                     : "rgba(0,200,255,0.5)",
                   cursor: g.locked ? "not-allowed" : "ew-resize",
-                  zIndex: 9,
+                  zIndex: "calc(var(--io-z-panel) - 1)",
                   pointerEvents: "all",
                 }
               : {
@@ -9873,7 +9873,7 @@ function RulersOverlay({
                     ? "rgba(255,160,0,0.5)"
                     : "rgba(0,200,255,0.5)",
                   cursor: g.locked ? "not-allowed" : "ns-resize",
-                  zIndex: 9,
+                  zIndex: "calc(var(--io-z-panel) - 1)",
                   pointerEvents: "all",
                 };
 
@@ -9914,7 +9914,7 @@ function RulersOverlay({
             minWidth: 160,
             overflow: "hidden",
             fontSize: 12,
-            zIndex: 1000,
+            zIndex: "var(--io-z-canvas-overlay)",
             padding: "3px 0",
           };
 
@@ -10268,7 +10268,7 @@ function DesignerContextMenuContent({
     minWidth: 180,
     overflow: "hidden",
     fontSize: 12,
-    zIndex: 1000,
+    zIndex: "var(--io-z-canvas-overlay)",
   };
 
   const subContentStyle: React.CSSProperties = {
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/index.css ---
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Prevent native browser text/element drag from hijacking pointer events.
   Without this, clicking SVG text elements and dragging fires dragstart,
   which cancels pointerdown capture and leaves marquee/selection state broken.
   user-select is still honoured inside <input>/<textarea> by browsers. */
body {
  user-select: none;
}

/* ============================================================
   I/O Design System — CSS Custom Properties (138 tokens)
   Defaults: Dark theme. JS (tokens.ts) overrides on load.
   Doc 38 token registry — all 138 tokens defined.
   ============================================================ */

/* ---- Dark theme (default) ---------------------------------- */
:root,
[data-theme="dark"] {
  /* Surface & Layout (5) */
  --io-surface-primary: #09090b;
  --io-surface-secondary: #18181b;
  --io-surface-elevated: #27272a;
  --io-surface-sunken: #09090b;
  --io-surface-overlay: rgba(0, 0, 0, 0.7);
  --io-surface: var(--io-surface-elevated);
  --io-bg: var(--io-surface-primary);
  --io-surface-hover: var(--io-surface-elevated);
  --io-surface-raised: var(--io-surface-elevated);

  /* Text (5) */
  --io-text-primary: #f9fafb;
  --io-text-secondary: #a1a1aa;
  --io-text-muted: #71717a;
  --io-text-inverse: #09090b;
  --io-text-link: var(--io-accent);
  --io-text: var(--io-text-primary);
  --io-text-on-accent: var(--io-accent-foreground);

  /* Accent — Midnight Teal, dark theme uses 400-level (5) */
  --io-accent: #2dd4bf;
  --io-accent-hover: #5eead4;
  --io-accent-active: #99f6e4;
  --io-accent-foreground: #09090b;
  --io-accent-subtle: rgba(45, 212, 191, 0.1);
  /* Keep --io-accent-rgb in sync with --io-accent hex per theme: light=13 148 136, hphmi=20 184 166 */
  --io-accent-rgb: 45 212 191;

  /* Borders & Separators (4) */
  --io-border: #3f3f46;
  --io-border-subtle: #27272a;
  --io-border-strong: #52525b;
  --io-focus-ring: #2dd4bf;

  /* Alarm Priority — ISA-101 / ISA-18.2 (7, NOT customizable) */
  --io-alarm-urgent: #ef4444;
  --io-alarm-high: #f97316;
  --io-alarm-low: #eab308;
  --io-alarm-diagnostic: #f4f4f5;
  --io-alarm-custom: #60a5fa;
  --io-alarm-shelved: #d946ef;

  /* Graphics Display Elements (4) */
  --io-fill-normal: #475569;
  --io-display-zone-inactive: #3f3f46;
  --io-display-zone-normal: #404048;
  --io-display-zone-border: #52525b;

  /* Operational Status (2) */
  --io-alarm-normal: #22c55e;
  --io-alarm-disabled: #52525b;
  --io-alarm-inactive: #808080;

  /* Semantic Status (5 + subtle variants + status-fg) */
  --io-danger: #ef4444;
  --io-success: #22c55e;
  --io-warning: #f59e0b;
  --io-info: #3b82f6;
  --io-text-disabled: #52525b;
  --io-success-subtle: rgba(34, 197, 94, 0.12);
  --io-warning-subtle: rgba(251, 191, 36, 0.15);
  --io-danger-subtle: rgba(239, 68, 68, 0.12);
  --io-status-fg: #ffffff;
  --io-error: var(--io-danger);

  /* Chart & Visualization (5) */
  --io-chart-bg: #18181b;
  --io-chart-grid: #27272a;
  --io-chart-axis: #a1a1aa;
  --io-chart-crosshair: #71717a;
  --io-chart-tooltip-bg: #27272a;

  /* Trend pen colors — 8 pens (static across themes) */
  --io-pen-1: #2563eb;
  --io-pen-2: #dc2626;
  --io-pen-3: #16a34a;
  --io-pen-4: #d97706;
  --io-pen-5: #7c3aed;
  --io-pen-6: #0891b2;
  --io-pen-7: #db2777;
  --io-pen-8: #65a30d;

  /* Layer 4: Button Tokens (6) */
  --io-btn-bg: var(--io-accent);
  --io-btn-hover: var(--io-accent-hover);
  --io-btn-active: var(--io-accent-active);
  --io-btn-text: var(--io-accent-foreground);
  --io-btn-secondary-bg: var(--io-surface-secondary);
  --io-btn-secondary-border: var(--io-border);

  /* Layer 4: Sidebar Tokens (5) */
  --io-sidebar-bg: var(--io-surface-secondary);
  --io-sidebar-width: 220px;
  --io-sidebar-collapsed: 48px;
  --io-sidebar-active-border: var(--io-accent);
  --io-sidebar-hover-bg: var(--io-accent-subtle);

  /* Layer 4: Top Bar Tokens (3) */
  --io-topbar-bg: var(--io-surface-primary);
  --io-topbar-height: 48px;
  --io-topbar-border: var(--io-border-subtle);

  /* Layer 4: Card Tokens (4) */
  --io-card-bg: var(--io-surface-secondary);
  --io-card-border: var(--io-border);
  --io-card-radius: var(--io-radius);
  --io-card-shadow: var(--io-shadow-sm);

  /* Layer 4: Table Tokens (6) */
  --io-table-row-compact: 28px;
  --io-table-row-default: 36px;
  --io-table-row-comfortable: 44px;
  --io-table-header-bg: var(--io-surface-sunken);
  --io-table-row-hover: var(--io-accent-subtle);
  --io-table-row-selected: var(--io-accent-subtle);

  /* Layer 4: Input Tokens (5) */
  --io-input-bg: var(--io-surface-sunken);
  --io-input-border: var(--io-border);
  --io-input-focus-border: var(--io-accent);
  --io-input-placeholder: var(--io-text-muted);
  --io-input-height: 36px;

  /* Layer 4: Modal/Dialog Tokens (3) */
  --io-modal-bg: var(--io-surface-elevated);
  --io-modal-backdrop: var(--io-surface-overlay);
  --io-modal-radius: var(--io-radius-lg);
  --io-overlay: var(--io-modal-backdrop);

  /* Layer 4: Toast/Notification Tokens (3) */
  --io-toast-bg: var(--io-surface-elevated);
  --io-toast-border: var(--io-border);
  --io-toast-shadow: var(--io-shadow-lg);

  /* Spacing (17) */
  --io-space-0: 0px;
  --io-space-1: 4px;
  --io-space-2: 8px;
  --io-space-3: 12px;
  --io-space-4: 16px;
  --io-space-5: 20px;
  --io-space-6: 24px;
  --io-space-8: 32px;
  --io-space-10: 40px;
  --io-space-12: 48px;
  --io-space-14: 56px;
  --io-space-16: 64px;
  --io-space-20: 80px;
  --io-space-24: 96px;
  --io-space-32: 128px;
  --io-space-40: 160px;
  --io-space-48: 192px;

  /* Border Radius (4) — Subtle preset (6px) */
  --io-radius-sm: 3px;
  --io-radius: 6px;
  --io-radius-lg: 9px;
  --io-radius-full: 9999px;

  /* Shadow (4) */
  --io-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --io-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3);
  --io-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5), 0 4px 6px rgba(0, 0, 0, 0.3);
  --io-shadow-none: none;

  /* Typography (16) */
  --io-text-4xl: 2.25rem;
  --io-text-3xl: 1.75rem;
  --io-text-2xl: 1.375rem;
  --io-text-xl: 1.125rem;
  --io-text-lg: 1rem;
  --io-text-base: 0.875rem;
  --io-text-sm: 0.8125rem;
  --io-text-xs: 0.75rem;
  --io-text-2xs: 0.6875rem;
  --io-text-label: 0.75rem;
  --io-text-label-sm: 0.6875rem;
  --io-text-value: 0.875rem;
  --io-text-value-lg: 1.125rem;
  --io-text-value-xl: 1.5rem;
  --io-text-code: 0.8125rem;
  --io-text-code-sm: 0.75rem;

  /* Z-Index (14) */
  --io-z-base: 0;
  --io-z-panel: 10;
  --io-z-sidebar: 100;
  --io-z-topbar: 100;
  --io-z-edge-hover: 150;
  --io-z-dropdown: 500;
  --io-z-canvas-overlay: 600;
  --io-z-modal: 1000;
  --io-z-priority-modal: 1050;
  --io-z-command: 1200;
  --io-z-visual-lock: 1500;
  --io-z-kiosk-auth: 1800;
  --io-z-toast: 2000;
  --io-z-emergency: 3000;

  /* Duration (3) */
  --io-duration-fast: 150ms;
  --io-duration-medium: 250ms;
  --io-duration-slow: 350ms;

  /* Typography — font stacks (static, all themes) */
  --io-font-mono:
    "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Courier New",
    monospace;
  --io-font-sans:
    "InterVariable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, "Helvetica Neue", sans-serif;
}

/* ---- Light theme ------------------------------------------- */
[data-theme="light"] {
  /* Surface & Layout */
  --io-surface-primary: #ffffff;
  --io-surface-secondary: #f9fafb;
  --io-surface-elevated: #ffffff;
  --io-surface-sunken: #f3f4f6;
  --io-surface-overlay: rgba(0, 0, 0, 0.5);
  --io-surface: var(--io-surface-elevated);
  --io-bg: var(--io-surface-primary);
  --io-surface-hover: var(--io-surface-elevated);
  --io-surface-raised: var(--io-surface-elevated);

  /* Text */
  --io-text-primary: #111827;
  --io-text-secondary: #6b7280;
  --io-text-muted: #9ca3af;
  --io-text-inverse: #ffffff;
  --io-text-link: var(--io-accent);
  --io-text: var(--io-text-primary);
  --io-text-on-accent: var(--io-accent-foreground);

  /* Accent — Midnight Teal, light theme uses 600-level */
  --io-accent: #0d9488;
  --io-accent-hover: #0f766e;
  --io-accent-active: #115e59;
  --io-accent-foreground: #ffffff;
  --io-accent-subtle: rgba(13, 148, 136, 0.08);
  --io-accent-rgb: 13 148 136;

  /* Borders */
  --io-border: #e5e7eb;
  --io-border-subtle: #f3f4f6;
  --io-border-strong: #d1d5db;
  --io-focus-ring: #14b8a6;

  /* Alarm Priority — ISA-101 (lighter for light bg) */
  --io-alarm-urgent: #dc2626;
  --io-alarm-high: #d97706;
  --io-alarm-low: #ca8a04;
  --io-alarm-diagnostic: #0891b2;
  --io-alarm-custom: #6d28d9;
  --io-alarm-shelved: #7c3aed;

  /* Graphics Display Elements */
  --io-fill-normal: rgba(148, 163, 184, 0.3);
  --io-display-zone-inactive: #e5e7eb;
  --io-display-zone-normal: #d1d5db;
  --io-display-zone-border: #d1d5db;

  /* Operational Status */
  --io-alarm-normal: #16a34a;
  --io-alarm-disabled: #9ca3af;
  --io-alarm-inactive: #808080;

  /* Semantic Status */
  --io-danger: #dc2626;
  --io-success: #16a34a;
  --io-warning: #d97706;
  --io-info: #2563eb;
  --io-text-disabled: #d1d5db;
  --io-success-subtle: rgba(22, 163, 74, 0.1);
  --io-warning-subtle: rgba(217, 119, 6, 0.1);
  --io-danger-subtle: rgba(220, 38, 38, 0.1);
  --io-status-fg: #ffffff;
  --io-error: var(--io-danger);

  /* Chart & Visualization */
  --io-chart-bg: #ffffff;
  --io-chart-grid: #f5f6f8;
  --io-chart-axis: #6b7280;
  --io-chart-crosshair: #9ca3af;
  --io-chart-tooltip-bg: #ffffff;

  /* Trend pen colors (static across themes) */
  --io-pen-1: #2563eb;
  --io-pen-2: #dc2626;
  --io-pen-3: #16a34a;
  --io-pen-4: #d97706;
  --io-pen-5: #7c3aed;
  --io-pen-6: #0891b2;
  --io-pen-7: #db2777;
  --io-pen-8: #65a30d;

  /* Layer 4: Button Tokens */
  --io-btn-bg: var(--io-accent);
  --io-btn-hover: var(--io-accent-hover);
  --io-btn-active: var(--io-accent-active);
  --io-btn-text: var(--io-accent-foreground);
  --io-btn-secondary-bg: var(--io-surface-secondary);
  --io-btn-secondary-border: var(--io-border);

  /* Layer 4: Sidebar Tokens */
  --io-sidebar-bg: var(--io-surface-secondary);
  --io-sidebar-width: 220px;
  --io-sidebar-collapsed: 48px;
  --io-sidebar-active-border: var(--io-accent);
  --io-sidebar-hover-bg: var(--io-accent-subtle);

  /* Layer 4: Top Bar Tokens */
  --io-topbar-bg: var(--io-surface-primary);
  --io-topbar-height: 48px;
  --io-topbar-border: var(--io-border-subtle);

  /* Layer 4: Card Tokens */
  --io-card-bg: var(--io-surface-secondary);
  --io-card-border: var(--io-border);
  --io-card-radius: var(--io-radius);
  --io-card-shadow: var(--io-shadow-sm);

  /* Layer 4: Table Tokens */
  --io-table-row-compact: 28px;
  --io-table-row-default: 36px;
  --io-table-row-comfortable: 44px;
  --io-table-header-bg: var(--io-surface-sunken);
  --io-table-row-hover: var(--io-accent-subtle);
  --io-table-row-selected: var(--io-accent-subtle);

  /* Layer 4: Input Tokens */
  --io-input-bg: var(--io-surface-sunken);
  --io-input-border: var(--io-border);
  --io-input-focus-border: var(--io-accent);
  --io-input-placeholder: var(--io-text-muted);
  --io-input-height: 36px;

  /* Layer 4: Modal/Dialog Tokens */
  --io-modal-bg: var(--io-surface-elevated);
  --io-modal-backdrop: var(--io-surface-overlay);
  --io-modal-radius: var(--io-radius-lg);
  --io-overlay: var(--io-modal-backdrop);

  /* Layer 4: Toast/Notification Tokens */
  --io-toast-bg: var(--io-surface-elevated);
  --io-toast-border: var(--io-border);
  --io-toast-shadow: var(--io-shadow-lg);

  /* Spacing */
  --io-space-0: 0px;
  --io-space-1: 4px;
  --io-space-2: 8px;
  --io-space-3: 12px;
  --io-space-4: 16px;
  --io-space-5: 20px;
  --io-space-6: 24px;
  --io-space-8: 32px;
  --io-space-10: 40px;
  --io-space-12: 48px;
  --io-space-14: 56px;
  --io-space-16: 64px;
  --io-space-20: 80px;
  --io-space-24: 96px;
  --io-space-32: 128px;
  --io-space-40: 160px;
  --io-space-48: 192px;

  /* Border Radius */
  --io-radius-sm: 3px;
  --io-radius: 6px;
  --io-radius-lg: 9px;
  --io-radius-full: 9999px;

  /* Shadow */
  --io-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --io-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  --io-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
  --io-shadow-none: none;

  /* Typography (same values across themes) */
  --io-text-4xl: 2.25rem;
  --io-text-3xl: 1.75rem;
  --io-text-2xl: 1.375rem;
  --io-text-xl: 1.125rem;
  --io-text-lg: 1rem;
  --io-text-base: 0.875rem;
  --io-text-sm: 0.8125rem;
  --io-text-xs: 0.75rem;
  --io-text-2xs: 0.6875rem;
  --io-text-label: 0.75rem;
  --io-text-label-sm: 0.6875rem;
  --io-text-value: 0.875rem;
  --io-text-value-lg: 1.125rem;
  --io-text-value-xl: 1.5rem;
  --io-text-code: 0.8125rem;
  --io-text-code-sm: 0.75rem;

  /* Z-Index (same across themes) */
  --io-z-base: 0;
  --io-z-panel: 10;
  --io-z-sidebar: 100;
  --io-z-topbar: 100;
  --io-z-edge-hover: 150;
  --io-z-dropdown: 500;
  --io-z-canvas-overlay: 600;
  --io-z-modal: 1000;
  --io-z-priority-modal: 1050;
  --io-z-command: 1200;
  --io-z-visual-lock: 1500;
  --io-z-kiosk-auth: 1800;
  --io-z-toast: 2000;
  --io-z-emergency: 3000;

  /* Duration (same across themes) */
  --io-duration-fast: 150ms;
  --io-duration-medium: 250ms;
  --io-duration-slow: 350ms;
}

/* ---- HPHMI theme (dark blue-gray, ISA-101) ----------------- */
[data-theme="hphmi"] {
  /* Surface & Layout */
  --io-surface-primary: #0f172a;
  --io-surface-secondary: #1e293b;
  --io-surface-elevated: #334155;
  --io-surface-sunken: #0c1525;
  --io-surface-overlay: rgba(0, 0, 0, 0.7);
  --io-surface: var(--io-surface-elevated);
  --io-bg: var(--io-surface-primary);
  --io-surface-hover: var(--io-surface-elevated);
  --io-surface-raised: var(--io-surface-elevated);

  /* Text */
  --io-text-primary: #e2e8f0;
  --io-text-secondary: #94a3b8;
  --io-text-muted: #64748b;
  --io-text-inverse: #0f172a;
  --io-text-link: var(--io-accent);
  --io-text: var(--io-text-primary);
  --io-text-on-accent: var(--io-accent-foreground);

  /* Accent — Midnight Teal, HPHMI uses 500-level */
  --io-accent: #14b8a6;
  --io-accent-hover: #2dd4bf;
  --io-accent-active: #5eead4;
  --io-accent-foreground: #0f172a;
  --io-accent-subtle: rgba(45, 212, 191, 0.08);
  --io-accent-rgb: 20 184 166;

  /* Borders */
  --io-border: #475569;
  --io-border-subtle: #2d3f53;
  --io-border-strong: #64748b;
  --io-focus-ring: #14b8a6;

  /* Alarm Priority — ISA-101 */
  --io-alarm-urgent: #ef4444;
  --io-alarm-high: #f59e0b;
  --io-alarm-low: #eab308;
  --io-alarm-diagnostic: #06b6d4;
  --io-alarm-custom: #7c3aed;
  --io-alarm-shelved: #a78bfa;

  /* Graphics Display Elements */
  --io-fill-normal: rgba(71, 85, 105, 0.5);
  --io-display-zone-inactive: #3f3f46;
  --io-display-zone-normal: #404048;
  --io-display-zone-border: #52525b;

  /* Operational Status */
  --io-alarm-normal: #22c55e;
  --io-alarm-disabled: #64748b;
  --io-alarm-inactive: #808080;

  /* Semantic Status */
  --io-danger: #ef4444;
  --io-success: #22c55e;
  --io-warning: #f59e0b;
  --io-info: #3b82f6;
  --io-text-disabled: #475569;
  --io-success-subtle: rgba(34, 197, 94, 0.12);
  --io-warning-subtle: rgba(245, 158, 11, 0.15);
  --io-danger-subtle: rgba(239, 68, 68, 0.12);
  --io-status-fg: #ffffff;
  --io-error: var(--io-danger);

  /* Chart & Visualization */
  --io-chart-bg: #1e293b;
  --io-chart-grid: #3d5166;
  --io-chart-axis: #94a3b8;
  --io-chart-crosshair: #64748b;
  --io-chart-tooltip-bg: #1e293b;

  /* Trend pen colors (static) */
  --io-pen-1: #2563eb;
  --io-pen-2: #dc2626;
  --io-pen-3: #16a34a;
  --io-pen-4: #d97706;
  --io-pen-5: #7c3aed;
  --io-pen-6: #0891b2;
  --io-pen-7: #db2777;
  --io-pen-8: #65a30d;

  /* Layer 4: Button Tokens */
  --io-btn-bg: var(--io-accent);
  --io-btn-hover: var(--io-accent-hover);
  --io-btn-active: var(--io-accent-active);
  --io-btn-text: var(--io-accent-foreground);
  --io-btn-secondary-bg: var(--io-surface-secondary);
  --io-btn-secondary-border: var(--io-border);

  /* Layer 4: Sidebar Tokens */
  --io-sidebar-bg: var(--io-surface-secondary);
  --io-sidebar-width: 220px;
  --io-sidebar-collapsed: 48px;
  --io-sidebar-active-border: var(--io-accent);
  --io-sidebar-hover-bg: var(--io-accent-subtle);

  /* Layer 4: Top Bar Tokens */
  --io-topbar-bg: var(--io-surface-primary);
  --io-topbar-height: 48px;
  --io-topbar-border: var(--io-border-subtle);

  /* Layer 4: Card Tokens */
  --io-card-bg: var(--io-surface-secondary);
  --io-card-border: var(--io-border);
  --io-card-radius: var(--io-radius);
  --io-card-shadow: var(--io-shadow-sm);

  /* Layer 4: Table Tokens */
  --io-table-row-compact: 28px;
  --io-table-row-default: 36px;
  --io-table-row-comfortable: 44px;
  --io-table-header-bg: var(--io-surface-sunken);
  --io-table-row-hover: var(--io-accent-subtle);
  --io-table-row-selected: var(--io-accent-subtle);

  /* Layer 4: Input Tokens */
  --io-input-bg: var(--io-surface-sunken);
  --io-input-border: var(--io-border);
  --io-input-focus-border: var(--io-accent);
  --io-input-placeholder: var(--io-text-muted);
  --io-input-height: 36px;

  /* Layer 4: Modal/Dialog Tokens */
  --io-modal-bg: var(--io-surface-elevated);
  --io-modal-backdrop: var(--io-surface-overlay);
  --io-modal-radius: var(--io-radius-lg);
  --io-overlay: var(--io-modal-backdrop);

  /* Layer 4: Toast/Notification Tokens */
  --io-toast-bg: var(--io-surface-elevated);
  --io-toast-border: var(--io-border);
  --io-toast-shadow: var(--io-shadow-lg);

  /* Spacing */
  --io-space-0: 0px;
  --io-space-1: 4px;
  --io-space-2: 8px;
  --io-space-3: 12px;
  --io-space-4: 16px;
  --io-space-5: 20px;
  --io-space-6: 24px;
  --io-space-8: 32px;
  --io-space-10: 40px;
  --io-space-12: 48px;
  --io-space-14: 56px;
  --io-space-16: 64px;
  --io-space-20: 80px;
  --io-space-24: 96px;
  --io-space-32: 128px;
  --io-space-40: 160px;
  --io-space-48: 192px;

  /* Border Radius */
  --io-radius-sm: 3px;
  --io-radius: 6px;
  --io-radius-lg: 9px;
  --io-radius-full: 9999px;

  /* Shadow */
  --io-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --io-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3);
  --io-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5), 0 4px 6px rgba(0, 0, 0, 0.3);
  --io-shadow-none: none;

  /* Typography */
  --io-text-4xl: 2.25rem;
  --io-text-3xl: 1.75rem;
  --io-text-2xl: 1.375rem;
  --io-text-xl: 1.125rem;
  --io-text-lg: 1rem;
  --io-text-base: 0.875rem;
  --io-text-sm: 0.8125rem;
  --io-text-xs: 0.75rem;
  --io-text-2xs: 0.6875rem;
  --io-text-label: 0.75rem;
  --io-text-label-sm: 0.6875rem;
  --io-text-value: 0.875rem;
  --io-text-value-lg: 1.125rem;
  --io-text-value-xl: 1.5rem;
  --io-text-code: 0.8125rem;
  --io-text-code-sm: 0.75rem;

  /* Z-Index */
  --io-z-base: 0;
  --io-z-panel: 10;
  --io-z-sidebar: 100;
  --io-z-topbar: 100;
  --io-z-edge-hover: 150;
  --io-z-dropdown: 500;
  --io-z-canvas-overlay: 600;
  --io-z-modal: 1000;
  --io-z-priority-modal: 1050;
  --io-z-command: 1200;
  --io-z-visual-lock: 1500;
  --io-z-kiosk-auth: 1800;
  --io-z-toast: 2000;
  --io-z-emergency: 3000;

  /* Duration */
  --io-duration-fast: 150ms;
  --io-duration-medium: 250ms;
  --io-duration-slow: 350ms;
}

/* ============================================================
   Alarm State CSS Classes (doc 38 / doc 35)
   Applied to display elements, not theme-dependent.
   ============================================================ */

/* Skeleton loading pulse */
@keyframes io-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

/* Skeleton shimmer — module-shaped loading states */
@keyframes io-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.io-skeleton {
  background: linear-gradient(
    90deg,
    var(--io-surface-secondary) 25%,
    var(--io-surface-elevated) 50%,
    var(--io-surface-secondary) 75%
  );
  background-size: 200% 100%;
  animation: io-shimmer 1.5s linear infinite;
}

/* Unacknowledged — 1Hz flash between alarm color and gray */
@keyframes io-alarm-flash {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0.25;
  }
}

.io-unack {
  animation: io-alarm-flash 1s step-end infinite;
}
.io-ack {
  /* Steady alarm color — no animation */
}
.io-rtn-unack {
  opacity: 0.6;
}
.io-shelved {
  border-style: dashed !important;
  opacity: 0.7;
}
.io-suppressed {
  opacity: 0.4;
}
.io-oos-display {
  text-decoration: line-through;
  opacity: 0.5;
}

/* Data Quality CSS Classes */
.io-quality-stale {
  outline: 1px dashed var(--io-border-strong);
  opacity: 0.6;
}
.io-quality-bad {
  outline: 1px dashed var(--io-alarm-urgent);
}
.io-quality-comm-fail {
  outline: 1px solid var(--io-alarm-disabled);
  opacity: 0.7;
}
.io-quality-uncertain {
  outline: 1px dotted var(--io-border-strong);
}
.io-quality-manual {
  outline: 1px solid var(--io-alarm-diagnostic);
}

/* ============================================================
   Context Menu Animations
   ============================================================ */

@keyframes io-context-menu-in {
  from {
    opacity: 0;
    transform: scale(0.97) translateY(-3px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes io-dropdown-in {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ============================================================
   Base resets
   ============================================================ */

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  margin: 0;
  background: var(--io-surface-primary);
  color: var(--io-text-primary);
  font-family:
    "InterVariable",
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    "Helvetica Neue",
    sans-serif;
  font-size: var(--io-text-base, 0.875rem);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Monospace for code/data contexts */
code,
pre,
kbd,
.io-mono {
  font-family:
    "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Courier New",
    monospace;
  font-size: var(--io-text-code, 0.8125rem);
}

/* Tabular numbers for data values — prevents layout jitter */
.io-tabular {
  font-variant-numeric: tabular-nums;
}

/* ============================================================
   Scrollbar styling
   ============================================================ */

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--io-border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--io-text-muted);
}

/* ============================================================
   Focus ring
   ============================================================ */

:focus-visible {
  outline: 2px solid var(--io-focus-ring, var(--io-accent));
  outline-offset: 2px;
}

/* ============================================================
   Text selection
   ============================================================ */

::selection {
  background: var(--io-accent-subtle);
  color: var(--io-text-primary);
}

/* ============================================================
   Mobile touch targets — gloved operation (doc 20 §Touch Targets)
   60px minimum for standard controls; 72px for critical actions.
   Applies only on coarse-pointer (touch) devices.
   ============================================================ */

@media (pointer: coarse) {
  /* Standard interactive elements — 60px minimum */
  button,
  [role="button"],
  a,
  input[type="checkbox"],
  input[type="radio"],
  select,
  .io-tab,
  .io-nav-item,
  .io-list-item {
    min-height: 60px;
    min-width: 60px;
  }

  /* Icon-only buttons expand their hit area via padding */
  button.io-icon-btn {
    min-height: 60px;
    min-width: 60px;
    padding: 12px;
  }

  /* Critical actions (alarm ack, emergency, submit) — 72px minimum */
  .io-critical-action,
  button[data-critical="true"],
  [role="button"][data-critical="true"] {
    min-height: 72px;
    min-width: 72px;
  }

  /* Form inputs — taller tap zone */
  input[type="text"],
  input[type="number"],
  input[type="email"],
  input[type="password"],
  textarea {
    min-height: 60px;
  }
}

/* ============================================================
   Print stylesheet — color normalization (doc 06)
   ============================================================ */

@media print {
  :root {
    --io-surface-primary: #ffffff;
    --io-surface-secondary: #f9fafb;
    --io-surface-elevated: #ffffff;
    --io-surface: #ffffff;
    --io-text-primary: #111827;
    --io-text-secondary: #374151;
    --io-text-muted: #6b7280;
    --io-border: #d1d5db;
    /* Alarm colors preserved (semantic meaning must survive print) */
  }

  body {
    background: #ffffff;
    color: #111827;
  }

  /* Hide navigation chrome */
  .io-sidebar,
  .io-topbar,
  .io-toolbar,
  [role="navigation"] {
    display: none !important;
  }
}

/* Canonical Mode A (view) node selection glow — docs/decisions/selection-behavior.md */
[data-node-id].io-node-selected {
  filter: drop-shadow(
      0 0 3px color-mix(in srgb, var(--io-accent) 80%, transparent)
    )
    drop-shadow(0 0 6px color-mix(in srgb, var(--io-accent) 40%, transparent));
}

/* Designer Mode B multi-select: glow on actual shape geometry, not an overlay rect */
svg.io-multiselect-active [data-node-id].io-selected {
  filter: drop-shadow(
      0 0 3px color-mix(in srgb, var(--io-accent) 80%, transparent)
    )
    drop-shadow(0 0 6px color-mix(in srgb, var(--io-accent) 40%, transparent));
}

--- File: /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx ---
/**
 * DesignerCanvas.tsx
 *
 * The main SVG canvas for the Designer module.
 * Renders the scene graph as React SVG elements.
 * Handles mouse interaction for select, draw, pan, and pipe tools.
 * Writes selection to uiStore so DesignerRightPanel can reactively subscribe.
 *
 * IMPORTANT: This replaces the older SVG.js-based implementation.
 * All mutations go through SceneCommands + historyStore.
 */

import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useState,
  useMemo,
  lazy,
  Suspense,
} from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import {
  useSceneStore,
  useUiStore,
  useHistoryStore,
  useLibraryStore,
  useTabStore,
  snapToGridValue,
} from "../../store/designer";
import type { SmartGuide } from "../../store/designer/uiStore";
import type { NodeId } from "../../shared/types/graphics";
import type {
  SceneNode,
  SceneNodeType,
  GraphicDocument,
  GraphicExpression,
  Primitive,
  Pipe,
  TextBlock,
  SymbolInstance,
  DisplayElement,
  ImageNode,
  Group,
  EmbeddedSvgNode,
  Stencil,
  Annotation,
  Transform,
  WidgetNode,
  PointBinding,
  DisplayElementType,
  DisplayElementConfig,
  FillGaugeConfig,
  AnalogBarConfig,
  TextReadoutConfig,
  TextReadoutArrayConfig,
  PointNameLabelConfig,
} from "../../shared/types/graphics";
import {
  AddNodeCommand,
  DeleteNodesCommand,
  DuplicateNodesCommand,
  GroupNodesCommand,
  UngroupCommand,
  MoveNodesCommand,
  PasteNodesCommand,
  ReorderNodeCommand,
  RotateNodesCommand,
  FlipNodesCommand,
  ResizePrimitiveCommand,
  ResizeNodeCommand,
  ResizeNodeWithDimsCommand,
  ChangeShapeVariantCommand,
  ChangeShapeConfigurationCommand,
  AddDisplayElementCommand,
  ChangeBindingCommand,
  ChangePropertyCommand,
  CompoundCommand,
  SnapSidecarToSlotCommand,
  HideDisplayElementCommand,
  ResetDisplayElementCommand,
  ReorderSidecarCommand,
  RemoveDisplayElementCommand,
} from "../../shared/graphics/commands";
import type { SceneCommand } from "../../shared/graphics/commands";
import { PIPE_SERVICE_COLORS } from "../../shared/types/graphics";
import { routePipe } from "../../shared/graphics/pipeRouter";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../../shared/hooks/usePermission";
import { SaveAsStencilDialog } from "./components/SaveAsStencilDialog";
import { PromoteToShapeWizard } from "./components/PromoteToShapeWizard";
import PointPickerModal from "./components/PointPickerModal";
import {
  ShapeDropDialog,
  type PlacedShapeConfig,
  displayConfigToUserConfig,
  userConfigToDisplayConfig,
} from "./components/ShapeDropDialog";
import { CategoryShapeWizard } from "./components/CategoryShapeWizard";
import {
  resolveNamedSlot,
  resolveSlotWithSidecar,
  isInsideFillSidecar,
  resolveShapeAnchorSlots,
} from "../../shared/graphics/anchorSlots";
import {
  applyDeSlotOffset,
  resolveSidecarCollisions,
  resolveSingleSidecarAgainstFixed,
  DE_TO_SIDECAR_KEY,
  EXCLUDED_COLLISION_SLOTS,
  type SidecarInput,
  type DeLayoutHints,
} from "../../shared/graphics/sidecarCollision";
import {
  computeSnapTarget,
  type SlotTarget,
} from "../../shared/graphics/useSnapToSlot";
import { useThemeName } from "../../shared/theme/ThemeContext";
import { SceneRenderer } from "../../shared/graphics/SceneRenderer";
import {
  buildTransform as sharedBuildTransform,
  getNodeRotationPivot as sharedGetNodeRotationPivot,
  buildExteriorSidecarTransform,
} from "../../shared/graphics/nodeTransforms";
import {
  renderPrimitiveSvg,
  renderTextBlockSvg,
  renderAnnotationSvg,
  renderImageSvg,
  renderEmbeddedSvgSvg,
  renderStencilSvg,
  renderWidgetPlaceholderSvg,
  renderPipeSvg,
  renderDisplayElementSvg,
  renderGroupSvg,
  renderSymbolInstanceSvg,
  formatDesignPlaceholder,
  deFontToCss,
  type RenderContext,
  type StencilRenderContext,
  type PipeRenderContext,
  type DisplayElementRenderContext,
  type SymbolInstanceRenderContext,
  type GroupRenderContext,
} from "../../shared/graphics/renderNodeSvg";
import { useSelectionZone } from "../../store/useSelectionZone";
import {
  usePasteTarget,
  useIOClipboardStore,
  usePasteEngine,
  findTargetForZone,
  type PasteMode,
} from "../../shared/clipboard";
import { useGlobalSelectionStore } from "../../store/globalSelectionStore";
import { createDesignerPasteTarget } from "./clipboard/designerPasteTarget";
import { copyDesignerSelection } from "./clipboard/designerCopyHandler";
import type { ChartTypeId } from "../../shared/components/charts/chart-config-types";
import { makeDefaultChartConfig } from "../../shared/components/charts/chart-defaults";
import type { ChartConfig } from "../../shared/components/charts/chart-config-types";
const ChartConfigPanel = lazy(
  () => import("../../shared/components/charts/ChartConfigPanel"),
);
import { CHART_DEFINITIONS } from "../../shared/components/charts/chart-definitions";
import ChartRenderer from "../../shared/components/charts/ChartRenderer";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerCanvasProps {
  className?: string;
  style?: React.CSSProperties;
  onPropertiesOpen?: () => void;
  /** Called when the user selects "Open in Tab" on a group node. */
  onOpenGroupInTab?: (groupNodeId: NodeId, groupName: string) => void;
  /**
   * When non-null, the canvas is in "group sub-tab" mode.
   * Only the children of this group node are rendered.
   */
  groupSubTabNodeId?: NodeId | null;
}

// ---------------------------------------------------------------------------
// Resize handle positions (8-point: 4 corners + 4 edge midpoints)
// ---------------------------------------------------------------------------

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const RESIZE_HANDLES: Array<{
  id: ResizeHandle;
  cx: number;
  cy: number;
  cursor: string;
}> = [
  { id: "nw", cx: 0, cy: 0, cursor: "nw-resize" },
  { id: "n", cx: 0.5, cy: 0, cursor: "n-resize" },
  { id: "ne", cx: 1, cy: 0, cursor: "ne-resize" },
  { id: "e", cx: 1, cy: 0.5, cursor: "e-resize" },
  { id: "se", cx: 1, cy: 1, cursor: "se-resize" },
  { id: "s", cx: 0.5, cy: 1, cursor: "s-resize" },
  { id: "sw", cx: 0, cy: 1, cursor: "sw-resize" },
  { id: "w", cx: 0, cy: 0.5, cursor: "w-resize" },
];

// Natural world angle (degrees, 0=right clockwise) from element center to each
// handle at 0° rotation. Used by cursor functions to pick the correct axis.
const HANDLE_ANGLES: Record<ResizeHandle, number> = {
  n: 270,
  ne: 315,
  e: 0,
  se: 45,
  s: 90,
  sw: 135,
  w: 180,
  nw: 225,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RULER_SIZE = 16; // px — thickness of ruler strips (also used by RulersOverlay)

// ---------------------------------------------------------------------------
// Ramer-Douglas-Peucker path simplification for freehand draw
// ---------------------------------------------------------------------------

function ptLineDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdpSimplify(
  pts: Array<{ x: number; y: number }>,
  eps: number,
): Array<{ x: number; y: number }> {
  if (pts.length <= 2) return pts;
  let maxD = 0,
    maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = ptLineDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) {
      maxD = d;
      maxI = i;
    }
  }
  if (maxD > eps) {
    const l = rdpSimplify(pts.slice(0, maxI + 1), eps);
    const r = rdpSimplify(pts.slice(maxI), eps);
    return [...l.slice(0, -1), ...r];
  }
  return [pts[0], pts[pts.length - 1]];
}

// ---------------------------------------------------------------------------
// Selection state — written to uiStore; selectedIdsRef is a synchronous cache
// kept in sync with the store so callbacks can read without triggering renders.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Group naming helpers
// ---------------------------------------------------------------------------

/** Returns "Group N" where N is one higher than the max existing "Group N" name */
function nextGroupName(doc: GraphicDocument): string {
  let max = 0;
  function scan(nodes: SceneNode[]) {
    for (const n of nodes) {
      const m = n.name?.match(/^Group (\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1]));
      if ("children" in n && Array.isArray(n.children)) {
        scan(n.children as SceneNode[]);
      }
    }
  }
  scan(doc.children);
  return `Group ${max + 1}`;
}

// ---------------------------------------------------------------------------
// NameGroupPrompt — small native <dialog> for naming/renaming groups
// ---------------------------------------------------------------------------

interface NameGroupPromptProps {
  defaultName: string;
  title?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function NameGroupPrompt({
  defaultName,
  title = "Name Group",
  onConfirm,
  onCancel,
}: NameGroupPromptProps) {
  const [value, setValue] = React.useState(defaultName);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  function handleConfirm() {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  }

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: "var(--io-z-modal)",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const dialogStyle: React.CSSProperties = {
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    padding: "20px",
    minWidth: 280,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
  const titleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--io-text-primary)",
    margin: 0,
  };
  const inputStyleLocal: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    background: "var(--io-surface-sunken)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    color: "var(--io-text-primary)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };
  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
  };
  const btnBase: React.CSSProperties = {
    padding: "5px 14px",
    fontSize: 12,
    cursor: "pointer",
    borderRadius: "var(--io-radius)",
    border: "1px solid var(--io-border)",
    background: "transparent",
    color: "var(--io-text-secondary)",
  };
  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: "var(--io-accent)",
    color: "#09090b",
    border: "none",
    fontWeight: 600,
  };

  return (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={dialogStyle} onMouseDown={(e) => e.stopPropagation()}>
        <p style={titleStyle}>{title}</p>
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyleLocal}
          placeholder="Group name"
        />
        <div style={rowStyle}>
          <button style={btnBase} onClick={onCancel}>
            Cancel
          </button>
          <button
            style={btnPrimary}
            onClick={handleConfirm}
            disabled={!value.trim()}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node bounding box (canvas coordinates)
// ---------------------------------------------------------------------------

export function getNodeBounds(node: SceneNode): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const { x, y } = node.transform.position;
  if (node.type === "primitive") {
    const p = node as Primitive;
    if (p.geometry.type === "rect")
      return { x, y, w: p.geometry.width, h: p.geometry.height };
    if (p.geometry.type === "ellipse")
      return {
        x: x - p.geometry.rx,
        y: y - p.geometry.ry,
        w: p.geometry.rx * 2,
        h: p.geometry.ry * 2,
      };
    if (p.geometry.type === "line") {
      const minX = Math.min(p.geometry.x1, p.geometry.x2);
      const minY = Math.min(p.geometry.y1, p.geometry.y2);
      return {
        x: x + minX,
        y: y + minY,
        w: Math.abs(p.geometry.x2 - p.geometry.x1) || 4,
        h: Math.abs(p.geometry.y2 - p.geometry.y1) || 4,
      };
    }
  }
  if (node.type === "text_block") {
    const tb = node as TextBlock;
    // Ensure minimum hit target size (40x20) for reliable right-click detection on small text
    const minW = 40,
      minH = 20;
    const w = Math.max(tb.maxWidth ?? 120, minW);
    const h = Math.max(tb.fontSize ? tb.fontSize * 2 : 20, minH);
    return { x, y, w, h };
  }
  if (node.type === "image") {
    const img = node as ImageNode;
    return { x, y, w: img.displayWidth, h: img.displayHeight };
  }
  if (node.type === "pipe") {
    const pipe = node as Pipe;
    if (pipe.waypoints && pipe.waypoints.length >= 2) {
      const xs = pipe.waypoints.map((p) => p.x);
      const ys = pipe.waypoints.map((p) => p.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs) || 4,
        h: Math.max(...ys) - Math.min(...ys) || 4,
      };
    }
  }
  if (node.type === "widget") {
    const wn = node as WidgetNode;
    return { x, y, w: wn.width, h: wn.height };
  }
  if (node.type === "embedded_svg") {
    const esn = node as EmbeddedSvgNode;
    return { x, y, w: esn.width || 64, h: esn.height || 64 };
  }
  if (node.type === "symbol_instance") {
    const si = node as SymbolInstance;
    const shapeData = useLibraryStore.getState().getShape(si.shapeRef.shapeId);
    const geo = shapeData?.sidecar.geometry;
    const naturalW = geo?.baseSize?.[0] ?? geo?.width ?? 64;
    const naturalH = geo?.baseSize?.[1] ?? geo?.height ?? 64;
    return {
      x,
      y,
      w: naturalW * (si.transform.scale.x ?? 1),
      h: naturalH * (si.transform.scale.y ?? 1),
    };
  }
  if (node.type === "stencil") {
    const st = node as Stencil;
    return { x, y, w: st.size?.width ?? 48, h: st.size?.height ?? 24 };
  }
  if (node.type === "display_element") {
    const de = node as DisplayElement;
    const cfg = de.config;
    switch (cfg.displayType) {
      case "text_readout": {
        const tCfg = cfg as TextReadoutConfig;
        const pnEnabled = tCfg.pointNameRow?.enabled ?? false;
        const dnEnabled = tCfg.displayNameRow?.enabled ?? false;
        const numRows = (pnEnabled ? 1 : 0) + (dnEnabled ? 1 : 0) + 1;
        const ROW_H = 16,
          GAP = 2;
        const boxW = tCfg.minWidth ?? 40;
        return { x, y, w: boxW, h: numRows * ROW_H + (numRows - 1) * GAP };
      }
      case "analog_bar":
        // Design preview: bar body is 18px wide. Zone labels (HH/H/L/LL) sit at
        // x=-3 textAnchor=end and extend ~15px to the left of the DE origin.
        // The pointer triangle extends 7px to the right of the bar (to x=25).
        // Bounds must cover this full visual range: -15 to +25 = 40px wide.
        return { x: x - 15, y, w: 40, h: cfg.barHeight ?? 80 };
      case "fill_gauge":
        return { x, y, w: cfg.barWidth ?? 24, h: cfg.barHeight ?? 80 };
      case "sparkline":
        return { x, y, w: cfg.sparkWidth ?? 110, h: cfg.sparkHeight ?? 18 };
      case "alarm_indicator":
        // Design preview: 24×18 rect centered at origin (x: -12..12, y: -9..9).
        return { x: x - 12, y: y - 9, w: 24, h: 18 };
      case "digital_status": {
        // Design preview width tracks content: "AUTO" (bound) → 36px, "—" → 18px.
        const stateText = de.binding.pointId ? "AUTO" : "—";
        return { x, y, w: stateText.length * 6 + 12, h: 20 };
      }
      case "text_readout_array": {
        const aCfg = cfg as TextReadoutArrayConfig;
        const n = Math.max(1, 1 + (aCfg.additionalBindings?.length ?? 0));
        const gap = aCfg.itemSpacing ?? 2;
        const layout = aCfg.arrayLayout ?? "vertical";
        const singleLine = aCfg.singleLine ?? false;
        const pnEnabled = aCfg.pointNameRow?.enabled ?? false;
        const dnEnabled = aCfg.displayNameRow?.enabled ?? false;
        const itemRows = singleLine
          ? 1
          : 1 + (pnEnabled ? 1 : 0) + (dnEnabled ? 1 : 0);
        const ROW_H = 16,
          ROW_GAP = 2;
        const itemH = itemRows * ROW_H + (itemRows - 1) * ROW_GAP;
        const itemW = aCfg.minWidth ?? 40;
        if (layout === "vertical") {
          return { x, y, w: itemW, h: n * itemH + (n - 1) * gap };
        } else {
          return { x, y, w: n * itemW + (n - 1) * gap, h: itemH };
        }
      }
      case "point_name_label": {
        const fs = (cfg as PointNameLabelConfig).fontSize ?? 10;
        return { x, y, w: 80, h: fs + 2 };
      }
      default:
        return { x, y, w: 80, h: 24 };
    }
  }
  if (node.type === "annotation") {
    const an = node as import("../../shared/types/graphics").Annotation;
    // Ensure minimum hit target size (32x32) for reliable right-click detection
    const minSize = 32;
    const w = Math.max(an.width || minSize, minSize);
    const h = Math.max(an.height || minSize, minSize);
    return { x, y, w, h };
  }
  if (node.type === "group") {
    const grp = node as Group;
    if (!grp.children || grp.children.length === 0) {
      return { x, y, w: 64, h: 64 };
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const child of grp.children) {
      const cb = getNodeBounds(child);
      if (cb.x < minX) minX = cb.x;
      if (cb.y < minY) minY = cb.y;
      if (cb.x + cb.w > maxX) maxX = cb.x + cb.w;
      if (cb.y + cb.h > maxY) maxY = cb.y + cb.h;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  // Default generous bbox for stencils, etc.
  return { x, y, w: 64, h: 64 };
}

// Returns the rotation pivot in "post-scale local" space for center-pivot rotation.
// Delegates to shared nodeTransforms utility, providing libraryStore shape lookup.
function designerShapeSizeLookup(
  shapeId: string,
): { w: number; h: number } | null {
  const shapeData = useLibraryStore.getState().getShape(shapeId);
  if (!shapeData) return null;
  const geo = shapeData.sidecar.geometry;
  const w = geo?.baseSize?.[0] ?? geo?.width ?? 64;
  const h = geo?.baseSize?.[1] ?? geo?.height ?? 64;
  return { w, h };
}

function getNodeRotationPivot(node: SceneNode): { x: number; y: number } {
  return sharedGetNodeRotationPivot(node, designerShapeSizeLookup);
}

function computeGroupBBox(nodes: SceneNode[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    const b = getNodeBounds(n);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  if (minX === Infinity) return { x: 0, y: 0, w: 64, h: 64 };
  return {
    x: minX,
    y: minY,
    w: Math.max(maxX - minX, 4),
    h: Math.max(maxY - minY, 4),
  };
}

function boundsContains(
  b: { x: number; y: number; w: number; h: number },
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  return b.x >= rx && b.y >= ry && b.x + b.w <= rx + rw && b.y + b.h <= ry + rh;
}

// ---------------------------------------------------------------------------
// Find the parent node of a given node ID in the scene tree
// ---------------------------------------------------------------------------

function getNodeParent(nodeId: NodeId, nodes: SceneNode[]): SceneNode | null {
  for (const n of nodes) {
    if ("children" in n && Array.isArray(n.children)) {
      const children = n.children as SceneNode[];
      if (children.some((c) => c.id === nodeId)) return n;
      const found = getNodeParent(nodeId, children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Like getNodeBounds but adds the parent symbol_instance's position for
 * display_element children (whose transform.position is parent-relative).
 * All other nodes return the same result as getNodeBounds.
 */
function getNodeAbsoluteBounds(
  node: SceneNode,
  docChildren: SceneNode[],
): { x: number; y: number; w: number; h: number } {
  const b = getNodeBounds(node);
  if (node.type === "display_element") {
    const parent = getNodeParent(node.id, docChildren);
    if (parent?.type === "symbol_instance") {
      const pp = parent.transform.position;
      const sx = parent.transform.scale?.x ?? 1;
      const sy = parent.transform.scale?.y ?? 1;
      return {
        x: b.x * sx + pp.x,
        y: b.y * sy + pp.y,
        w: b.w * sx,
        h: b.h * sy,
      };
    }
  }
  return b;
}

/**
 * Like getNodeAbsoluteBounds but uses the sidecar's selectionBounds (if defined)
 * for symbol_instance nodes. This gives a tighter visual rect that hugs the
 * shape body rather than the full viewBox, which can include large padding for
 * process equipment (reactors, tanks, etc.).
 *
 * Does NOT affect resize handles or hit-testing — those use getNodeBounds /
 * getNodeAbsoluteBounds as before.
 */
function getNodeVisualBounds(
  node: SceneNode,
  docChildren: SceneNode[],
): { x: number; y: number; w: number; h: number } {
  if (node.type === "symbol_instance") {
    const si = node as SymbolInstance;
    const shapeData = useLibraryStore.getState().getShape(si.shapeRef.shapeId);
    const sel = shapeData?.sidecar.geometry?.selectionBounds;
    if (sel) {
      const { x, y } = si.transform.position;
      const sx = si.transform.scale.x ?? 1;
      const sy = si.transform.scale.y ?? 1;
      return {
        x: x + sel.x * sx,
        y: y + sel.y * sy,
        w: sel.w * sx,
        h: sel.h * sy,
      };
    }
  }
  return getNodeAbsoluteBounds(node, docChildren);
}

// ---------------------------------------------------------------------------
// Test mode: pause/play state lives in uiStore; overlay is SceneRenderer
// (see DesignerCanvas render — the SceneRenderer overlay block)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SVG transform string builder — delegates to shared nodeTransforms utility
// ---------------------------------------------------------------------------

const buildTransform = sharedBuildTransform;

// ---------------------------------------------------------------------------
// Primitive geometry → SVG element
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DisplayElement renderer — static (design) and live (test mode)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TextReadoutDE — text_readout display element with real SVG text measurement.
// Uses useLayoutEffect + getComputedTextLength() so box width is always exact
// regardless of EU string length, font, or font size.
// ---------------------------------------------------------------------------
function TextReadoutDE({
  de,
  tx,
  valueStr,
  euStr,
  mode,
  stale = false,
  onContextMenu,
}: {
  de: DisplayElement;
  tx: string;
  valueStr: string; // formatted value or "—" placeholder
  euStr: string; // EU unit WITHOUT leading space, or ""
  mode: "design" | "live";
  stale?: boolean;
  onContextMenu?: (e: React.MouseEvent<SVGGElement>) => void;
}) {
  const cfg = de.config as TextReadoutConfig;
  const minW = cfg.minWidth ?? 40;
  const [boxW, setBoxW] = useState(minW);
  const textRef = useRef<SVGTextElement>(null);

  const ROW_H = 16;
  const GAP = 2;
  const pnEnabled = cfg.pointNameRow?.enabled ?? false;
  const dnEnabled = cfg.displayNameRow?.enabled ?? false;
  const euEnabled = !!euStr;
  const labelRows = (pnEnabled ? 1 : 0) + (dnEnabled ? 1 : 0);
  const totalH = labelRows * (ROW_H + GAP) + ROW_H;

  // Size the box on the value+EU text only — label rows (point name, display name)
  // are centered in the same width and may overflow, matching console/graphics behavior.
  // getComputedTextLength() is exact for mixed-font tspans (JetBrains Mono value + Inter EU).
  const measure = useCallback(() => {
    let maxW = minW;
    const PAD = 12; // 6px each side
    if (textRef.current)
      maxW = Math.max(
        maxW,
        Math.ceil(textRef.current.getComputedTextLength()) + PAD,
      );
    setBoxW(maxW);
  }, [minW]);

  // Re-measure whenever value or EU changes.
  useLayoutEffect(() => {
    measure();
  }, [measure, valueStr, euStr]);

  // Re-measure once fonts finish loading — first render may use fallback metrics
  // if the web font (JetBrains Mono) hasn't been fetched yet.
  useEffect(() => {
    document.fonts.ready.then(() => measure());
  }, [measure]);

  // applyDeSlotOffset bakes x -= 20 (half of 40px assumed box) into position.x
  // for horizontal slots. Compensate with the actual measured width.
  const hOff = Math.round(-boxW / 2);

  const isLive = mode === "live";
  const vR = cfg.valueRow;
  const vFs = vR?.fontSize ?? 11;
  const textFill = stale ? "#6b7280" : vR?.color || "var(--io-text-primary)";
  const euFill = stale ? "#6b7280" : "var(--io-text-muted)";
  const boxFill = isLive ? "rgba(0,0,0,0.6)" : "#27272A";
  const boxStroke = isLive
    ? stale
      ? "#6b7280"
      : "var(--io-accent)"
    : "#3F3F46";
  const strokeW = isLive ? 0.5 : 1;

  const rows: React.ReactNode[] = [];
  let yOff = 0;

  if (pnEnabled) {
    const r = cfg.pointNameRow!;
    if (r.showBackground) {
      rows.push(
        <rect
          key="pn-bg"
          x={0}
          y={yOff}
          width={boxW}
          height={ROW_H}
          fill={isLive ? "rgba(0,0,0,0.5)" : "#1E293B"}
          rx={1}
        />,
      );
    }
    rows.push(
      <text
        key="pn-tx"
        x={boxW / 2}
        y={yOff + ROW_H - 4}
        textAnchor="middle"
        fontSize={r.fontSize}
        fontWeight={r.fontWeight ?? "normal"}
        fill={stale ? "#6b7280" : r.color || "var(--io-text-primary)"}
        fontFamily={deFontToCss(r.fontFamily)}
      >
        {de.binding.pointTag ?? (isLive ? "—" : "TAG.NAME")}
      </text>,
    );
    yOff += ROW_H + GAP;
  }

  if (dnEnabled) {
    const r = cfg.displayNameRow!;
    if (r.showBackground) {
      rows.push(
        <rect
          key="dn-bg"
          x={0}
          y={yOff}
          width={boxW}
          height={ROW_H}
          fill={isLive ? "rgba(0,0,0,0.5)" : "#1E293B"}
          rx={1}
        />,
      );
    }
    rows.push(
      <text
        key="dn-tx"
        x={boxW / 2}
        y={yOff + ROW_H - 4}
        textAnchor="middle"
        fontSize={r.fontSize}
        fontWeight={r.fontWeight ?? "normal"}
        fill={stale ? "#6b7280" : r.color || "var(--io-text-secondary)"}
        fontFamily={deFontToCss(r.fontFamily)}
      >
        {de.binding.displayName ?? (isLive ? "—" : "Display Name")}
      </text>,
    );
    yOff += ROW_H + GAP;
  }

  if (cfg.showBox !== false) {
    rows.push(
      <rect
        key="v-bg"
        x={0}
        y={yOff}
        width={boxW}
        height={ROW_H}
        fill={boxFill}
        stroke={boxStroke}
        strokeWidth={strokeW}
        rx={1}
      />,
    );
  }

  // The ref is on the value text so getComputedTextLength() measures value+EU together.
  rows.push(
    <text
      key="v-tx"
      ref={textRef}
      x={boxW / 2}
      y={yOff + ROW_H - 4}
      textAnchor="middle"
      fontSize={vFs}
      fontWeight={vR?.fontWeight ?? "normal"}
      fill={textFill}
      fontFamily={deFontToCss(vR?.fontFamily)}
      fontVariant="tabular-nums"
    >
      {valueStr}
      {euEnabled && (
        <tspan fontFamily="Inter" fontSize={9} fill={euFill}>
          {" "}
          {euStr}
        </tspan>
      )}
    </text>,
  );

  // Outer <g> carries the counter-rotation transform (data-node-id lets the
  // rotation drag handler update just this attribute without touching the inner
  // centering translate). Inner <g> holds the fixed hOff centering shift so
  // it is never overwritten by direct DOM mutations during rotation preview.
  return (
    <g
      transform={tx}
      data-node-id={de.id}
      data-canvas-x={String(Math.round(de.transform.position.x))}
      data-canvas-y={String(Math.round(de.transform.position.y))}
      opacity={de.opacity}
      onContextMenu={onContextMenu}
    >
      <g transform={`translate(${hOff},0)`}>
        <rect x={0} y={0} width={boxW} height={totalH} rx={2} fill="none" />
        {rows}
      </g>
    </g>
  );
}

function DisplayE

--- File: /home/io/io-dev/io/ui-audit/11-zindex-assessment.md ---
# Z-Index Assessment — DesignerCanvas Token Remap

**Date:** 2026-05-28  
**Status:** COMPLETE — all 19 remaps applied 2026-05-28. Two new tokens added to permanent scale.  
**Sources:** `ui-audit/00-preflight-facts.md §2`, `frontend/src/index.css:207–218`

---

## Permanent Token Scale (reference)

| Token | Value | Added |
|-------|-------|-------|
| `--io-z-base` | 0 | original |
| `--io-z-panel` | 10 | original |
| `--io-z-sidebar` | 100 | original |
| `--io-z-topbar` | 100 | original |
| `--io-z-edge-hover` | 150 | original |
| `--io-z-dropdown` | 500 | original |
| `--io-z-canvas-overlay` | 600 | **2026-05-28** — canvas-internal badge/tooltip overlays; above dropdowns, below modals |
| `--io-z-modal` | 1000 | original |
| `--io-z-priority-modal` | 1050 | **2026-05-28** — app-level confirmation dialogs (ConfirmDialog); guaranteed above canvas dialogs at --io-z-modal |
| `--io-z-command` | 1200 | original |
| `--io-z-visual-lock` | 1500 | original |
| `--io-z-kiosk-auth` | 1800 | original |
| `--io-z-toast` | 2000 | original |
| `--io-z-emergency` | 3000 | original |

---

## Part One — Tier Classification

### Tier A: Base canvas chrome (10 elements)

Elements that only need to stack correctly within the canvas's own stacking context. Their z-values compete only against each other inside the canvas div hierarchy, not globally. All are below 100.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 7689 | -1 | SVG guide/grid line | Intentionally below canvas surface; background grid that must not interfere with any canvas element |
| 7994 | 10 | Canvas container overlay div | Base layer of canvas chrome; the lowest overlay inside the canvas |
| 8222 | 10 | Element tooltip | Inline hover tooltip on canvas elements; canvas-internal, small, transient |
| 8302 | 15 | Selection highlight overlay | Thin inset overlay drawn on selected elements; above element but below editing chrome |
| 8377 | 20 | Inline text editor | In-place text edit overlay; must be above selection highlight during editing |
| 9792 | 10 | Ruler bar (top) | Canvas chrome — ruler drawn at top edge |
| 9814 | 10 | Ruler bar (left) | Canvas chrome — ruler drawn at left edge |
| 9837 | 11 | Ruler corner tile | Sits just above the two ruler bars at their intersection; covers seam |
| 9863 | 9 | Vertical guide drag handle | Guide handle must be draggable; sits just below rulers so rulers draw on top |
| 9876 | 9 | Horizontal guide drag handle | Same — just below rulers |

These ten elements establish the relative stacking order: guides (9) < canvas content (10) ≈ rulers (10) < corner (11) < selection (15) < text editor (20). This ordering is internally consistent and must be preserved.

---

### Tier B: Canvas-spawned badge/overlay elements (3 elements)

Three elements at exactly z=1000 — the same value as `--io-z-modal` / ConfirmDialog. All are described as "canvas-internal overlay/badge" or "tooltip/inline overlay" with `fontSize:12, overflow:hidden`. These are small annotation or data overlays pinned to canvas elements. They are NOT dialog-level UI. Their presence at 1000 is the direct cause of the ConfirmDialog stacking tie.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 8038 | 1000 | Canvas-internal overlay/badge | Small badge annotation on a canvas element; canvas-internal, non-blocking |
| 9917 | 1000 | Tooltip/inline overlay | Same pattern — canvas data annotation overlay |
| 10271 | 1000 | Tooltip/inline overlay | Same pattern — canvas data annotation overlay |

These are semantically sub-modal. They are annotations that float above the canvas but should never compete with app-level confirmation dialogs. ConfirmDialog must always win against these.

---

### Tier C: Canvas-spawned dialogs and popovers (5 elements)

Elements that are `position:fixed` or floating above canvas content with dialog/popover semantics. These are the canvas's own "modal layer" — UI that the canvas spawns to handle configuration, assignment, or status display.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 8621 | 1200 | Fixed full-screen dialog backdrop | Canvas-spawned blocking dialog; position:fixed, rgba(0,0,0,0.55) scrim |
| 332 | 2000 | Fixed full-screen modal backdrop | A second canvas-spawned blocking modal, higher priority than 8621 — appears on top of it |
| 9426 | 2000 | Slot assignment popover | Non-scrim floating popover for slot assignment; elevated surface background |
| 9605 | 2000 | Canvas bottom status/toolbar overlay | Persistent floating HUD at canvas bottom; centered via transform:translateX(-50%) |

**Note on the two fixed backdrops (332 and 8621):** These are two separate canvas-spawned dialogs. The ordering (8621 at 1200, 332 at 2000) implies 332's dialog sits on top of 8621's dialog when both render — a layered dialog pattern. By design, only one is visible at a time. Their exact z-ordering relative to each other is an internal canvas concern.

**Note on 9605 (canvas toolbar HUD):** Though it uses z=2000 (matching the toast layer), it is persistent canvas chrome — not a toast or dialog. Its high value ensures it renders above canvas elements and any canvas badge overlays. Semantically it belongs closer to the dropdown layer (floating UI above content, not above modals).

---

### Tier D: Full-screen capture overlays (2 elements)

Elements that intentionally take over the entire screen for a capture interaction. Must appear above everything else including canvas dialogs.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 8928 | 3000 | Point picker full-screen overlay | Full-screen crosshair mode for selecting a data point; must be above all canvas UI |
| 3750 | 9999 | Drag-cursor overlay | Transient drag tracking cursor; `pointer-events:none`; must be above all UI including emergency overlays |

---

## Part Two — Proposed Token Mapping

### Tier A: Base canvas chrome → `--io-z-panel` and calc offsets

All Tier A elements preserve their exact integer values; they merely adopt tokens. The calc offsets maintain the same stacking order.

| Line | Current | Proposed | Computed value | Preserves order? |
|------|---------|---------|---------------|-----------------|
| 7689 | -1 | `calc(var(--io-z-base) - 1)` | -1 | Yes |
| 7994 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 8222 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 8302 | 15 | `calc(var(--io-z-panel) + 5)` | 15 | Yes |
| 8377 | 20 | `calc(var(--io-z-panel) + 10)` | 20 | Yes |
| 9792 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 9814 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 9837 | 11 | `calc(var(--io-z-panel) + 1)` | 11 | Yes |
| 9863 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | Yes |
| 9876 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | Yes |

### Tier B: Canvas badge/overlay → `--io-z-dropdown` (500)

These three elements at 1000 must move below `--io-z-modal` to resolve the ConfirmDialog ties. `--io-z-dropdown` (500) is the correct tier: above canvas chrome (sub-20), above app sidebars/topbars (100), but clearly below any modal dialog.

**Key question:** should these sit at `--io-z-dropdown` (500) or closer to modal (e.g., 999)?

Recommendation: `var(--io-z-dropdown)` = 500. Using 500 creates unambiguous separation from the modal layer. Using a calc like `calc(var(--io-z-modal) - 1)` = 999 would maintain proximity to the modal layer with no semantic justification — these are badge overlays, not near-modal UI. The full 500-point gap makes intent legible.

**See Scale Gap #1** — the scale has no named token between dropdown (500) and modal (1000) for canvas-internal floating content. These elements would be the first users of such a token if one were added.

| Line | Current | Proposed | Computed value |
|------|---------|---------|---------------|
| 8038 | 1000 | `var(--io-z-dropdown)` | 500 |
| 9917 | 1000 | `var(--io-z-dropdown)` | 500 |
| 10271 | 1000 | `var(--io-z-dropdown)` | 500 |

### Tier C: Canvas dialogs and popovers

This tier contains the most complex decisions because two canvas "dialogs" are currently above ConfirmDialog, and moving them to `--io-z-modal` creates ties that depend on DOM order.

**Core principle:** Canvas-spawned dialogs are functionally equivalent to app modals. They should use `--io-z-modal` (1000). ConfirmDialog also uses `--io-z-modal` (1000). If ConfirmDialog renders via `createPortal` to `document.body`, it is appended later in the DOM than canvas dialogs and wins the tie. This is fragile but workable — see **Scale Gap #3** for the clean fix.

| Line | Current | Proposed | Computed value | Notes |
|------|---------|---------|---------------|-------|
| 8621 | 1200 | `var(--io-z-modal)` | 1000 | Fixed dialog backdrop. Currently at `--io-z-command` level (accidental match). Moves down 200. |
| 332 | 2000 | `var(--io-z-modal)` | 1000 | Fixed modal backdrop (higher-priority canvas dialog). Moves down 1000. Both canvas dialogs now share the modal layer. |
| 9426 | 2000 | `var(--io-z-modal)` | 1000 | Slot assignment popover. Moves down 1000. Popover should be modal-level (it overlays canvas interaction). |
| 9605 | 2000 | `var(--io-z-dropdown)` | 500 | Canvas bottom toolbar HUD. This is persistent chrome, not a dialog — belongs at dropdown level. Dialogs (1000) will correctly obscure it when open. |

**On the two canvas backdrops (332 and 8621) sharing z=1000 after remap:** These two dialogs should never be simultaneously visible by design (one is shown at a time). Their internal ordering (which one the user sees "on top") can be managed by DOM order if they ever overlap. If the canvas always unmounts one before mounting the other, z-ordering between them is moot.

### Tier D: Capture overlays

| Line | Current | Proposed | Computed value | Notes |
|------|---------|---------|---------------|-------|
| 8928 | 3000 | `var(--io-z-emergency)` | 3000 | No numeric change. Point picker legitimately uses the emergency layer — it is a full-screen mode capture. |
| 3750 | 9999 | **Scale gap — see Scale Gap #2** | 9999 | Drag cursor exceeds the scale ceiling. See below. |

---

## Part Three — Scale Gaps Flagged for Decision

### Gap #1: No named token for canvas-internal floating overlays

**Situation:** The three Tier B elements (badge/tooltip overlays at lines 8038, 9917, 10271) need to sit above canvas chrome (sub-20) and app topbars/sidebars (100) but below modal dialogs (1000). The nearest available tokens are `--io-z-dropdown` (500) and `--io-z-modal` (1000).

**Problem:** `--io-z-dropdown` is semantically for UI dropdowns (autocomplete menus, select lists, comboboxes). Canvas annotation badges are a distinct category. Using `var(--io-z-dropdown)` works numerically but conflates canvas chrome with interactive dropdowns.

**Decision needed:** Should a named `--io-z-canvas-overlay` token (e.g., 600) be added to the permanent scale, or is using `--io-z-dropdown` acceptable? A new token affects the eight-module rebuild — all modules would inherit it and potentially need to verify nothing breaks.

**Proposed token if added:** `--io-z-canvas-overlay: 600` — sits above dropdowns (500) and below modals (1000), clearly named for canvas-internal floating content.

---

### Gap #2: No token for above-emergency drag cursors (9999)

**Situation:** The drag cursor overlay (line 3750) is at z=9999, which exceeds the scale ceiling of `--io-z-emergency` (3000). The cursor must appear above everything including emergency overlays (`--io-z-emergency` is for kiosk/security-mode lockouts) because it is a transient visual indicator with `pointer-events:none` — it must never be obscured.

**Problem:** Moving the drag cursor to `var(--io-z-emergency)` = 3000 would make it visually tied with emergency overlays. If an emergency overlay ever renders while a drag is in progress, the cursor could be obscured. More importantly, the 9999 value signals "always on top" intent that the current scale cannot express.

**Decision needed:** One of:
1. Add `--io-z-drag-cursor: 9999` as a permanent, documented "always-on-top for `pointer-events:none` drag indicators" position.
2. Accept that `--io-z-emergency` (3000) is "high enough" — a drag operation and an emergency overlay cannot meaningfully overlap, and the visual difference between 3000 and 9999 is zero in practice.
3. Keep the drag cursor as a documented hardcoded exception at 9999 — it is `pointer-events:none` and fully transient; the exception is narrow and safe.

A new token affects all eight modules. Option 3 (documented hardcoded exception) is the lowest-risk path.

---

### Gap #3: No "priority modal" position between --io-z-modal and --io-z-command

**Situation:** ConfirmDialog is at `--io-z-modal` (1000). Canvas-spawned blocking dialogs should also be at `--io-z-modal` after remap. When ConfirmDialog fires while a canvas dialog is open, both are at 1000 and DOM order determines which appears on top. ConfirmDialog wins only if it is appended to the DOM after the canvas dialog — which is true if it uses `createPortal(el, document.body)`, but is an implicit assumption.

**Problem:** Relying on DOM insertion order for modal priority is fragile. If any future refactor changes portal ordering, ConfirmDialog could silently appear behind canvas dialogs.

**Decision needed:** One of:
1. Add `--io-z-priority-modal: 1050` (or similar, between modal and command) for ConfirmDialog and other app-level confirmation overlays that must always win. Canvas dialogs stay at `--io-z-modal` (1000).
2. Accept the DOM-order dependency — verify ConfirmDialog uses `createPortal` and document the invariant.
3. Move ConfirmDialog to `--io-z-command` (1200). `--io-z-command` is named for the command palette, but in practice ConfirmDialog and the command palette should not overlap; numeric reuse is acceptable. Canvas dialogs at `--io-z-modal` (1000) would then always be below ConfirmDialog.

Option 3 (ConfirmDialog at `--io-z-command`) is the cleanest immediate fix if the DOM-order dependency is undesirable.

---

## Part Four — Risk Assessment Per Remap

| Line | Current | Proposed token | Computed | Risk | Why |
|------|---------|---------------|---------|------|-----|
| 7689 | -1 | `calc(var(--io-z-base) - 1)` | -1 | LOW | Value unchanged; canvas-internal only |
| 7994 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 8222 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 8302 | 15 | `calc(var(--io-z-panel) + 5)` | 15 | LOW | Value unchanged; canvas-internal only |
| 8377 | 20 | `calc(var(--io-z-panel) + 10)` | 20 | LOW | Value unchanged; canvas-internal only |
| 9792 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 9814 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 9837 | 11 | `calc(var(--io-z-panel) + 1)` | 11 | LOW | Value unchanged; canvas-internal only |
| 9863 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | Value unchanged; canvas-internal only |
| 9876 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | Value unchanged; canvas-internal only |
| 8928 | 3000 | `var(--io-z-emergency)` | 3000 | LOW | Value unchanged; point picker already at emergency layer |
| 8038 | 1000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Canvas badge moves from modal layer to dropdown layer. If ConfirmDialog and this badge render simultaneously, ConfirmDialog now wins. This is the desired fix — but the change in stacking is observable and must be spot-checked. |
| 9917 | 1000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Same as 8038. |
| 10271 | 1000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Same as 8038. |
| 9605 | 2000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Canvas toolbar HUD moves from toast layer (2000) to dropdown layer (500). Any dialog (1000) will now visually obscure the toolbar. This is intended behavior (dialogs block the toolbar) but is a visible stacking change that must be verified. |
| 9426 | 2000 | `var(--io-z-modal)` | 1000 | **HIGH** | Slot assignment popover moves from toast layer (2000) to modal layer (1000). If a canvas blocking dialog (332 or 8621 at 1000) is simultaneously rendered, DOM order determines which wins. Verify these never coexist. |
| 332 | 2000 | `var(--io-z-modal)` | 1000 | MEDIUM | Canvas blocking modal backdrop moves from toast layer to modal layer. Currently it renders above ConfirmDialog (2000 > 1000); after remap, ConfirmDialog can render above it via DOM order. This is an intended fix — ConfirmDialog should win — but requires verifying portal ordering. |
| 8621 | 1200 | `var(--io-z-modal)` | 1000 | MEDIUM | Fixed dialog backdrop moves from command layer (1200) to modal layer (1000). This 200-point reduction is only observable if the command palette (also at 1200) and this canvas backdrop coexist — an extremely unlikely scenario. Verify that neither 332 nor 8621 renders simultaneously (they'd share z=1000 after remap). |
| 3750 | 9999 | Scale gap (no remap yet) | 9999 | FLAGGED | Cannot remap without scale decision. Drag cursor exceeds emergency (3000). Interim recommendation: keep at hardcoded 9999 with a comment until Scale Gap #2 is decided. |

---

## Part Five — Summary

### (a) Applied Remap Table

All 19 remaps applied 2026-05-28. Tier B elements use `--io-z-canvas-overlay` (user decision overrides assessment proposal of `--io-z-dropdown`). Line 3750 kept hardcoded with documented-exception comment.

| Line | Element | Was | Applied token | Computed | Risk | Applied |
|------|---------|-----|--------------|---------|------|---------|
| 332 | Fixed modal backdrop | 2000 | `var(--io-z-modal)` | 1000 | MEDIUM | 2026-05-28 |
| 3750 | Drag cursor overlay | 9999 | hardcoded 9999 + exception comment | 9999 | — | 2026-05-28 |
| 7689 | SVG guide/grid line | -1 | `calc(var(--io-z-base) - 1)` | -1 | LOW | 2026-05-28 |
| 7994 | Canvas container overlay | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 8038 | Canvas badge/overlay | 1000 | `var(--io-z-canvas-overlay)` | 600 | **HIGH** | 2026-05-28 |
| 8222 | Element tooltip | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 8302 | Selection highlight | 15 | `calc(var(--io-z-panel) + 5)` | 15 | LOW | 2026-05-28 |
| 8377 | Inline text editor | 20 | `calc(var(--io-z-panel) + 10)` | 20 | LOW | 2026-05-28 |
| 8621 | Fixed dialog backdrop | 1200 | `var(--io-z-modal)` | 1000 | MEDIUM | 2026-05-28 |
| 8928 | Point picker overlay | 3000 | `var(--io-z-emergency)` | 3000 | LOW | 2026-05-28 |
| 9426 | Slot assignment popover | 2000 | `var(--io-z-modal)` | 1000 | **HIGH** | 2026-05-28 |
| 9605 | Canvas bottom toolbar HUD | 2000 | `var(--io-z-dropdown)` | 500 | **HIGH** | 2026-05-28 |
| 9792 | Ruler bar (top) | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 9814 | Ruler bar (left) | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 9837 | Ruler corner tile | 11 | `calc(var(--io-z-panel) + 1)` | 11 | LOW | 2026-05-28 |
| 9863 | Vertical guide drag handle | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | 2026-05-28 |
| 9876 | Horizontal guide drag handle | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | 2026-05-28 |
| 9917 | Tooltip/inline overlay | 1000 | `var(--io-z-canvas-overlay)` | 600 | **HIGH** | 2026-05-28 |
| 10271 | Tooltip/inline overlay | 1000 | `var(--io-z-canvas-overlay)` | 600 | **HIGH** | 2026-05-28 |

### (b) Scale Gaps Requiring User Decision

| # | Gap | Impact | Options |
|---|-----|--------|---------|
| 1 | No token between `--io-z-dropdown` (500) and `--io-z-modal` (1000) for canvas annotation overlays | Tier B elements would use `--io-z-dropdown` (semantic mismatch) or an ad-hoc calc | Add `--io-z-canvas-overlay: 600`; or accept `--io-z-dropdown`; or keep hardcoded 500 with comment |
| 2 | Drag cursor at 9999 exceeds `--io-z-emergency` (3000) scale ceiling | Cannot adopt a token without exceeding the defined scale | Add `--io-z-drag-cursor: 9999`; or document 9999 as an explicit hardcoded exception; or lower to emergency (risk: may conflict if emergency overlay renders during drag) |
| 3 | No "priority modal" layer to guarantee ConfirmDialog beats canvas dialogs when both are at `--io-z-modal` | After remap, ConfirmDialog vs canvas dialog ordering depends on DOM insertion order (portal position) — fragile | Add `--io-z-priority-modal: 1050`; or move ConfirmDialog to `--io-z-command` (1200); or document DOM-order dependency and verify portal ordering |

### (c) Must-change vs. cleanup

**Must change — resolves ConfirmDialog ties:**
- Line 8038 (1000 → 500): canvas badge competing with ConfirmDialog at 1000
- Line 9917 (1000 → 500): same
- Line 10271 (1000 → 500): same

These three are the direct fix for the identified conflict. Moving them to 500 guarantees ConfirmDialog at 1000 always appears above canvas annotation overlays.

**Also required for correct modal layering (canvas dialogs above ConfirmDialog is a bug):**
- Line 332 (2000 → 1000): canvas blocking modal currently above ConfirmDialog
- Line 8621 (1200 → 1000): canvas dialog backdrop currently above ConfirmDialog
- Line 9426 (2000 → 1000): slot popover currently above ConfirmDialog
- Line 9605 (2000 → 500): canvas HUD currently at toast level — not a ConfirmDialog fix but a category correction

**Cleanup — token adoption with no behavior change:**
- Lines 7689, 7994, 8222, 8302, 8377, 9792, 9814, 9837, 9863, 9876: all preserve their exact integer values; remap is notation-only
- Line 8928 (3000 → `var(--io-z-emergency)`): value unchanged, pure token adoption

---

**19 values remapped 2026-05-28. 2 new tokens added to permanent scale (`--io-z-canvas-overlay: 600`, `--io-z-priority-modal: 1050`). ConfirmDialog.tsx NOT touched — its move to `--io-z-priority-modal` is a separate follow-on change.**  
`ui-audit/11-zindex-assessment.md`

---

Produce the review now.
```


## #ASSISTANT

## Summary

The diff matches the prompt intent precisely. All 19 remaps are applied, both new tokens (`--io-z-canvas-overlay: 600`, `--io-z-priority-modal: 1050`) are added consistently across all three theme blocks, line 3750 keeps its hardcoded 9999 with a documented-exception comment, Tier B elements correctly use `var(--io-z-canvas-overlay)` (not `var(--io-z-dropdown)` as the assessment originally proposed), and ConfirmDialog.tsx is untouched. The assessment doc is updated with the complete applied table and token additions dated 2026-05-28. No scope creep is visible.

## Concerns

1. **`as React.CSSProperties` cast applied inconsistently.** Line 7686 (`<line>` SVG element) uses `as React.CSSProperties` to cast the string z-index, correctly, because SVG element `style` props carry a different TypeScript type than HTML element `style` props. However, the same cast is absent on other SVG-context style objects that receive string z-index values — notably line 9914 (inside `RulersOverlay`) and line 10268 (inside `DesignerContextMenuContent`), both of which may be on SVG or nested-SVG elements. If those style objects are on SVG elements rather than HTML elements, the missing cast would be a TypeScript compilation error that `pnpm build` would surface. This is low-risk if those elements are HTML (rendered via portal or absolutely positioned `<div>`), but worth confirming during the type-check pass.

2. **Line 9605 (canvas toolbar HUD): 2000 → `var(--io-z-dropdown)` = 500 is a HIGH-risk behavior change the prompt explicitly flagged for spot-check, but no verification was performed.** The toolbar HUD is persistent canvas chrome at the bottom. Any open dialog at `--io-z-modal` (1000) will now visually cover it. This is the stated intent, but the work unit log contains no browser test or Playwright verification for this change. The assessment itself notes this is observable. It needs a visual spot-check before the diff can be considered verified.

3. **Line 8621 moves from 1200 → `var(--io-z-modal)` = 1000, and line 332 moves from 2000 → `var(--io-z-modal)` = 1000.** Both canvas backdrops now share z=1000 with `--io-z-modal`. The prompt and assessment reason that these two dialogs are never simultaneously rendered by design, but this is an implicit invariant — not enforced by the code. No comment or guard was added to document this assumption. If that invariant is ever violated, the two backdrops at the same z-level would stack in DOM order rather than by priority, which is a silent failure mode.

## Verification Notes

- Token placement in index.css is correct: `--io-z-canvas-overlay: 600` sits between `--io-z-dropdown: 500` and `--io-z-modal: 1000`; `--io-z-priority-modal: 1050` sits between `--io-z-modal: 1000` and `--io-z-command: 1200`. All three theme blocks (dark `:root`, light, hphmi) receive both tokens.
- The dark-theme Z-Index comment count was correctly updated from `(12)` to `(14)`. Light and HPHMI blocks do not carry a count in their comments, so no update was needed there.
- `--io-z-priority-modal` has no consumers in this diff — that is correct per the prompt, which explicitly deferred the ConfirmDialog.tsx one-line change to a follow-on commit.
- The `as React.CSSProperties` cast at line 7686 is the only one in the diff and is appropriate for the SVG `<line>` element context. All other string z-index assignments are on standard HTML element style objects where `React.CSSProperties` accepts `string | number` natively.
- Post-edit verification via grep confirmed no remaining hardcoded z-index values in DesignerCanvas.tsx except the intentional `9999`.


## #TURN_END

_2026-05-28T07:02:11+00:00_

---


## #PROMPT

_2026-05-28T07:02:23+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
!${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/run-review.sh "$(cat ${CLAUDE_PROJECT_DIR}/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #BASH
_Read current log path_

```bash
cat /home/io/io-dev/io/.claude/state/current_log.txt
```


## #BASH
_Run deep review with correct project dir_

```bash
CLAUDE_PROJECT_DIR=/home/io/io-dev/io && /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #TURN_END

_2026-05-28T07:02:24+00:00_

---


## #PROMPT

_2026-05-28T07:06:11+00:00_

```
Any of those worth resolving before moving on?
```


## #TURN_END

_2026-05-28T07:06:11+00:00_

---


## #PROMPT

_2026-05-28T07:07:36+00:00_

```
Okay fix 1
```


## #BASH
_Run TypeScript type check on frontend_

```bash
cd /home/io/io-dev/io/frontend && pnpm tsc --noEmit 2>&1 | head -60
```


## #TURN_END

_2026-05-28T07:07:36+00:00_

---


## #PROMPT

_2026-05-28T07:10:01+00:00_

```
You are performing a SHALLOW verification review of a Claude Code work unit.

Your job is to compare what was asked (the initial prompt) against what was
actually built (the diff).

Be skeptical and direct. Look for:
- The diff does something different from what was asked
- The diff regresses previously working behavior
- The diff expands scope beyond the prompt
- The diff appears to invert architectural decisions

Output format (markdown):

## Summary
One paragraph: does the diff appear to match intent, or are there concerns?

## Concerns
If concerns exist, list them as numbered items. If none: "No concerns identified."

DO NOT include preamble. Start directly with "## Summary".
DO NOT speculate beyond what's in the log and diff.

WORK UNIT LOG:
---
# Work Unit Log: workstream-4-5b-zindex-fix

read-ui-audi

Started: 2026-05-28T06:48:32+00:00
Session: 4f217d94-c8c4-4f86-a176-ee0326c01bc9

---


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (199→260 chars)

_2026-05-28T06:51:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (215→276 chars)

_2026-05-28T06:51:57+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (194→255 chars)

_2026-05-28T06:52:02+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (135→150 chars)

_2026-05-28T06:52:07+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (103→268 chars)

_2026-05-28T06:52:14+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (67→93 chars)

_2026-05-28T06:52:19+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (277→294 chars)

_2026-05-28T06:52:23+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (303→327 chars)

_2026-05-28T06:52:32+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (292→309 chars)

_2026-05-28T06:52:37+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (206→233 chars)

_2026-05-28T06:52:43+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (246→274 chars)

_2026-05-28T06:52:48+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (178→193 chars)

_2026-05-28T06:52:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (191→210 chars)

_2026-05-28T06:52:56+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (254→269 chars)

_2026-05-28T06:53:01+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (234→252 chars)

_2026-05-28T06:53:17+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (208→225 chars)

_2026-05-28T06:53:22+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (208→225 chars)

_2026-05-28T06:53:33+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (258→285 chars)

_2026-05-28T06:53:38+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (134→162 chars)

_2026-05-28T06:53:42+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (134→162 chars)

_2026-05-28T06:53:47+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (206→230 chars)

_2026-05-28T06:53:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (128→152 chars)

_2026-05-28T06:53:57+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (204→256 chars)

_2026-05-28T06:54:22+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (403→824 chars)

_2026-05-28T06:54:31+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (1637→2123 chars)

_2026-05-28T06:54:55+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (140→272 chars)

_2026-05-28T06:55:00+00:00_


## #PROMPT

_2026-05-28T06:55:13+00:00_

```
~initprompt~ workstream-4.5b-zindex-fix

Read ui-audit/11-zindex-assessment.md and index.css. The user has made these decisions:

Scope: FULL REMAP. Apply all 19 remaps in the assessment's Part Five table — both the behavior-changing moves and the zero-risk token-adoption swaps — so DesignerCanvas fully uses the permanent z-index scale.

Scale gap #1 (canvas annotation overlays): ADD a new token --io-z-canvas-overlay: 600 to the permanent scale in index.css, in all three themes. Use it for the three Tier B elements (lines 8038, 9917, 10271) INSTEAD of --io-z-dropdown. This corrects the semantic mismatch the assessment flagged and gives canvas-pane modules in the future rebuild a correct named token.

Scale gap #2 (drag cursor at 9999): DO NOT add a token and DO NOT remap to a token. Leave line 3750 at hardcoded 9999, but add a code comment documenting it as an intentional exception: an always-on-top, pointer-events:none transient drag indicator that must sit above all UI including emergency overlays, deliberately exempt from the token scale.

Scale gap #3 (ConfirmDialog vs canvas dialogs): ADD a new token --io-z-priority-modal: 1050 to the permanent scale in index.css, in all three themes, positioned between --io-z-modal (1000) and --io-z-command (1200). In THIS prompt, move the canvas-spawned dialogs (lines 332, 8621, 9426) to --io-z-modal (1000) as the assessment specifies. Do NOT modify ConfirmDialog.tsx in this prompt — that shared component's move to --io-z-priority-modal is a separate one-line change handled immediately after, to keep the canvas diff clean. Just define the token now so it exists.

Apply the remap:

1. Add the two new tokens (--io-z-canvas-overlay: 600 and --io-z-priority-modal: 1050) to index.css in all three theme blocks (dark, light, hphmi). Confirm placement is consistent with the existing --io-z-* scale ordering.

2. For each of the 19 DesignerCanvas z-index values in the assessment's Part Five table, apply the proposed token, with these adjustments to the assessment's proposals: the three Tier B elements (8038, 9917, 10271) use var(--io-z-canvas-overlay) not var(--io-z-dropdown); line 3750 stays hardcoded 9999 with the documented-exception comment. All others use the token the assessment specified.

3. For each change, state the line, the element, the old value, and the new token reference. Use calc() offsets exactly as the assessment specified for the Tier A elements so their integer values are preserved.

4. The assessment flagged 5 HIGH and 2 MEDIUM risk behavior-changing remaps (lines 8038, 9917, 10271, 9426, 9605 high; 332, 8621 medium). For each of these seven, note it explicitly in your output as needing a spot-check, because it changes observable stacking.

Constraints: stay in DesignerCanvas.tsx and index.css only. Do not touch ConfirmDialog.tsx or any other component in this prompt. Do not change any z-index value's computed result except the seven intended behavior-changing moves. Do not refactor surrounding canvas code.

Update ui-audit/11-zindex-assessment.md by marking each remap applied with the date, and note the two new tokens added to the scale.

When done print: the two new tokens added (with all-theme values), the 19 remaps applied (old value to new token), the seven behavior-changing ones flagged for spot-check, and confirmation that ConfirmDialog.tsx was NOT touched. Stop.
```


## #ASSISTANT

Reading the assessment and relevant files before making any changes.


## #BASH
_Find all z-index token definitions in index.css_

```bash
grep -n "io-z-" /home/io/io-dev/io/frontend/src/index.css | head -60
```


## #ASSISTANT

Now let me read the z-index token section of index.css and the DesignerCanvas.tsx file around the relevant lines.


## #ASSISTANT

Let me check the theme block structure and the DesignerCanvas lines that need changes.


## #BASH
_Find theme selector blocks in index.css_

```bash
grep -n "^/\*\|^:root\|^\[data-theme" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #ASSISTANT

Now let me look at all the DesignerCanvas lines that need to be changed.


## #BASH
_Check total line count of DesignerCanvas.tsx_

```bash
wc -l /home/io/io-dev/io/frontend/src/designer/DesignerCanvas.tsx
```


## #BASH
_Find DesignerCanvas.tsx location_

```bash
find /home/io/io-dev/io/frontend/src -name "DesignerCanvas.tsx" 2>/dev/null
```


## #BASH
_Check total line count_

```bash
wc -l /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx
```


## #ASSISTANT

Let me read all the remaining lines in parallel batches.


## #ASSISTANT

Let me see the full context of line 3750 for the comment placement.


## #ASSISTANT

I have all the context needed. Starting with the index.css token additions, then the 19 DesignerCanvas.tsx remaps.

**Step 1: index.css — dark theme block (`:root`)**


## #ASSISTANT

**Step 2: index.css — light theme block**


## #ASSISTANT

**Step 3: index.css — HPHMI theme block**


## #ASSISTANT

index.css done. Now the 19 DesignerCanvas.tsx remaps, working top to bottom.

**Remap 1 — Line 332: Fixed modal backdrop 2000 → `var(--io-z-modal)` [MEDIUM risk]**


## #ASSISTANT

That diagnostic is pre-existing in a different file — not related to my edits. Continuing with the remaps.

**Remap 2 — Line 3750: Drag cursor 9999 — add documented-exception comment, keep value**


## #ASSISTANT

**Remap 3 — Line 7689: SVG guide/grid line -1 → `calc(var(--io-z-base) - 1)`**


## #ASSISTANT

**Remap 4 — Line 7994: Canvas container overlay 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 5 — Line 8038: Canvas badge/overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

**Remap 6 — Line 8222: Element tooltip 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 7 — Line 8302: Selection highlight 15 → `calc(var(--io-z-panel) + 5)`**


## #ASSISTANT

**Remap 8 — Line 8377: Inline text editor 20 → `calc(var(--io-z-panel) + 10)`**


## #ASSISTANT

**Remap 9 — Line 8621: Fixed dialog backdrop 1200 → `var(--io-z-modal)` [MEDIUM risk]**


## #ASSISTANT

**Remap 10 — Line 8928: Point picker overlay 3000 → `var(--io-z-emergency)`**


## #ASSISTANT

**Remap 11 — Line 9426: Slot assignment popover 2000 → `var(--io-z-modal)` [HIGH risk]**


## #ASSISTANT

**Remap 12 — Line 9605: Canvas bottom toolbar HUD 2000 → `var(--io-z-dropdown)` [HIGH risk]**


## #ASSISTANT

**Remaps 13 & 14 — Lines 9792 and 9814: Ruler bars 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 15 — Line 9837: Ruler corner tile 11 → `calc(var(--io-z-panel) + 1)`**


## #ASSISTANT

**Remaps 16 & 17 — Lines 9863 and 9876: Guide drag handles 9 → `calc(var(--io-z-panel) - 1)`**


## #ASSISTANT

**Remap 18 — Line 9917: Tooltip/inline overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

**Remap 19 — Line 10271: Tooltip/inline overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

All 19 remaps applied. Now verifying there are no stale hardcoded z-index values left in DesignerCanvas.tsx from the remap list, then updating the assessment doc.


## #BASH
_Check for any remaining hardcoded zIndex values in DesignerCanvas.tsx_

```bash
grep -n "zIndex:" /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx | grep -v "var(--io-z" | grep -v "9999" | grep -v "string\|//\|zIndexScale\|zIndexRef"
```


## #BASH
_Check for remaining hardcoded z-index in cssText strings_

```bash
grep -n "z-index:" /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx | grep -v "var(--io-z" | grep -v "9999"
```


## #ASSISTANT

Clean — only the intentional 9999 exception remains. Let me also verify the two new tokens are in all three theme blocks.


## #BASH
_Verify new tokens are present in all three theme blocks_

```bash
grep -n "io-z-canvas-overlay\|io-z-priority-modal" /home/io/io-dev/io/frontend/src/index.css
```


## #ASSISTANT

Both tokens in all three blocks. Now updating the assessment doc.


## #ASSISTANT

Now mark each remap in the Part Five summary table with the applied date.


## #TURN_END

_2026-05-28T06:55:16+00:00_

---


## #PROMPT

_2026-05-28T07:02:11+00:00_

```
You are performing a DEEP verification review of a Claude Code work unit.

Your job is to compare what was asked (the initial prompt and any work-unit
summary) against what was actually built (the diff and the surrounding code).

Be skeptical and direct. Look for:
- The diff does something different from what was asked
- The diff regresses previously working behavior
- The diff expands scope beyond the prompt
- The diff has integration concerns with surrounding code that aren't addressed
- The diff appears to invert architectural decisions (e.g., the prompt asked
  to move from X to Y, but the diff actually reinforces X)

Output format (markdown):

## Summary
One paragraph: does the diff appear to match intent, or are there concerns?

## Concerns
If concerns exist, list them as numbered items with:
- What the concern is
- Specifically where in the code (file and line)
- Why this might be a divergence from intent

If no concerns, write "No concerns identified."

## Verification Notes
Anything else useful to know about what was built.

DO NOT include preamble. Start directly with "## Summary".
DO NOT speculate about things outside the diff. Stay grounded in what's there.

WORK UNIT LOG:
---
# Work Unit Log: workstream-4-5b-zindex-fix

read-ui-audi

Started: 2026-05-28T06:48:32+00:00
Session: 4f217d94-c8c4-4f86-a176-ee0326c01bc9

---


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (199→260 chars)

_2026-05-28T06:51:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (215→276 chars)

_2026-05-28T06:51:57+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/index.css` (194→255 chars)

_2026-05-28T06:52:02+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (135→150 chars)

_2026-05-28T06:52:07+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (103→268 chars)

_2026-05-28T06:52:14+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (67→93 chars)

_2026-05-28T06:52:19+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (277→294 chars)

_2026-05-28T06:52:23+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (303→327 chars)

_2026-05-28T06:52:32+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (292→309 chars)

_2026-05-28T06:52:37+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (206→233 chars)

_2026-05-28T06:52:43+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (246→274 chars)

_2026-05-28T06:52:48+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (178→193 chars)

_2026-05-28T06:52:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (191→210 chars)

_2026-05-28T06:52:56+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (254→269 chars)

_2026-05-28T06:53:01+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (234→252 chars)

_2026-05-28T06:53:17+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (208→225 chars)

_2026-05-28T06:53:22+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (208→225 chars)

_2026-05-28T06:53:33+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (258→285 chars)

_2026-05-28T06:53:38+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (134→162 chars)

_2026-05-28T06:53:42+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (134→162 chars)

_2026-05-28T06:53:47+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (206→230 chars)

_2026-05-28T06:53:52+00:00_


## #EDIT `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` (128→152 chars)

_2026-05-28T06:53:57+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (204→256 chars)

_2026-05-28T06:54:22+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (403→824 chars)

_2026-05-28T06:54:31+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (1637→2123 chars)

_2026-05-28T06:54:55+00:00_


## #EDIT `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (140→272 chars)

_2026-05-28T06:55:00+00:00_


## #PROMPT

_2026-05-28T06:55:13+00:00_

```
~initprompt~ workstream-4.5b-zindex-fix

Read ui-audit/11-zindex-assessment.md and index.css. The user has made these decisions:

Scope: FULL REMAP. Apply all 19 remaps in the assessment's Part Five table — both the behavior-changing moves and the zero-risk token-adoption swaps — so DesignerCanvas fully uses the permanent z-index scale.

Scale gap #1 (canvas annotation overlays): ADD a new token --io-z-canvas-overlay: 600 to the permanent scale in index.css, in all three themes. Use it for the three Tier B elements (lines 8038, 9917, 10271) INSTEAD of --io-z-dropdown. This corrects the semantic mismatch the assessment flagged and gives canvas-pane modules in the future rebuild a correct named token.

Scale gap #2 (drag cursor at 9999): DO NOT add a token and DO NOT remap to a token. Leave line 3750 at hardcoded 9999, but add a code comment documenting it as an intentional exception: an always-on-top, pointer-events:none transient drag indicator that must sit above all UI including emergency overlays, deliberately exempt from the token scale.

Scale gap #3 (ConfirmDialog vs canvas dialogs): ADD a new token --io-z-priority-modal: 1050 to the permanent scale in index.css, in all three themes, positioned between --io-z-modal (1000) and --io-z-command (1200). In THIS prompt, move the canvas-spawned dialogs (lines 332, 8621, 9426) to --io-z-modal (1000) as the assessment specifies. Do NOT modify ConfirmDialog.tsx in this prompt — that shared component's move to --io-z-priority-modal is a separate one-line change handled immediately after, to keep the canvas diff clean. Just define the token now so it exists.

Apply the remap:

1. Add the two new tokens (--io-z-canvas-overlay: 600 and --io-z-priority-modal: 1050) to index.css in all three theme blocks (dark, light, hphmi). Confirm placement is consistent with the existing --io-z-* scale ordering.

2. For each of the 19 DesignerCanvas z-index values in the assessment's Part Five table, apply the proposed token, with these adjustments to the assessment's proposals: the three Tier B elements (8038, 9917, 10271) use var(--io-z-canvas-overlay) not var(--io-z-dropdown); line 3750 stays hardcoded 9999 with the documented-exception comment. All others use the token the assessment specified.

3. For each change, state the line, the element, the old value, and the new token reference. Use calc() offsets exactly as the assessment specified for the Tier A elements so their integer values are preserved.

4. The assessment flagged 5 HIGH and 2 MEDIUM risk behavior-changing remaps (lines 8038, 9917, 10271, 9426, 9605 high; 332, 8621 medium). For each of these seven, note it explicitly in your output as needing a spot-check, because it changes observable stacking.

Constraints: stay in DesignerCanvas.tsx and index.css only. Do not touch ConfirmDialog.tsx or any other component in this prompt. Do not change any z-index value's computed result except the seven intended behavior-changing moves. Do not refactor surrounding canvas code.

Update ui-audit/11-zindex-assessment.md by marking each remap applied with the date, and note the two new tokens added to the scale.

When done print: the two new tokens added (with all-theme values), the 19 remaps applied (old value to new token), the seven behavior-changing ones flagged for spot-check, and confirmation that ConfirmDialog.tsx was NOT touched. Stop.
```


## #ASSISTANT

Reading the assessment and relevant files before making any changes.


## #BASH
_Find all z-index token definitions in index.css_

```bash
grep -n "io-z-" /home/io/io-dev/io/frontend/src/index.css | head -60
```


## #ASSISTANT

Now let me read the z-index token section of index.css and the DesignerCanvas.tsx file around the relevant lines.


## #ASSISTANT

Let me check the theme block structure and the DesignerCanvas lines that need changes.


## #BASH
_Find theme selector blocks in index.css_

```bash
grep -n "^/\*\|^:root\|^\[data-theme" /home/io/io-dev/io/frontend/src/index.css | head -20
```


## #ASSISTANT

Now let me look at all the DesignerCanvas lines that need to be changed.


## #BASH
_Check total line count of DesignerCanvas.tsx_

```bash
wc -l /home/io/io-dev/io/frontend/src/designer/DesignerCanvas.tsx
```


## #BASH
_Find DesignerCanvas.tsx location_

```bash
find /home/io/io-dev/io/frontend/src -name "DesignerCanvas.tsx" 2>/dev/null
```


## #BASH
_Check total line count_

```bash
wc -l /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx
```


## #ASSISTANT

Let me read all the remaining lines in parallel batches.


## #ASSISTANT

Let me see the full context of line 3750 for the comment placement.


## #ASSISTANT

I have all the context needed. Starting with the index.css token additions, then the 19 DesignerCanvas.tsx remaps.

**Step 1: index.css — dark theme block (`:root`)**


## #ASSISTANT

**Step 2: index.css — light theme block**


## #ASSISTANT

**Step 3: index.css — HPHMI theme block**


## #ASSISTANT

index.css done. Now the 19 DesignerCanvas.tsx remaps, working top to bottom.

**Remap 1 — Line 332: Fixed modal backdrop 2000 → `var(--io-z-modal)` [MEDIUM risk]**


## #ASSISTANT

That diagnostic is pre-existing in a different file — not related to my edits. Continuing with the remaps.

**Remap 2 — Line 3750: Drag cursor 9999 — add documented-exception comment, keep value**


## #ASSISTANT

**Remap 3 — Line 7689: SVG guide/grid line -1 → `calc(var(--io-z-base) - 1)`**


## #ASSISTANT

**Remap 4 — Line 7994: Canvas container overlay 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 5 — Line 8038: Canvas badge/overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

**Remap 6 — Line 8222: Element tooltip 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 7 — Line 8302: Selection highlight 15 → `calc(var(--io-z-panel) + 5)`**


## #ASSISTANT

**Remap 8 — Line 8377: Inline text editor 20 → `calc(var(--io-z-panel) + 10)`**


## #ASSISTANT

**Remap 9 — Line 8621: Fixed dialog backdrop 1200 → `var(--io-z-modal)` [MEDIUM risk]**


## #ASSISTANT

**Remap 10 — Line 8928: Point picker overlay 3000 → `var(--io-z-emergency)`**


## #ASSISTANT

**Remap 11 — Line 9426: Slot assignment popover 2000 → `var(--io-z-modal)` [HIGH risk]**


## #ASSISTANT

**Remap 12 — Line 9605: Canvas bottom toolbar HUD 2000 → `var(--io-z-dropdown)` [HIGH risk]**


## #ASSISTANT

**Remaps 13 & 14 — Lines 9792 and 9814: Ruler bars 10 → `var(--io-z-panel)`**


## #ASSISTANT

**Remap 15 — Line 9837: Ruler corner tile 11 → `calc(var(--io-z-panel) + 1)`**


## #ASSISTANT

**Remaps 16 & 17 — Lines 9863 and 9876: Guide drag handles 9 → `calc(var(--io-z-panel) - 1)`**


## #ASSISTANT

**Remap 18 — Line 9917: Tooltip/inline overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

**Remap 19 — Line 10271: Tooltip/inline overlay 1000 → `var(--io-z-canvas-overlay)` [HIGH risk]**


## #ASSISTANT

All 19 remaps applied. Now verifying there are no stale hardcoded z-index values left in DesignerCanvas.tsx from the remap list, then updating the assessment doc.


## #BASH
_Check for any remaining hardcoded zIndex values in DesignerCanvas.tsx_

```bash
grep -n "zIndex:" /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx | grep -v "var(--io-z" | grep -v "9999" | grep -v "string\|//\|zIndexScale\|zIndexRef"
```


## #BASH
_Check for remaining hardcoded z-index in cssText strings_

```bash
grep -n "z-index:" /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx | grep -v "var(--io-z" | grep -v "9999"
```


## #ASSISTANT

Clean — only the intentional 9999 exception remains. Let me also verify the two new tokens are in all three theme blocks.


## #BASH
_Verify new tokens are present in all three theme blocks_

```bash
grep -n "io-z-canvas-overlay\|io-z-priority-modal" /home/io/io-dev/io/frontend/src/index.css
```


## #ASSISTANT

Both tokens in all three blocks. Now updating the assessment doc.


## #ASSISTANT

Now mark each remap in the Part Five summary table with the applied date.


## #TURN_END

_2026-05-28T06:55:16+00:00_

---
---



DIFF OF CHANGES:
---
diff --git a/frontend/src/index.css b/frontend/src/index.css
index 43869db5..bb8c7023 100644
--- a/frontend/src/index.css
+++ b/frontend/src/index.css
@@ -203,14 +203,16 @@ body {
   --io-text-code: 0.8125rem;
   --io-text-code-sm: 0.75rem;
 
-  /* Z-Index (12) */
+  /* Z-Index (14) */
   --io-z-base: 0;
   --io-z-panel: 10;
   --io-z-sidebar: 100;
   --io-z-topbar: 100;
   --io-z-edge-hover: 150;
   --io-z-dropdown: 500;
+  --io-z-canvas-overlay: 600;
   --io-z-modal: 1000;
+  --io-z-priority-modal: 1050;
   --io-z-command: 1200;
   --io-z-visual-lock: 1500;
   --io-z-kiosk-auth: 1800;
@@ -423,7 +425,9 @@ body {
   --io-z-topbar: 100;
   --io-z-edge-hover: 150;
   --io-z-dropdown: 500;
+  --io-z-canvas-overlay: 600;
   --io-z-modal: 1000;
+  --io-z-priority-modal: 1050;
   --io-z-command: 1200;
   --io-z-visual-lock: 1500;
   --io-z-kiosk-auth: 1800;
@@ -628,7 +632,9 @@ body {
   --io-z-topbar: 100;
   --io-z-edge-hover: 150;
   --io-z-dropdown: 500;
+  --io-z-canvas-overlay: 600;
   --io-z-modal: 1000;
+  --io-z-priority-modal: 1050;
   --io-z-command: 1200;
   --io-z-visual-lock: 1500;
   --io-z-kiosk-auth: 1800;
diff --git a/frontend/src/pages/designer/DesignerCanvas.tsx b/frontend/src/pages/designer/DesignerCanvas.tsx
index 3fadec5d..7e9f864e 100644
--- a/frontend/src/pages/designer/DesignerCanvas.tsx
+++ b/frontend/src/pages/designer/DesignerCanvas.tsx
@@ -329,7 +329,7 @@ function NameGroupPrompt({
   const overlayStyle: React.CSSProperties = {
     position: "fixed",
     inset: 0,
-    zIndex: 2000,
+    zIndex: "var(--io-z-modal)",
     background: "rgba(0,0,0,0.5)",
     display: "flex",
     alignItems: "center",
@@ -3747,7 +3747,7 @@ export default function DesignerCanvas({
             ghost.style.cssText = [
               "position:fixed",
               "pointer-events:none",
-              "z-index:9999",
+              "z-index:9999", // intentional exception: pointer-events:none transient drag indicator; must sit above all UI including emergency overlays; deliberately exempt from the token scale
               `left:${e.clientX}px`,
               `top:${e.clientY}px`,
               `width:${bb ? bb.width : 40}px`,
@@ -7686,7 +7686,7 @@ export default function DesignerCanvas({
                       strokeWidth={1 / zoom}
                       strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                       pointerEvents="none"
-                      style={{ zIndex: -1 } as React.CSSProperties}
+                      style={{ zIndex: "calc(var(--io-z-base) - 1)" } as React.CSSProperties}
                     />
                   );
                 })()}
@@ -7991,7 +7991,7 @@ export default function DesignerCanvas({
                 position: "absolute",
                 inset: 0,
                 overflow: "hidden",
-                zIndex: 10,
+                zIndex: "var(--io-z-panel)",
               }}
               onMouseDown={(e) => e.stopPropagation()}
               onMouseMove={(e) => e.stopPropagation()}
@@ -8035,7 +8035,7 @@ export default function DesignerCanvas({
                       minWidth: 160,
                       overflow: "hidden",
                       fontSize: 12,
-                      zIndex: 1000,
+                      zIndex: "var(--io-z-canvas-overlay)",
                     }}
                   >
                     <ContextMenuPrimitive.Item
@@ -8219,7 +8219,7 @@ export default function DesignerCanvas({
                 borderRadius: "var(--io-radius)",
                 padding: "3px 10px",
                 fontSize: 11,
-                zIndex: 10,
+                zIndex: "var(--io-z-panel)",
                 boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                 whiteSpace: "nowrap",
               }}
@@ -8299,7 +8299,7 @@ export default function DesignerCanvas({
                 position: "absolute",
                 inset: 0,
                 pointerEvents: "none",
-                zIndex: 15,
+                zIndex: "calc(var(--io-z-panel) + 5)",
                 overflow: "hidden",
               }}
             >
@@ -8374,7 +8374,7 @@ export default function DesignerCanvas({
                     lineHeight: 1.4,
                     padding: 0,
                     margin: 0,
-                    zIndex: 20,
+                    zIndex: "calc(var(--io-z-panel) + 10)",
                     overflow: "hidden",
                     whiteSpace: "pre",
                   }}
@@ -8618,7 +8618,7 @@ export default function DesignerCanvas({
               style={{
                 position: "fixed",
                 inset: 0,
-                zIndex: 1200,
+                zIndex: "var(--io-z-modal)",
                 background: "rgba(0,0,0,0.55)",
                 display: "flex",
                 alignItems: "center",
@@ -8925,7 +8925,7 @@ export default function DesignerCanvas({
                   style={{
                     position: "fixed",
                     inset: 0,
-                    zIndex: 3000,
+                    zIndex: "var(--io-z-emergency)",
                     cursor: "crosshair",
                   }}
                   onMouseMove={(e) => {
@@ -9423,7 +9423,7 @@ export default function DesignerCanvas({
                     position: "fixed",
                     top: slotPopover.screenY,
                     left: slotPopover.screenX,
-                    zIndex: 2000,
+                    zIndex: "var(--io-z-modal)",
                     background: "var(--io-surface-elevated)",
                     border: "1px solid var(--io-border)",
                     borderRadius: "var(--io-radius)",
@@ -9602,7 +9602,7 @@ export default function DesignerCanvas({
             bottom: 16,
             left: "50%",
             transform: "translateX(-50%)",
-            zIndex: 2000,
+            zIndex: "var(--io-z-dropdown)",
             display: "flex",
             alignItems: "center",
             gap: 8,
@@ -9789,7 +9789,7 @@ function RulersOverlay({
           left: RULER_SIZE,
           width: `calc(100% - ${RULER_SIZE}px)`,
           height: RULER_SIZE,
-          zIndex: 10,
+          zIndex: "var(--io-z-panel)",
           cursor: "s-resize",
           pointerEvents: "all",
         }}
@@ -9811,7 +9811,7 @@ function RulersOverlay({
           left: 0,
           width: RULER_SIZE,
           height: `calc(100% - ${RULER_SIZE}px)`,
-          zIndex: 10,
+          zIndex: "var(--io-z-panel)",
           cursor: "e-resize",
           pointerEvents: "all",
         }}
@@ -9834,7 +9834,7 @@ function RulersOverlay({
           width: RULER_SIZE,
           height: RULER_SIZE,
           background: "var(--io-surface-elevated)",
-          zIndex: 11,
+          zIndex: "calc(var(--io-z-panel) + 1)",
           borderRight: "1px solid var(--io-border)",
           borderBottom: "1px solid var(--io-border)",
         }}
@@ -9860,7 +9860,7 @@ function RulersOverlay({
                     ? "rgba(255,160,0,0.5)"
                     : "rgba(0,200,255,0.5)",
                   cursor: g.locked ? "not-allowed" : "ew-resize",
-                  zIndex: 9,
+                  zIndex: "calc(var(--io-z-panel) - 1)",
                   pointerEvents: "all",
                 }
               : {
@@ -9873,7 +9873,7 @@ function RulersOverlay({
                     ? "rgba(255,160,0,0.5)"
                     : "rgba(0,200,255,0.5)",
                   cursor: g.locked ? "not-allowed" : "ns-resize",
-                  zIndex: 9,
+                  zIndex: "calc(var(--io-z-panel) - 1)",
                   pointerEvents: "all",
                 };
 
@@ -9914,7 +9914,7 @@ function RulersOverlay({
             minWidth: 160,
             overflow: "hidden",
             fontSize: 12,
-            zIndex: 1000,
+            zIndex: "var(--io-z-canvas-overlay)",
             padding: "3px 0",
           };
 
@@ -10268,7 +10268,7 @@ function DesignerContextMenuContent({
     minWidth: 180,
     overflow: "hidden",
     fontSize: 12,
-    zIndex: 1000,
+    zIndex: "var(--io-z-canvas-overlay)",
   };
 
   const subContentStyle: React.CSSProperties = {
---

FULL FILE CONTENTS (for surrounding-code analysis):
---

--- File: /home/io/io-dev/io/frontend/src/index.css ---
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Prevent native browser text/element drag from hijacking pointer events.
   Without this, clicking SVG text elements and dragging fires dragstart,
   which cancels pointerdown capture and leaves marquee/selection state broken.
   user-select is still honoured inside <input>/<textarea> by browsers. */
body {
  user-select: none;
}

/* ============================================================
   I/O Design System — CSS Custom Properties (138 tokens)
   Defaults: Dark theme. JS (tokens.ts) overrides on load.
   Doc 38 token registry — all 138 tokens defined.
   ============================================================ */

/* ---- Dark theme (default) ---------------------------------- */
:root,
[data-theme="dark"] {
  /* Surface & Layout (5) */
  --io-surface-primary: #09090b;
  --io-surface-secondary: #18181b;
  --io-surface-elevated: #27272a;
  --io-surface-sunken: #09090b;
  --io-surface-overlay: rgba(0, 0, 0, 0.7);
  --io-surface: var(--io-surface-elevated);
  --io-bg: var(--io-surface-primary);
  --io-surface-hover: var(--io-surface-elevated);
  --io-surface-raised: var(--io-surface-elevated);

  /* Text (5) */
  --io-text-primary: #f9fafb;
  --io-text-secondary: #a1a1aa;
  --io-text-muted: #71717a;
  --io-text-inverse: #09090b;
  --io-text-link: var(--io-accent);
  --io-text: var(--io-text-primary);
  --io-text-on-accent: var(--io-accent-foreground);

  /* Accent — Midnight Teal, dark theme uses 400-level (5) */
  --io-accent: #2dd4bf;
  --io-accent-hover: #5eead4;
  --io-accent-active: #99f6e4;
  --io-accent-foreground: #09090b;
  --io-accent-subtle: rgba(45, 212, 191, 0.1);
  /* Keep --io-accent-rgb in sync with --io-accent hex per theme: light=13 148 136, hphmi=20 184 166 */
  --io-accent-rgb: 45 212 191;

  /* Borders & Separators (4) */
  --io-border: #3f3f46;
  --io-border-subtle: #27272a;
  --io-border-strong: #52525b;
  --io-focus-ring: #2dd4bf;

  /* Alarm Priority — ISA-101 / ISA-18.2 (7, NOT customizable) */
  --io-alarm-urgent: #ef4444;
  --io-alarm-high: #f97316;
  --io-alarm-low: #eab308;
  --io-alarm-diagnostic: #f4f4f5;
  --io-alarm-custom: #60a5fa;
  --io-alarm-shelved: #d946ef;

  /* Graphics Display Elements (4) */
  --io-fill-normal: #475569;
  --io-display-zone-inactive: #3f3f46;
  --io-display-zone-normal: #404048;
  --io-display-zone-border: #52525b;

  /* Operational Status (2) */
  --io-alarm-normal: #22c55e;
  --io-alarm-disabled: #52525b;
  --io-alarm-inactive: #808080;

  /* Semantic Status (5 + subtle variants + status-fg) */
  --io-danger: #ef4444;
  --io-success: #22c55e;
  --io-warning: #f59e0b;
  --io-info: #3b82f6;
  --io-text-disabled: #52525b;
  --io-success-subtle: rgba(34, 197, 94, 0.12);
  --io-warning-subtle: rgba(251, 191, 36, 0.15);
  --io-danger-subtle: rgba(239, 68, 68, 0.12);
  --io-status-fg: #ffffff;
  --io-error: var(--io-danger);

  /* Chart & Visualization (5) */
  --io-chart-bg: #18181b;
  --io-chart-grid: #27272a;
  --io-chart-axis: #a1a1aa;
  --io-chart-crosshair: #71717a;
  --io-chart-tooltip-bg: #27272a;

  /* Trend pen colors — 8 pens (static across themes) */
  --io-pen-1: #2563eb;
  --io-pen-2: #dc2626;
  --io-pen-3: #16a34a;
  --io-pen-4: #d97706;
  --io-pen-5: #7c3aed;
  --io-pen-6: #0891b2;
  --io-pen-7: #db2777;
  --io-pen-8: #65a30d;

  /* Layer 4: Button Tokens (6) */
  --io-btn-bg: var(--io-accent);
  --io-btn-hover: var(--io-accent-hover);
  --io-btn-active: var(--io-accent-active);
  --io-btn-text: var(--io-accent-foreground);
  --io-btn-secondary-bg: var(--io-surface-secondary);
  --io-btn-secondary-border: var(--io-border);

  /* Layer 4: Sidebar Tokens (5) */
  --io-sidebar-bg: var(--io-surface-secondary);
  --io-sidebar-width: 220px;
  --io-sidebar-collapsed: 48px;
  --io-sidebar-active-border: var(--io-accent);
  --io-sidebar-hover-bg: var(--io-accent-subtle);

  /* Layer 4: Top Bar Tokens (3) */
  --io-topbar-bg: var(--io-surface-primary);
  --io-topbar-height: 48px;
  --io-topbar-border: var(--io-border-subtle);

  /* Layer 4: Card Tokens (4) */
  --io-card-bg: var(--io-surface-secondary);
  --io-card-border: var(--io-border);
  --io-card-radius: var(--io-radius);
  --io-card-shadow: var(--io-shadow-sm);

  /* Layer 4: Table Tokens (6) */
  --io-table-row-compact: 28px;
  --io-table-row-default: 36px;
  --io-table-row-comfortable: 44px;
  --io-table-header-bg: var(--io-surface-sunken);
  --io-table-row-hover: var(--io-accent-subtle);
  --io-table-row-selected: var(--io-accent-subtle);

  /* Layer 4: Input Tokens (5) */
  --io-input-bg: var(--io-surface-sunken);
  --io-input-border: var(--io-border);
  --io-input-focus-border: var(--io-accent);
  --io-input-placeholder: var(--io-text-muted);
  --io-input-height: 36px;

  /* Layer 4: Modal/Dialog Tokens (3) */
  --io-modal-bg: var(--io-surface-elevated);
  --io-modal-backdrop: var(--io-surface-overlay);
  --io-modal-radius: var(--io-radius-lg);
  --io-overlay: var(--io-modal-backdrop);

  /* Layer 4: Toast/Notification Tokens (3) */
  --io-toast-bg: var(--io-surface-elevated);
  --io-toast-border: var(--io-border);
  --io-toast-shadow: var(--io-shadow-lg);

  /* Spacing (17) */
  --io-space-0: 0px;
  --io-space-1: 4px;
  --io-space-2: 8px;
  --io-space-3: 12px;
  --io-space-4: 16px;
  --io-space-5: 20px;
  --io-space-6: 24px;
  --io-space-8: 32px;
  --io-space-10: 40px;
  --io-space-12: 48px;
  --io-space-14: 56px;
  --io-space-16: 64px;
  --io-space-20: 80px;
  --io-space-24: 96px;
  --io-space-32: 128px;
  --io-space-40: 160px;
  --io-space-48: 192px;

  /* Border Radius (4) — Subtle preset (6px) */
  --io-radius-sm: 3px;
  --io-radius: 6px;
  --io-radius-lg: 9px;
  --io-radius-full: 9999px;

  /* Shadow (4) */
  --io-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --io-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3);
  --io-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5), 0 4px 6px rgba(0, 0, 0, 0.3);
  --io-shadow-none: none;

  /* Typography (16) */
  --io-text-4xl: 2.25rem;
  --io-text-3xl: 1.75rem;
  --io-text-2xl: 1.375rem;
  --io-text-xl: 1.125rem;
  --io-text-lg: 1rem;
  --io-text-base: 0.875rem;
  --io-text-sm: 0.8125rem;
  --io-text-xs: 0.75rem;
  --io-text-2xs: 0.6875rem;
  --io-text-label: 0.75rem;
  --io-text-label-sm: 0.6875rem;
  --io-text-value: 0.875rem;
  --io-text-value-lg: 1.125rem;
  --io-text-value-xl: 1.5rem;
  --io-text-code: 0.8125rem;
  --io-text-code-sm: 0.75rem;

  /* Z-Index (14) */
  --io-z-base: 0;
  --io-z-panel: 10;
  --io-z-sidebar: 100;
  --io-z-topbar: 100;
  --io-z-edge-hover: 150;
  --io-z-dropdown: 500;
  --io-z-canvas-overlay: 600;
  --io-z-modal: 1000;
  --io-z-priority-modal: 1050;
  --io-z-command: 1200;
  --io-z-visual-lock: 1500;
  --io-z-kiosk-auth: 1800;
  --io-z-toast: 2000;
  --io-z-emergency: 3000;

  /* Duration (3) */
  --io-duration-fast: 150ms;
  --io-duration-medium: 250ms;
  --io-duration-slow: 350ms;

  /* Typography — font stacks (static, all themes) */
  --io-font-mono:
    "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Courier New",
    monospace;
  --io-font-sans:
    "InterVariable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, "Helvetica Neue", sans-serif;
}

/* ---- Light theme ------------------------------------------- */
[data-theme="light"] {
  /* Surface & Layout */
  --io-surface-primary: #ffffff;
  --io-surface-secondary: #f9fafb;
  --io-surface-elevated: #ffffff;
  --io-surface-sunken: #f3f4f6;
  --io-surface-overlay: rgba(0, 0, 0, 0.5);
  --io-surface: var(--io-surface-elevated);
  --io-bg: var(--io-surface-primary);
  --io-surface-hover: var(--io-surface-elevated);
  --io-surface-raised: var(--io-surface-elevated);

  /* Text */
  --io-text-primary: #111827;
  --io-text-secondary: #6b7280;
  --io-text-muted: #9ca3af;
  --io-text-inverse: #ffffff;
  --io-text-link: var(--io-accent);
  --io-text: var(--io-text-primary);
  --io-text-on-accent: var(--io-accent-foreground);

  /* Accent — Midnight Teal, light theme uses 600-level */
  --io-accent: #0d9488;
  --io-accent-hover: #0f766e;
  --io-accent-active: #115e59;
  --io-accent-foreground: #ffffff;
  --io-accent-subtle: rgba(13, 148, 136, 0.08);
  --io-accent-rgb: 13 148 136;

  /* Borders */
  --io-border: #e5e7eb;
  --io-border-subtle: #f3f4f6;
  --io-border-strong: #d1d5db;
  --io-focus-ring: #14b8a6;

  /* Alarm Priority — ISA-101 (lighter for light bg) */
  --io-alarm-urgent: #dc2626;
  --io-alarm-high: #d97706;
  --io-alarm-low: #ca8a04;
  --io-alarm-diagnostic: #0891b2;
  --io-alarm-custom: #6d28d9;
  --io-alarm-shelved: #7c3aed;

  /* Graphics Display Elements */
  --io-fill-normal: rgba(148, 163, 184, 0.3);
  --io-display-zone-inactive: #e5e7eb;
  --io-display-zone-normal: #d1d5db;
  --io-display-zone-border: #d1d5db;

  /* Operational Status */
  --io-alarm-normal: #16a34a;
  --io-alarm-disabled: #9ca3af;
  --io-alarm-inactive: #808080;

  /* Semantic Status */
  --io-danger: #dc2626;
  --io-success: #16a34a;
  --io-warning: #d97706;
  --io-info: #2563eb;
  --io-text-disabled: #d1d5db;
  --io-success-subtle: rgba(22, 163, 74, 0.1);
  --io-warning-subtle: rgba(217, 119, 6, 0.1);
  --io-danger-subtle: rgba(220, 38, 38, 0.1);
  --io-status-fg: #ffffff;
  --io-error: var(--io-danger);

  /* Chart & Visualization */
  --io-chart-bg: #ffffff;
  --io-chart-grid: #f5f6f8;
  --io-chart-axis: #6b7280;
  --io-chart-crosshair: #9ca3af;
  --io-chart-tooltip-bg: #ffffff;

  /* Trend pen colors (static across themes) */
  --io-pen-1: #2563eb;
  --io-pen-2: #dc2626;
  --io-pen-3: #16a34a;
  --io-pen-4: #d97706;
  --io-pen-5: #7c3aed;
  --io-pen-6: #0891b2;
  --io-pen-7: #db2777;
  --io-pen-8: #65a30d;

  /* Layer 4: Button Tokens */
  --io-btn-bg: var(--io-accent);
  --io-btn-hover: var(--io-accent-hover);
  --io-btn-active: var(--io-accent-active);
  --io-btn-text: var(--io-accent-foreground);
  --io-btn-secondary-bg: var(--io-surface-secondary);
  --io-btn-secondary-border: var(--io-border);

  /* Layer 4: Sidebar Tokens */
  --io-sidebar-bg: var(--io-surface-secondary);
  --io-sidebar-width: 220px;
  --io-sidebar-collapsed: 48px;
  --io-sidebar-active-border: var(--io-accent);
  --io-sidebar-hover-bg: var(--io-accent-subtle);

  /* Layer 4: Top Bar Tokens */
  --io-topbar-bg: var(--io-surface-primary);
  --io-topbar-height: 48px;
  --io-topbar-border: var(--io-border-subtle);

  /* Layer 4: Card Tokens */
  --io-card-bg: var(--io-surface-secondary);
  --io-card-border: var(--io-border);
  --io-card-radius: var(--io-radius);
  --io-card-shadow: var(--io-shadow-sm);

  /* Layer 4: Table Tokens */
  --io-table-row-compact: 28px;
  --io-table-row-default: 36px;
  --io-table-row-comfortable: 44px;
  --io-table-header-bg: var(--io-surface-sunken);
  --io-table-row-hover: var(--io-accent-subtle);
  --io-table-row-selected: var(--io-accent-subtle);

  /* Layer 4: Input Tokens */
  --io-input-bg: var(--io-surface-sunken);
  --io-input-border: var(--io-border);
  --io-input-focus-border: var(--io-accent);
  --io-input-placeholder: var(--io-text-muted);
  --io-input-height: 36px;

  /* Layer 4: Modal/Dialog Tokens */
  --io-modal-bg: var(--io-surface-elevated);
  --io-modal-backdrop: var(--io-surface-overlay);
  --io-modal-radius: var(--io-radius-lg);
  --io-overlay: var(--io-modal-backdrop);

  /* Layer 4: Toast/Notification Tokens */
  --io-toast-bg: var(--io-surface-elevated);
  --io-toast-border: var(--io-border);
  --io-toast-shadow: var(--io-shadow-lg);

  /* Spacing */
  --io-space-0: 0px;
  --io-space-1: 4px;
  --io-space-2: 8px;
  --io-space-3: 12px;
  --io-space-4: 16px;
  --io-space-5: 20px;
  --io-space-6: 24px;
  --io-space-8: 32px;
  --io-space-10: 40px;
  --io-space-12: 48px;
  --io-space-14: 56px;
  --io-space-16: 64px;
  --io-space-20: 80px;
  --io-space-24: 96px;
  --io-space-32: 128px;
  --io-space-40: 160px;
  --io-space-48: 192px;

  /* Border Radius */
  --io-radius-sm: 3px;
  --io-radius: 6px;
  --io-radius-lg: 9px;
  --io-radius-full: 9999px;

  /* Shadow */
  --io-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --io-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  --io-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
  --io-shadow-none: none;

  /* Typography (same values across themes) */
  --io-text-4xl: 2.25rem;
  --io-text-3xl: 1.75rem;
  --io-text-2xl: 1.375rem;
  --io-text-xl: 1.125rem;
  --io-text-lg: 1rem;
  --io-text-base: 0.875rem;
  --io-text-sm: 0.8125rem;
  --io-text-xs: 0.75rem;
  --io-text-2xs: 0.6875rem;
  --io-text-label: 0.75rem;
  --io-text-label-sm: 0.6875rem;
  --io-text-value: 0.875rem;
  --io-text-value-lg: 1.125rem;
  --io-text-value-xl: 1.5rem;
  --io-text-code: 0.8125rem;
  --io-text-code-sm: 0.75rem;

  /* Z-Index (same across themes) */
  --io-z-base: 0;
  --io-z-panel: 10;
  --io-z-sidebar: 100;
  --io-z-topbar: 100;
  --io-z-edge-hover: 150;
  --io-z-dropdown: 500;
  --io-z-canvas-overlay: 600;
  --io-z-modal: 1000;
  --io-z-priority-modal: 1050;
  --io-z-command: 1200;
  --io-z-visual-lock: 1500;
  --io-z-kiosk-auth: 1800;
  --io-z-toast: 2000;
  --io-z-emergency: 3000;

  /* Duration (same across themes) */
  --io-duration-fast: 150ms;
  --io-duration-medium: 250ms;
  --io-duration-slow: 350ms;
}

/* ---- HPHMI theme (dark blue-gray, ISA-101) ----------------- */
[data-theme="hphmi"] {
  /* Surface & Layout */
  --io-surface-primary: #0f172a;
  --io-surface-secondary: #1e293b;
  --io-surface-elevated: #334155;
  --io-surface-sunken: #0c1525;
  --io-surface-overlay: rgba(0, 0, 0, 0.7);
  --io-surface: var(--io-surface-elevated);
  --io-bg: var(--io-surface-primary);
  --io-surface-hover: var(--io-surface-elevated);
  --io-surface-raised: var(--io-surface-elevated);

  /* Text */
  --io-text-primary: #e2e8f0;
  --io-text-secondary: #94a3b8;
  --io-text-muted: #64748b;
  --io-text-inverse: #0f172a;
  --io-text-link: var(--io-accent);
  --io-text: var(--io-text-primary);
  --io-text-on-accent: var(--io-accent-foreground);

  /* Accent — Midnight Teal, HPHMI uses 500-level */
  --io-accent: #14b8a6;
  --io-accent-hover: #2dd4bf;
  --io-accent-active: #5eead4;
  --io-accent-foreground: #0f172a;
  --io-accent-subtle: rgba(45, 212, 191, 0.08);
  --io-accent-rgb: 20 184 166;

  /* Borders */
  --io-border: #475569;
  --io-border-subtle: #2d3f53;
  --io-border-strong: #64748b;
  --io-focus-ring: #14b8a6;

  /* Alarm Priority — ISA-101 */
  --io-alarm-urgent: #ef4444;
  --io-alarm-high: #f59e0b;
  --io-alarm-low: #eab308;
  --io-alarm-diagnostic: #06b6d4;
  --io-alarm-custom: #7c3aed;
  --io-alarm-shelved: #a78bfa;

  /* Graphics Display Elements */
  --io-fill-normal: rgba(71, 85, 105, 0.5);
  --io-display-zone-inactive: #3f3f46;
  --io-display-zone-normal: #404048;
  --io-display-zone-border: #52525b;

  /* Operational Status */
  --io-alarm-normal: #22c55e;
  --io-alarm-disabled: #64748b;
  --io-alarm-inactive: #808080;

  /* Semantic Status */
  --io-danger: #ef4444;
  --io-success: #22c55e;
  --io-warning: #f59e0b;
  --io-info: #3b82f6;
  --io-text-disabled: #475569;
  --io-success-subtle: rgba(34, 197, 94, 0.12);
  --io-warning-subtle: rgba(245, 158, 11, 0.15);
  --io-danger-subtle: rgba(239, 68, 68, 0.12);
  --io-status-fg: #ffffff;
  --io-error: var(--io-danger);

  /* Chart & Visualization */
  --io-chart-bg: #1e293b;
  --io-chart-grid: #3d5166;
  --io-chart-axis: #94a3b8;
  --io-chart-crosshair: #64748b;
  --io-chart-tooltip-bg: #1e293b;

  /* Trend pen colors (static) */
  --io-pen-1: #2563eb;
  --io-pen-2: #dc2626;
  --io-pen-3: #16a34a;
  --io-pen-4: #d97706;
  --io-pen-5: #7c3aed;
  --io-pen-6: #0891b2;
  --io-pen-7: #db2777;
  --io-pen-8: #65a30d;

  /* Layer 4: Button Tokens */
  --io-btn-bg: var(--io-accent);
  --io-btn-hover: var(--io-accent-hover);
  --io-btn-active: var(--io-accent-active);
  --io-btn-text: var(--io-accent-foreground);
  --io-btn-secondary-bg: var(--io-surface-secondary);
  --io-btn-secondary-border: var(--io-border);

  /* Layer 4: Sidebar Tokens */
  --io-sidebar-bg: var(--io-surface-secondary);
  --io-sidebar-width: 220px;
  --io-sidebar-collapsed: 48px;
  --io-sidebar-active-border: var(--io-accent);
  --io-sidebar-hover-bg: var(--io-accent-subtle);

  /* Layer 4: Top Bar Tokens */
  --io-topbar-bg: var(--io-surface-primary);
  --io-topbar-height: 48px;
  --io-topbar-border: var(--io-border-subtle);

  /* Layer 4: Card Tokens */
  --io-card-bg: var(--io-surface-secondary);
  --io-card-border: var(--io-border);
  --io-card-radius: var(--io-radius);
  --io-card-shadow: var(--io-shadow-sm);

  /* Layer 4: Table Tokens */
  --io-table-row-compact: 28px;
  --io-table-row-default: 36px;
  --io-table-row-comfortable: 44px;
  --io-table-header-bg: var(--io-surface-sunken);
  --io-table-row-hover: var(--io-accent-subtle);
  --io-table-row-selected: var(--io-accent-subtle);

  /* Layer 4: Input Tokens */
  --io-input-bg: var(--io-surface-sunken);
  --io-input-border: var(--io-border);
  --io-input-focus-border: var(--io-accent);
  --io-input-placeholder: var(--io-text-muted);
  --io-input-height: 36px;

  /* Layer 4: Modal/Dialog Tokens */
  --io-modal-bg: var(--io-surface-elevated);
  --io-modal-backdrop: var(--io-surface-overlay);
  --io-modal-radius: var(--io-radius-lg);
  --io-overlay: var(--io-modal-backdrop);

  /* Layer 4: Toast/Notification Tokens */
  --io-toast-bg: var(--io-surface-elevated);
  --io-toast-border: var(--io-border);
  --io-toast-shadow: var(--io-shadow-lg);

  /* Spacing */
  --io-space-0: 0px;
  --io-space-1: 4px;
  --io-space-2: 8px;
  --io-space-3: 12px;
  --io-space-4: 16px;
  --io-space-5: 20px;
  --io-space-6: 24px;
  --io-space-8: 32px;
  --io-space-10: 40px;
  --io-space-12: 48px;
  --io-space-14: 56px;
  --io-space-16: 64px;
  --io-space-20: 80px;
  --io-space-24: 96px;
  --io-space-32: 128px;
  --io-space-40: 160px;
  --io-space-48: 192px;

  /* Border Radius */
  --io-radius-sm: 3px;
  --io-radius: 6px;
  --io-radius-lg: 9px;
  --io-radius-full: 9999px;

  /* Shadow */
  --io-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --io-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3);
  --io-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5), 0 4px 6px rgba(0, 0, 0, 0.3);
  --io-shadow-none: none;

  /* Typography */
  --io-text-4xl: 2.25rem;
  --io-text-3xl: 1.75rem;
  --io-text-2xl: 1.375rem;
  --io-text-xl: 1.125rem;
  --io-text-lg: 1rem;
  --io-text-base: 0.875rem;
  --io-text-sm: 0.8125rem;
  --io-text-xs: 0.75rem;
  --io-text-2xs: 0.6875rem;
  --io-text-label: 0.75rem;
  --io-text-label-sm: 0.6875rem;
  --io-text-value: 0.875rem;
  --io-text-value-lg: 1.125rem;
  --io-text-value-xl: 1.5rem;
  --io-text-code: 0.8125rem;
  --io-text-code-sm: 0.75rem;

  /* Z-Index */
  --io-z-base: 0;
  --io-z-panel: 10;
  --io-z-sidebar: 100;
  --io-z-topbar: 100;
  --io-z-edge-hover: 150;
  --io-z-dropdown: 500;
  --io-z-canvas-overlay: 600;
  --io-z-modal: 1000;
  --io-z-priority-modal: 1050;
  --io-z-command: 1200;
  --io-z-visual-lock: 1500;
  --io-z-kiosk-auth: 1800;
  --io-z-toast: 2000;
  --io-z-emergency: 3000;

  /* Duration */
  --io-duration-fast: 150ms;
  --io-duration-medium: 250ms;
  --io-duration-slow: 350ms;
}

/* ============================================================
   Alarm State CSS Classes (doc 38 / doc 35)
   Applied to display elements, not theme-dependent.
   ============================================================ */

/* Skeleton loading pulse */
@keyframes io-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

/* Skeleton shimmer — module-shaped loading states */
@keyframes io-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.io-skeleton {
  background: linear-gradient(
    90deg,
    var(--io-surface-secondary) 25%,
    var(--io-surface-elevated) 50%,
    var(--io-surface-secondary) 75%
  );
  background-size: 200% 100%;
  animation: io-shimmer 1.5s linear infinite;
}

/* Unacknowledged — 1Hz flash between alarm color and gray */
@keyframes io-alarm-flash {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0.25;
  }
}

.io-unack {
  animation: io-alarm-flash 1s step-end infinite;
}
.io-ack {
  /* Steady alarm color — no animation */
}
.io-rtn-unack {
  opacity: 0.6;
}
.io-shelved {
  border-style: dashed !important;
  opacity: 0.7;
}
.io-suppressed {
  opacity: 0.4;
}
.io-oos-display {
  text-decoration: line-through;
  opacity: 0.5;
}

/* Data Quality CSS Classes */
.io-quality-stale {
  outline: 1px dashed var(--io-border-strong);
  opacity: 0.6;
}
.io-quality-bad {
  outline: 1px dashed var(--io-alarm-urgent);
}
.io-quality-comm-fail {
  outline: 1px solid var(--io-alarm-disabled);
  opacity: 0.7;
}
.io-quality-uncertain {
  outline: 1px dotted var(--io-border-strong);
}
.io-quality-manual {
  outline: 1px solid var(--io-alarm-diagnostic);
}

/* ============================================================
   Context Menu Animations
   ============================================================ */

@keyframes io-context-menu-in {
  from {
    opacity: 0;
    transform: scale(0.97) translateY(-3px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes io-dropdown-in {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ============================================================
   Base resets
   ============================================================ */

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  margin: 0;
  background: var(--io-surface-primary);
  color: var(--io-text-primary);
  font-family:
    "InterVariable",
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    "Helvetica Neue",
    sans-serif;
  font-size: var(--io-text-base, 0.875rem);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Monospace for code/data contexts */
code,
pre,
kbd,
.io-mono {
  font-family:
    "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Courier New",
    monospace;
  font-size: var(--io-text-code, 0.8125rem);
}

/* Tabular numbers for data values — prevents layout jitter */
.io-tabular {
  font-variant-numeric: tabular-nums;
}

/* ============================================================
   Scrollbar styling
   ============================================================ */

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--io-border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--io-text-muted);
}

/* ============================================================
   Focus ring
   ============================================================ */

:focus-visible {
  outline: 2px solid var(--io-focus-ring, var(--io-accent));
  outline-offset: 2px;
}

/* ============================================================
   Text selection
   ============================================================ */

::selection {
  background: var(--io-accent-subtle);
  color: var(--io-text-primary);
}

/* ============================================================
   Mobile touch targets — gloved operation (doc 20 §Touch Targets)
   60px minimum for standard controls; 72px for critical actions.
   Applies only on coarse-pointer (touch) devices.
   ============================================================ */

@media (pointer: coarse) {
  /* Standard interactive elements — 60px minimum */
  button,
  [role="button"],
  a,
  input[type="checkbox"],
  input[type="radio"],
  select,
  .io-tab,
  .io-nav-item,
  .io-list-item {
    min-height: 60px;
    min-width: 60px;
  }

  /* Icon-only buttons expand their hit area via padding */
  button.io-icon-btn {
    min-height: 60px;
    min-width: 60px;
    padding: 12px;
  }

  /* Critical actions (alarm ack, emergency, submit) — 72px minimum */
  .io-critical-action,
  button[data-critical="true"],
  [role="button"][data-critical="true"] {
    min-height: 72px;
    min-width: 72px;
  }

  /* Form inputs — taller tap zone */
  input[type="text"],
  input[type="number"],
  input[type="email"],
  input[type="password"],
  textarea {
    min-height: 60px;
  }
}

/* ============================================================
   Print stylesheet — color normalization (doc 06)
   ============================================================ */

@media print {
  :root {
    --io-surface-primary: #ffffff;
    --io-surface-secondary: #f9fafb;
    --io-surface-elevated: #ffffff;
    --io-surface: #ffffff;
    --io-text-primary: #111827;
    --io-text-secondary: #374151;
    --io-text-muted: #6b7280;
    --io-border: #d1d5db;
    /* Alarm colors preserved (semantic meaning must survive print) */
  }

  body {
    background: #ffffff;
    color: #111827;
  }

  /* Hide navigation chrome */
  .io-sidebar,
  .io-topbar,
  .io-toolbar,
  [role="navigation"] {
    display: none !important;
  }
}

/* Canonical Mode A (view) node selection glow — docs/decisions/selection-behavior.md */
[data-node-id].io-node-selected {
  filter: drop-shadow(
      0 0 3px color-mix(in srgb, var(--io-accent) 80%, transparent)
    )
    drop-shadow(0 0 6px color-mix(in srgb, var(--io-accent) 40%, transparent));
}

/* Designer Mode B multi-select: glow on actual shape geometry, not an overlay rect */
svg.io-multiselect-active [data-node-id].io-selected {
  filter: drop-shadow(
      0 0 3px color-mix(in srgb, var(--io-accent) 80%, transparent)
    )
    drop-shadow(0 0 6px color-mix(in srgb, var(--io-accent) 40%, transparent));
}

--- File: /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx ---
/**
 * DesignerCanvas.tsx
 *
 * The main SVG canvas for the Designer module.
 * Renders the scene graph as React SVG elements.
 * Handles mouse interaction for select, draw, pan, and pipe tools.
 * Writes selection to uiStore so DesignerRightPanel can reactively subscribe.
 *
 * IMPORTANT: This replaces the older SVG.js-based implementation.
 * All mutations go through SceneCommands + historyStore.
 */

import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useState,
  useMemo,
  lazy,
  Suspense,
} from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import {
  useSceneStore,
  useUiStore,
  useHistoryStore,
  useLibraryStore,
  useTabStore,
  snapToGridValue,
} from "../../store/designer";
import type { SmartGuide } from "../../store/designer/uiStore";
import type { NodeId } from "../../shared/types/graphics";
import type {
  SceneNode,
  SceneNodeType,
  GraphicDocument,
  GraphicExpression,
  Primitive,
  Pipe,
  TextBlock,
  SymbolInstance,
  DisplayElement,
  ImageNode,
  Group,
  EmbeddedSvgNode,
  Stencil,
  Annotation,
  Transform,
  WidgetNode,
  PointBinding,
  DisplayElementType,
  DisplayElementConfig,
  FillGaugeConfig,
  AnalogBarConfig,
  TextReadoutConfig,
  TextReadoutArrayConfig,
  PointNameLabelConfig,
} from "../../shared/types/graphics";
import {
  AddNodeCommand,
  DeleteNodesCommand,
  DuplicateNodesCommand,
  GroupNodesCommand,
  UngroupCommand,
  MoveNodesCommand,
  PasteNodesCommand,
  ReorderNodeCommand,
  RotateNodesCommand,
  FlipNodesCommand,
  ResizePrimitiveCommand,
  ResizeNodeCommand,
  ResizeNodeWithDimsCommand,
  ChangeShapeVariantCommand,
  ChangeShapeConfigurationCommand,
  AddDisplayElementCommand,
  ChangeBindingCommand,
  ChangePropertyCommand,
  CompoundCommand,
  SnapSidecarToSlotCommand,
  HideDisplayElementCommand,
  ResetDisplayElementCommand,
  ReorderSidecarCommand,
  RemoveDisplayElementCommand,
} from "../../shared/graphics/commands";
import type { SceneCommand } from "../../shared/graphics/commands";
import { PIPE_SERVICE_COLORS } from "../../shared/types/graphics";
import { routePipe } from "../../shared/graphics/pipeRouter";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../../shared/hooks/usePermission";
import { SaveAsStencilDialog } from "./components/SaveAsStencilDialog";
import { PromoteToShapeWizard } from "./components/PromoteToShapeWizard";
import PointPickerModal from "./components/PointPickerModal";
import {
  ShapeDropDialog,
  type PlacedShapeConfig,
  displayConfigToUserConfig,
  userConfigToDisplayConfig,
} from "./components/ShapeDropDialog";
import { CategoryShapeWizard } from "./components/CategoryShapeWizard";
import {
  resolveNamedSlot,
  resolveSlotWithSidecar,
  isInsideFillSidecar,
  resolveShapeAnchorSlots,
} from "../../shared/graphics/anchorSlots";
import {
  applyDeSlotOffset,
  resolveSidecarCollisions,
  resolveSingleSidecarAgainstFixed,
  DE_TO_SIDECAR_KEY,
  EXCLUDED_COLLISION_SLOTS,
  type SidecarInput,
  type DeLayoutHints,
} from "../../shared/graphics/sidecarCollision";
import {
  computeSnapTarget,
  type SlotTarget,
} from "../../shared/graphics/useSnapToSlot";
import { useThemeName } from "../../shared/theme/ThemeContext";
import { SceneRenderer } from "../../shared/graphics/SceneRenderer";
import {
  buildTransform as sharedBuildTransform,
  getNodeRotationPivot as sharedGetNodeRotationPivot,
  buildExteriorSidecarTransform,
} from "../../shared/graphics/nodeTransforms";
import {
  renderPrimitiveSvg,
  renderTextBlockSvg,
  renderAnnotationSvg,
  renderImageSvg,
  renderEmbeddedSvgSvg,
  renderStencilSvg,
  renderWidgetPlaceholderSvg,
  renderPipeSvg,
  renderDisplayElementSvg,
  renderGroupSvg,
  renderSymbolInstanceSvg,
  formatDesignPlaceholder,
  deFontToCss,
  type RenderContext,
  type StencilRenderContext,
  type PipeRenderContext,
  type DisplayElementRenderContext,
  type SymbolInstanceRenderContext,
  type GroupRenderContext,
} from "../../shared/graphics/renderNodeSvg";
import { useSelectionZone } from "../../store/useSelectionZone";
import {
  usePasteTarget,
  useIOClipboardStore,
  usePasteEngine,
  findTargetForZone,
  type PasteMode,
} from "../../shared/clipboard";
import { useGlobalSelectionStore } from "../../store/globalSelectionStore";
import { createDesignerPasteTarget } from "./clipboard/designerPasteTarget";
import { copyDesignerSelection } from "./clipboard/designerCopyHandler";
import type { ChartTypeId } from "../../shared/components/charts/chart-config-types";
import { makeDefaultChartConfig } from "../../shared/components/charts/chart-defaults";
import type { ChartConfig } from "../../shared/components/charts/chart-config-types";
const ChartConfigPanel = lazy(
  () => import("../../shared/components/charts/ChartConfigPanel"),
);
import { CHART_DEFINITIONS } from "../../shared/components/charts/chart-definitions";
import ChartRenderer from "../../shared/components/charts/ChartRenderer";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerCanvasProps {
  className?: string;
  style?: React.CSSProperties;
  onPropertiesOpen?: () => void;
  /** Called when the user selects "Open in Tab" on a group node. */
  onOpenGroupInTab?: (groupNodeId: NodeId, groupName: string) => void;
  /**
   * When non-null, the canvas is in "group sub-tab" mode.
   * Only the children of this group node are rendered.
   */
  groupSubTabNodeId?: NodeId | null;
}

// ---------------------------------------------------------------------------
// Resize handle positions (8-point: 4 corners + 4 edge midpoints)
// ---------------------------------------------------------------------------

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const RESIZE_HANDLES: Array<{
  id: ResizeHandle;
  cx: number;
  cy: number;
  cursor: string;
}> = [
  { id: "nw", cx: 0, cy: 0, cursor: "nw-resize" },
  { id: "n", cx: 0.5, cy: 0, cursor: "n-resize" },
  { id: "ne", cx: 1, cy: 0, cursor: "ne-resize" },
  { id: "e", cx: 1, cy: 0.5, cursor: "e-resize" },
  { id: "se", cx: 1, cy: 1, cursor: "se-resize" },
  { id: "s", cx: 0.5, cy: 1, cursor: "s-resize" },
  { id: "sw", cx: 0, cy: 1, cursor: "sw-resize" },
  { id: "w", cx: 0, cy: 0.5, cursor: "w-resize" },
];

// Natural world angle (degrees, 0=right clockwise) from element center to each
// handle at 0° rotation. Used by cursor functions to pick the correct axis.
const HANDLE_ANGLES: Record<ResizeHandle, number> = {
  n: 270,
  ne: 315,
  e: 0,
  se: 45,
  s: 90,
  sw: 135,
  w: 180,
  nw: 225,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RULER_SIZE = 16; // px — thickness of ruler strips (also used by RulersOverlay)

// ---------------------------------------------------------------------------
// Ramer-Douglas-Peucker path simplification for freehand draw
// ---------------------------------------------------------------------------

function ptLineDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdpSimplify(
  pts: Array<{ x: number; y: number }>,
  eps: number,
): Array<{ x: number; y: number }> {
  if (pts.length <= 2) return pts;
  let maxD = 0,
    maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = ptLineDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) {
      maxD = d;
      maxI = i;
    }
  }
  if (maxD > eps) {
    const l = rdpSimplify(pts.slice(0, maxI + 1), eps);
    const r = rdpSimplify(pts.slice(maxI), eps);
    return [...l.slice(0, -1), ...r];
  }
  return [pts[0], pts[pts.length - 1]];
}

// ---------------------------------------------------------------------------
// Selection state — written to uiStore; selectedIdsRef is a synchronous cache
// kept in sync with the store so callbacks can read without triggering renders.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Group naming helpers
// ---------------------------------------------------------------------------

/** Returns "Group N" where N is one higher than the max existing "Group N" name */
function nextGroupName(doc: GraphicDocument): string {
  let max = 0;
  function scan(nodes: SceneNode[]) {
    for (const n of nodes) {
      const m = n.name?.match(/^Group (\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1]));
      if ("children" in n && Array.isArray(n.children)) {
        scan(n.children as SceneNode[]);
      }
    }
  }
  scan(doc.children);
  return `Group ${max + 1}`;
}

// ---------------------------------------------------------------------------
// NameGroupPrompt — small native <dialog> for naming/renaming groups
// ---------------------------------------------------------------------------

interface NameGroupPromptProps {
  defaultName: string;
  title?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function NameGroupPrompt({
  defaultName,
  title = "Name Group",
  onConfirm,
  onCancel,
}: NameGroupPromptProps) {
  const [value, setValue] = React.useState(defaultName);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  function handleConfirm() {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  }

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: "var(--io-z-modal)",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const dialogStyle: React.CSSProperties = {
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    padding: "20px",
    minWidth: 280,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
  const titleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--io-text-primary)",
    margin: 0,
  };
  const inputStyleLocal: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    background: "var(--io-surface-sunken)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    color: "var(--io-text-primary)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };
  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
  };
  const btnBase: React.CSSProperties = {
    padding: "5px 14px",
    fontSize: 12,
    cursor: "pointer",
    borderRadius: "var(--io-radius)",
    border: "1px solid var(--io-border)",
    background: "transparent",
    color: "var(--io-text-secondary)",
  };
  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: "var(--io-accent)",
    color: "#09090b",
    border: "none",
    fontWeight: 600,
  };

  return (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={dialogStyle} onMouseDown={(e) => e.stopPropagation()}>
        <p style={titleStyle}>{title}</p>
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyleLocal}
          placeholder="Group name"
        />
        <div style={rowStyle}>
          <button style={btnBase} onClick={onCancel}>
            Cancel
          </button>
          <button
            style={btnPrimary}
            onClick={handleConfirm}
            disabled={!value.trim()}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node bounding box (canvas coordinates)
// ---------------------------------------------------------------------------

export function getNodeBounds(node: SceneNode): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const { x, y } = node.transform.position;
  if (node.type === "primitive") {
    const p = node as Primitive;
    if (p.geometry.type === "rect")
      return { x, y, w: p.geometry.width, h: p.geometry.height };
    if (p.geometry.type === "ellipse")
      return {
        x: x - p.geometry.rx,
        y: y - p.geometry.ry,
        w: p.geometry.rx * 2,
        h: p.geometry.ry * 2,
      };
    if (p.geometry.type === "line") {
      const minX = Math.min(p.geometry.x1, p.geometry.x2);
      const minY = Math.min(p.geometry.y1, p.geometry.y2);
      return {
        x: x + minX,
        y: y + minY,
        w: Math.abs(p.geometry.x2 - p.geometry.x1) || 4,
        h: Math.abs(p.geometry.y2 - p.geometry.y1) || 4,
      };
    }
  }
  if (node.type === "text_block") {
    const tb = node as TextBlock;
    // Ensure minimum hit target size (40x20) for reliable right-click detection on small text
    const minW = 40,
      minH = 20;
    const w = Math.max(tb.maxWidth ?? 120, minW);
    const h = Math.max(tb.fontSize ? tb.fontSize * 2 : 20, minH);
    return { x, y, w, h };
  }
  if (node.type === "image") {
    const img = node as ImageNode;
    return { x, y, w: img.displayWidth, h: img.displayHeight };
  }
  if (node.type === "pipe") {
    const pipe = node as Pipe;
    if (pipe.waypoints && pipe.waypoints.length >= 2) {
      const xs = pipe.waypoints.map((p) => p.x);
      const ys = pipe.waypoints.map((p) => p.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs) || 4,
        h: Math.max(...ys) - Math.min(...ys) || 4,
      };
    }
  }
  if (node.type === "widget") {
    const wn = node as WidgetNode;
    return { x, y, w: wn.width, h: wn.height };
  }
  if (node.type === "embedded_svg") {
    const esn = node as EmbeddedSvgNode;
    return { x, y, w: esn.width || 64, h: esn.height || 64 };
  }
  if (node.type === "symbol_instance") {
    const si = node as SymbolInstance;
    const shapeData = useLibraryStore.getState().getShape(si.shapeRef.shapeId);
    const geo = shapeData?.sidecar.geometry;
    const naturalW = geo?.baseSize?.[0] ?? geo?.width ?? 64;
    const naturalH = geo?.baseSize?.[1] ?? geo?.height ?? 64;
    return {
      x,
      y,
      w: naturalW * (si.transform.scale.x ?? 1),
      h: naturalH * (si.transform.scale.y ?? 1),
    };
  }
  if (node.type === "stencil") {
    const st = node as Stencil;
    return { x, y, w: st.size?.width ?? 48, h: st.size?.height ?? 24 };
  }
  if (node.type === "display_element") {
    const de = node as DisplayElement;
    const cfg = de.config;
    switch (cfg.displayType) {
      case "text_readout": {
        const tCfg = cfg as TextReadoutConfig;
        const pnEnabled = tCfg.pointNameRow?.enabled ?? false;
        const dnEnabled = tCfg.displayNameRow?.enabled ?? false;
        const numRows = (pnEnabled ? 1 : 0) + (dnEnabled ? 1 : 0) + 1;
        const ROW_H = 16,
          GAP = 2;
        const boxW = tCfg.minWidth ?? 40;
        return { x, y, w: boxW, h: numRows * ROW_H + (numRows - 1) * GAP };
      }
      case "analog_bar":
        // Design preview: bar body is 18px wide. Zone labels (HH/H/L/LL) sit at
        // x=-3 textAnchor=end and extend ~15px to the left of the DE origin.
        // The pointer triangle extends 7px to the right of the bar (to x=25).
        // Bounds must cover this full visual range: -15 to +25 = 40px wide.
        return { x: x - 15, y, w: 40, h: cfg.barHeight ?? 80 };
      case "fill_gauge":
        return { x, y, w: cfg.barWidth ?? 24, h: cfg.barHeight ?? 80 };
      case "sparkline":
        return { x, y, w: cfg.sparkWidth ?? 110, h: cfg.sparkHeight ?? 18 };
      case "alarm_indicator":
        // Design preview: 24×18 rect centered at origin (x: -12..12, y: -9..9).
        return { x: x - 12, y: y - 9, w: 24, h: 18 };
      case "digital_status": {
        // Design preview width tracks content: "AUTO" (bound) → 36px, "—" → 18px.
        const stateText = de.binding.pointId ? "AUTO" : "—";
        return { x, y, w: stateText.length * 6 + 12, h: 20 };
      }
      case "text_readout_array": {
        const aCfg = cfg as TextReadoutArrayConfig;
        const n = Math.max(1, 1 + (aCfg.additionalBindings?.length ?? 0));
        const gap = aCfg.itemSpacing ?? 2;
        const layout = aCfg.arrayLayout ?? "vertical";
        const singleLine = aCfg.singleLine ?? false;
        const pnEnabled = aCfg.pointNameRow?.enabled ?? false;
        const dnEnabled = aCfg.displayNameRow?.enabled ?? false;
        const itemRows = singleLine
          ? 1
          : 1 + (pnEnabled ? 1 : 0) + (dnEnabled ? 1 : 0);
        const ROW_H = 16,
          ROW_GAP = 2;
        const itemH = itemRows * ROW_H + (itemRows - 1) * ROW_GAP;
        const itemW = aCfg.minWidth ?? 40;
        if (layout === "vertical") {
          return { x, y, w: itemW, h: n * itemH + (n - 1) * gap };
        } else {
          return { x, y, w: n * itemW + (n - 1) * gap, h: itemH };
        }
      }
      case "point_name_label": {
        const fs = (cfg as PointNameLabelConfig).fontSize ?? 10;
        return { x, y, w: 80, h: fs + 2 };
      }
      default:
        return { x, y, w: 80, h: 24 };
    }
  }
  if (node.type === "annotation") {
    const an = node as import("../../shared/types/graphics").Annotation;
    // Ensure minimum hit target size (32x32) for reliable right-click detection
    const minSize = 32;
    const w = Math.max(an.width || minSize, minSize);
    const h = Math.max(an.height || minSize, minSize);
    return { x, y, w, h };
  }
  if (node.type === "group") {
    const grp = node as Group;
    if (!grp.children || grp.children.length === 0) {
      return { x, y, w: 64, h: 64 };
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const child of grp.children) {
      const cb = getNodeBounds(child);
      if (cb.x < minX) minX = cb.x;
      if (cb.y < minY) minY = cb.y;
      if (cb.x + cb.w > maxX) maxX = cb.x + cb.w;
      if (cb.y + cb.h > maxY) maxY = cb.y + cb.h;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  // Default generous bbox for stencils, etc.
  return { x, y, w: 64, h: 64 };
}

// Returns the rotation pivot in "post-scale local" space for center-pivot rotation.
// Delegates to shared nodeTransforms utility, providing libraryStore shape lookup.
function designerShapeSizeLookup(
  shapeId: string,
): { w: number; h: number } | null {
  const shapeData = useLibraryStore.getState().getShape(shapeId);
  if (!shapeData) return null;
  const geo = shapeData.sidecar.geometry;
  const w = geo?.baseSize?.[0] ?? geo?.width ?? 64;
  const h = geo?.baseSize?.[1] ?? geo?.height ?? 64;
  return { w, h };
}

function getNodeRotationPivot(node: SceneNode): { x: number; y: number } {
  return sharedGetNodeRotationPivot(node, designerShapeSizeLookup);
}

function computeGroupBBox(nodes: SceneNode[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    const b = getNodeBounds(n);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  if (minX === Infinity) return { x: 0, y: 0, w: 64, h: 64 };
  return {
    x: minX,
    y: minY,
    w: Math.max(maxX - minX, 4),
    h: Math.max(maxY - minY, 4),
  };
}

function boundsContains(
  b: { x: number; y: number; w: number; h: number },
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  return b.x >= rx && b.y >= ry && b.x + b.w <= rx + rw && b.y + b.h <= ry + rh;
}

// ---------------------------------------------------------------------------
// Find the parent node of a given node ID in the scene tree
// ---------------------------------------------------------------------------

function getNodeParent(nodeId: NodeId, nodes: SceneNode[]): SceneNode | null {
  for (const n of nodes) {
    if ("children" in n && Array.isArray(n.children)) {
      const children = n.children as SceneNode[];
      if (children.some((c) => c.id === nodeId)) return n;
      const found = getNodeParent(nodeId, children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Like getNodeBounds but adds the parent symbol_instance's position for
 * display_element children (whose transform.position is parent-relative).
 * All other nodes return the same result as getNodeBounds.
 */
function getNodeAbsoluteBounds(
  node: SceneNode,
  docChildren: SceneNode[],
): { x: number; y: number; w: number; h: number } {
  const b = getNodeBounds(node);
  if (node.type === "display_element") {
    const parent = getNodeParent(node.id, docChildren);
    if (parent?.type === "symbol_instance") {
      const pp = parent.transform.position;
      const sx = parent.transform.scale?.x ?? 1;
      const sy = parent.transform.scale?.y ?? 1;
      return {
        x: b.x * sx + pp.x,
        y: b.y * sy + pp.y,
        w: b.w * sx,
        h: b.h * sy,
      };
    }
  }
  return b;
}

/**
 * Like getNodeAbsoluteBounds but uses the sidecar's selectionBounds (if defined)
 * for symbol_instance nodes. This gives a tighter visual rect that hugs the
 * shape body rather than the full viewBox, which can include large padding for
 * process equipment (reactors, tanks, etc.).
 *
 * Does NOT affect resize handles or hit-testing — those use getNodeBounds /
 * getNodeAbsoluteBounds as before.
 */
function getNodeVisualBounds(
  node: SceneNode,
  docChildren: SceneNode[],
): { x: number; y: number; w: number; h: number } {
  if (node.type === "symbol_instance") {
    const si = node as SymbolInstance;
    const shapeData = useLibraryStore.getState().getShape(si.shapeRef.shapeId);
    const sel = shapeData?.sidecar.geometry?.selectionBounds;
    if (sel) {
      const { x, y } = si.transform.position;
      const sx = si.transform.scale.x ?? 1;
      const sy = si.transform.scale.y ?? 1;
      return {
        x: x + sel.x * sx,
        y: y + sel.y * sy,
        w: sel.w * sx,
        h: sel.h * sy,
      };
    }
  }
  return getNodeAbsoluteBounds(node, docChildren);
}

// ---------------------------------------------------------------------------
// Test mode: pause/play state lives in uiStore; overlay is SceneRenderer
// (see DesignerCanvas render — the SceneRenderer overlay block)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SVG transform string builder — delegates to shared nodeTransforms utility
// ---------------------------------------------------------------------------

const buildTransform = sharedBuildTransform;

// ---------------------------------------------------------------------------
// Primitive geometry → SVG element
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DisplayElement renderer — static (design) and live (test mode)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TextReadoutDE — text_readout display element with real SVG text measurement.
// Uses useLayoutEffect + getComputedTextLength() so box width is always exact
// regardless of EU string length, font, or font size.
// ---------------------------------------------------------------------------
function TextReadoutDE({
  de,
  tx,
  valueStr,
  euStr,
  mode,
  stale = false,
  onContextMenu,
}: {
  de: DisplayElement;
  tx: string;
  valueStr: string; // formatted value or "—" placeholder
  euStr: string; // EU unit WITHOUT leading space, or ""
  mode: "design" | "live";
  stale?: boolean;
  onContextMenu?: (e: React.MouseEvent<SVGGElement>) => void;
}) {
  const cfg = de.config as TextReadoutConfig;
  const minW = cfg.minWidth ?? 40;
  const [boxW, setBoxW] = useState(minW);
  const textRef = useRef<SVGTextElement>(null);

  const ROW_H = 16;
  const GAP = 2;
  const pnEnabled = cfg.pointNameRow?.enabled ?? false;
  const dnEnabled = cfg.displayNameRow?.enabled ?? false;
  const euEnabled = !!euStr;
  const labelRows = (pnEnabled ? 1 : 0) + (dnEnabled ? 1 : 0);
  const totalH = labelRows * (ROW_H + GAP) + ROW_H;

  // Size the box on the value+EU text only — label rows (point name, display name)
  // are centered in the same width and may overflow, matching console/graphics behavior.
  // getComputedTextLength() is exact for mixed-font tspans (JetBrains Mono value + Inter EU).
  const measure = useCallback(() => {
    let maxW = minW;
    const PAD = 12; // 6px each side
    if (textRef.current)
      maxW = Math.max(
        maxW,
        Math.ceil(textRef.current.getComputedTextLength()) + PAD,
      );
    setBoxW(maxW);
  }, [minW]);

  // Re-measure whenever value or EU changes.
  useLayoutEffect(() => {
    measure();
  }, [measure, valueStr, euStr]);

  // Re-measure once fonts finish loading — first render may use fallback metrics
  // if the web font (JetBrains Mono) hasn't been fetched yet.
  useEffect(() => {
    document.fonts.ready.then(() => measure());
  }, [measure]);

  // applyDeSlotOffset bakes x -= 20 (half of 40px assumed box) into position.x
  // for horizontal slots. Compensate with the actual measured width.
  const hOff = Math.round(-boxW / 2);

  const isLive = mode === "live";
  const vR = cfg.valueRow;
  const vFs = vR?.fontSize ?? 11;
  const textFill = stale ? "#6b7280" : vR?.color || "var(--io-text-primary)";
  const euFill = stale ? "#6b7280" : "var(--io-text-muted)";
  const boxFill = isLive ? "rgba(0,0,0,0.6)" : "#27272A";
  const boxStroke = isLive
    ? stale
      ? "#6b7280"
      : "var(--io-accent)"
    : "#3F3F46";
  const strokeW = isLive ? 0.5 : 1;

  const rows: React.ReactNode[] = [];
  let yOff = 0;

  if (pnEnabled) {
    const r = cfg.pointNameRow!;
    if (r.showBackground) {
      rows.push(
        <rect
          key="pn-bg"
          x={0}
          y={yOff}
          width={boxW}
          height={ROW_H}
          fill={isLive ? "rgba(0,0,0,0.5)" : "#1E293B"}
          rx={1}
        />,
      );
    }
    rows.push(
      <text
        key="pn-tx"
        x={boxW / 2}
        y={yOff + ROW_H - 4}
        textAnchor="middle"
        fontSize={r.fontSize}
        fontWeight={r.fontWeight ?? "normal"}
        fill={stale ? "#6b7280" : r.color || "var(--io-text-primary)"}
        fontFamily={deFontToCss(r.fontFamily)}
      >
        {de.binding.pointTag ?? (isLive ? "—" : "TAG.NAME")}
      </text>,
    );
    yOff += ROW_H + GAP;
  }

  if (dnEnabled) {
    const r = cfg.displayNameRow!;
    if (r.showBackground) {
      rows.push(
        <rect
          key="dn-bg"
          x={0}
          y={yOff}
          width={boxW}
          height={ROW_H}
          fill={isLive ? "rgba(0,0,0,0.5)" : "#1E293B"}
          rx={1}
        />,
      );
    }
    rows.push(
      <text
        key="dn-tx"
        x={boxW / 2}
        y={yOff + ROW_H - 4}
        textAnchor="middle"
        fontSize={r.fontSize}
        fontWeight={r.fontWeight ?? "normal"}
        fill={stale ? "#6b7280" : r.color || "var(--io-text-secondary)"}
        fontFamily={deFontToCss(r.fontFamily)}
      >
        {de.binding.displayName ?? (isLive ? "—" : "Display Name")}
      </text>,
    );
    yOff += ROW_H + GAP;
  }

  if (cfg.showBox !== false) {
    rows.push(
      <rect
        key="v-bg"
        x={0}
        y={yOff}
        width={boxW}
        height={ROW_H}
        fill={boxFill}
        stroke={boxStroke}
        strokeWidth={strokeW}
        rx={1}
      />,
    );
  }

  // The ref is on the value text so getComputedTextLength() measures value+EU together.
  rows.push(
    <text
      key="v-tx"
      ref={textRef}
      x={boxW / 2}
      y={yOff + ROW_H - 4}
      textAnchor="middle"
      fontSize={vFs}
      fontWeight={vR?.fontWeight ?? "normal"}
      fill={textFill}
      fontFamily={deFontToCss(vR?.fontFamily)}
      fontVariant="tabular-nums"
    >
      {valueStr}
      {euEnabled && (
        <tspan fontFamily="Inter" fontSize={9} fill={euFill}>
          {" "}
          {euStr}
        </tspan>
      )}
    </text>,
  );

  // Outer <g> carries the counter-rotation transform (data-node-id lets the
  // rotation drag handler update just this attribute without touching the inner
  // centering translate). Inner <g> holds the fixed hOff centering shift so
  // it is never overwritten by direct DOM mutations during rotation preview.
  return (
    <g
      transform={tx}
      data-node-id={de.id}
      data-canvas-x={String(Math.round(de.transform.position.x))}
      data-canvas-y={String(Math.round(de.transform.position.y))}
      opacity={de.opacity}
      onContextMenu={onContextMenu}
    >
      <g transform={`translate(${hOff},0)`}>
        <rect x={0} y={0} width={boxW} height={totalH} rx={2} fill="none" />
        {rows}
      </g>
    </g>
  );
}

function DisplayE

--- File: /home/io/io-dev/io/ui-audit/11-zindex-assessment.md ---
# Z-Index Assessment — DesignerCanvas Token Remap

**Date:** 2026-05-28  
**Status:** COMPLETE — all 19 remaps applied 2026-05-28. Two new tokens added to permanent scale.  
**Sources:** `ui-audit/00-preflight-facts.md §2`, `frontend/src/index.css:207–218`

---

## Permanent Token Scale (reference)

| Token | Value | Added |
|-------|-------|-------|
| `--io-z-base` | 0 | original |
| `--io-z-panel` | 10 | original |
| `--io-z-sidebar` | 100 | original |
| `--io-z-topbar` | 100 | original |
| `--io-z-edge-hover` | 150 | original |
| `--io-z-dropdown` | 500 | original |
| `--io-z-canvas-overlay` | 600 | **2026-05-28** — canvas-internal badge/tooltip overlays; above dropdowns, below modals |
| `--io-z-modal` | 1000 | original |
| `--io-z-priority-modal` | 1050 | **2026-05-28** — app-level confirmation dialogs (ConfirmDialog); guaranteed above canvas dialogs at --io-z-modal |
| `--io-z-command` | 1200 | original |
| `--io-z-visual-lock` | 1500 | original |
| `--io-z-kiosk-auth` | 1800 | original |
| `--io-z-toast` | 2000 | original |
| `--io-z-emergency` | 3000 | original |

---

## Part One — Tier Classification

### Tier A: Base canvas chrome (10 elements)

Elements that only need to stack correctly within the canvas's own stacking context. Their z-values compete only against each other inside the canvas div hierarchy, not globally. All are below 100.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 7689 | -1 | SVG guide/grid line | Intentionally below canvas surface; background grid that must not interfere with any canvas element |
| 7994 | 10 | Canvas container overlay div | Base layer of canvas chrome; the lowest overlay inside the canvas |
| 8222 | 10 | Element tooltip | Inline hover tooltip on canvas elements; canvas-internal, small, transient |
| 8302 | 15 | Selection highlight overlay | Thin inset overlay drawn on selected elements; above element but below editing chrome |
| 8377 | 20 | Inline text editor | In-place text edit overlay; must be above selection highlight during editing |
| 9792 | 10 | Ruler bar (top) | Canvas chrome — ruler drawn at top edge |
| 9814 | 10 | Ruler bar (left) | Canvas chrome — ruler drawn at left edge |
| 9837 | 11 | Ruler corner tile | Sits just above the two ruler bars at their intersection; covers seam |
| 9863 | 9 | Vertical guide drag handle | Guide handle must be draggable; sits just below rulers so rulers draw on top |
| 9876 | 9 | Horizontal guide drag handle | Same — just below rulers |

These ten elements establish the relative stacking order: guides (9) < canvas content (10) ≈ rulers (10) < corner (11) < selection (15) < text editor (20). This ordering is internally consistent and must be preserved.

---

### Tier B: Canvas-spawned badge/overlay elements (3 elements)

Three elements at exactly z=1000 — the same value as `--io-z-modal` / ConfirmDialog. All are described as "canvas-internal overlay/badge" or "tooltip/inline overlay" with `fontSize:12, overflow:hidden`. These are small annotation or data overlays pinned to canvas elements. They are NOT dialog-level UI. Their presence at 1000 is the direct cause of the ConfirmDialog stacking tie.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 8038 | 1000 | Canvas-internal overlay/badge | Small badge annotation on a canvas element; canvas-internal, non-blocking |
| 9917 | 1000 | Tooltip/inline overlay | Same pattern — canvas data annotation overlay |
| 10271 | 1000 | Tooltip/inline overlay | Same pattern — canvas data annotation overlay |

These are semantically sub-modal. They are annotations that float above the canvas but should never compete with app-level confirmation dialogs. ConfirmDialog must always win against these.

---

### Tier C: Canvas-spawned dialogs and popovers (5 elements)

Elements that are `position:fixed` or floating above canvas content with dialog/popover semantics. These are the canvas's own "modal layer" — UI that the canvas spawns to handle configuration, assignment, or status display.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 8621 | 1200 | Fixed full-screen dialog backdrop | Canvas-spawned blocking dialog; position:fixed, rgba(0,0,0,0.55) scrim |
| 332 | 2000 | Fixed full-screen modal backdrop | A second canvas-spawned blocking modal, higher priority than 8621 — appears on top of it |
| 9426 | 2000 | Slot assignment popover | Non-scrim floating popover for slot assignment; elevated surface background |
| 9605 | 2000 | Canvas bottom status/toolbar overlay | Persistent floating HUD at canvas bottom; centered via transform:translateX(-50%) |

**Note on the two fixed backdrops (332 and 8621):** These are two separate canvas-spawned dialogs. The ordering (8621 at 1200, 332 at 2000) implies 332's dialog sits on top of 8621's dialog when both render — a layered dialog pattern. By design, only one is visible at a time. Their exact z-ordering relative to each other is an internal canvas concern.

**Note on 9605 (canvas toolbar HUD):** Though it uses z=2000 (matching the toast layer), it is persistent canvas chrome — not a toast or dialog. Its high value ensures it renders above canvas elements and any canvas badge overlays. Semantically it belongs closer to the dropdown layer (floating UI above content, not above modals).

---

### Tier D: Full-screen capture overlays (2 elements)

Elements that intentionally take over the entire screen for a capture interaction. Must appear above everything else including canvas dialogs.

| Line | Value | Element | Rationale |
|------|-------|---------|-----------|
| 8928 | 3000 | Point picker full-screen overlay | Full-screen crosshair mode for selecting a data point; must be above all canvas UI |
| 3750 | 9999 | Drag-cursor overlay | Transient drag tracking cursor; `pointer-events:none`; must be above all UI including emergency overlays |

---

## Part Two — Proposed Token Mapping

### Tier A: Base canvas chrome → `--io-z-panel` and calc offsets

All Tier A elements preserve their exact integer values; they merely adopt tokens. The calc offsets maintain the same stacking order.

| Line | Current | Proposed | Computed value | Preserves order? |
|------|---------|---------|---------------|-----------------|
| 7689 | -1 | `calc(var(--io-z-base) - 1)` | -1 | Yes |
| 7994 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 8222 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 8302 | 15 | `calc(var(--io-z-panel) + 5)` | 15 | Yes |
| 8377 | 20 | `calc(var(--io-z-panel) + 10)` | 20 | Yes |
| 9792 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 9814 | 10 | `var(--io-z-panel)` | 10 | Yes |
| 9837 | 11 | `calc(var(--io-z-panel) + 1)` | 11 | Yes |
| 9863 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | Yes |
| 9876 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | Yes |

### Tier B: Canvas badge/overlay → `--io-z-dropdown` (500)

These three elements at 1000 must move below `--io-z-modal` to resolve the ConfirmDialog ties. `--io-z-dropdown` (500) is the correct tier: above canvas chrome (sub-20), above app sidebars/topbars (100), but clearly below any modal dialog.

**Key question:** should these sit at `--io-z-dropdown` (500) or closer to modal (e.g., 999)?

Recommendation: `var(--io-z-dropdown)` = 500. Using 500 creates unambiguous separation from the modal layer. Using a calc like `calc(var(--io-z-modal) - 1)` = 999 would maintain proximity to the modal layer with no semantic justification — these are badge overlays, not near-modal UI. The full 500-point gap makes intent legible.

**See Scale Gap #1** — the scale has no named token between dropdown (500) and modal (1000) for canvas-internal floating content. These elements would be the first users of such a token if one were added.

| Line | Current | Proposed | Computed value |
|------|---------|---------|---------------|
| 8038 | 1000 | `var(--io-z-dropdown)` | 500 |
| 9917 | 1000 | `var(--io-z-dropdown)` | 500 |
| 10271 | 1000 | `var(--io-z-dropdown)` | 500 |

### Tier C: Canvas dialogs and popovers

This tier contains the most complex decisions because two canvas "dialogs" are currently above ConfirmDialog, and moving them to `--io-z-modal` creates ties that depend on DOM order.

**Core principle:** Canvas-spawned dialogs are functionally equivalent to app modals. They should use `--io-z-modal` (1000). ConfirmDialog also uses `--io-z-modal` (1000). If ConfirmDialog renders via `createPortal` to `document.body`, it is appended later in the DOM than canvas dialogs and wins the tie. This is fragile but workable — see **Scale Gap #3** for the clean fix.

| Line | Current | Proposed | Computed value | Notes |
|------|---------|---------|---------------|-------|
| 8621 | 1200 | `var(--io-z-modal)` | 1000 | Fixed dialog backdrop. Currently at `--io-z-command` level (accidental match). Moves down 200. |
| 332 | 2000 | `var(--io-z-modal)` | 1000 | Fixed modal backdrop (higher-priority canvas dialog). Moves down 1000. Both canvas dialogs now share the modal layer. |
| 9426 | 2000 | `var(--io-z-modal)` | 1000 | Slot assignment popover. Moves down 1000. Popover should be modal-level (it overlays canvas interaction). |
| 9605 | 2000 | `var(--io-z-dropdown)` | 500 | Canvas bottom toolbar HUD. This is persistent chrome, not a dialog — belongs at dropdown level. Dialogs (1000) will correctly obscure it when open. |

**On the two canvas backdrops (332 and 8621) sharing z=1000 after remap:** These two dialogs should never be simultaneously visible by design (one is shown at a time). Their internal ordering (which one the user sees "on top") can be managed by DOM order if they ever overlap. If the canvas always unmounts one before mounting the other, z-ordering between them is moot.

### Tier D: Capture overlays

| Line | Current | Proposed | Computed value | Notes |
|------|---------|---------|---------------|-------|
| 8928 | 3000 | `var(--io-z-emergency)` | 3000 | No numeric change. Point picker legitimately uses the emergency layer — it is a full-screen mode capture. |
| 3750 | 9999 | **Scale gap — see Scale Gap #2** | 9999 | Drag cursor exceeds the scale ceiling. See below. |

---

## Part Three — Scale Gaps Flagged for Decision

### Gap #1: No named token for canvas-internal floating overlays

**Situation:** The three Tier B elements (badge/tooltip overlays at lines 8038, 9917, 10271) need to sit above canvas chrome (sub-20) and app topbars/sidebars (100) but below modal dialogs (1000). The nearest available tokens are `--io-z-dropdown` (500) and `--io-z-modal` (1000).

**Problem:** `--io-z-dropdown` is semantically for UI dropdowns (autocomplete menus, select lists, comboboxes). Canvas annotation badges are a distinct category. Using `var(--io-z-dropdown)` works numerically but conflates canvas chrome with interactive dropdowns.

**Decision needed:** Should a named `--io-z-canvas-overlay` token (e.g., 600) be added to the permanent scale, or is using `--io-z-dropdown` acceptable? A new token affects the eight-module rebuild — all modules would inherit it and potentially need to verify nothing breaks.

**Proposed token if added:** `--io-z-canvas-overlay: 600` — sits above dropdowns (500) and below modals (1000), clearly named for canvas-internal floating content.

---

### Gap #2: No token for above-emergency drag cursors (9999)

**Situation:** The drag cursor overlay (line 3750) is at z=9999, which exceeds the scale ceiling of `--io-z-emergency` (3000). The cursor must appear above everything including emergency overlays (`--io-z-emergency` is for kiosk/security-mode lockouts) because it is a transient visual indicator with `pointer-events:none` — it must never be obscured.

**Problem:** Moving the drag cursor to `var(--io-z-emergency)` = 3000 would make it visually tied with emergency overlays. If an emergency overlay ever renders while a drag is in progress, the cursor could be obscured. More importantly, the 9999 value signals "always on top" intent that the current scale cannot express.

**Decision needed:** One of:
1. Add `--io-z-drag-cursor: 9999` as a permanent, documented "always-on-top for `pointer-events:none` drag indicators" position.
2. Accept that `--io-z-emergency` (3000) is "high enough" — a drag operation and an emergency overlay cannot meaningfully overlap, and the visual difference between 3000 and 9999 is zero in practice.
3. Keep the drag cursor as a documented hardcoded exception at 9999 — it is `pointer-events:none` and fully transient; the exception is narrow and safe.

A new token affects all eight modules. Option 3 (documented hardcoded exception) is the lowest-risk path.

---

### Gap #3: No "priority modal" position between --io-z-modal and --io-z-command

**Situation:** ConfirmDialog is at `--io-z-modal` (1000). Canvas-spawned blocking dialogs should also be at `--io-z-modal` after remap. When ConfirmDialog fires while a canvas dialog is open, both are at 1000 and DOM order determines which appears on top. ConfirmDialog wins only if it is appended to the DOM after the canvas dialog — which is true if it uses `createPortal(el, document.body)`, but is an implicit assumption.

**Problem:** Relying on DOM insertion order for modal priority is fragile. If any future refactor changes portal ordering, ConfirmDialog could silently appear behind canvas dialogs.

**Decision needed:** One of:
1. Add `--io-z-priority-modal: 1050` (or similar, between modal and command) for ConfirmDialog and other app-level confirmation overlays that must always win. Canvas dialogs stay at `--io-z-modal` (1000).
2. Accept the DOM-order dependency — verify ConfirmDialog uses `createPortal` and document the invariant.
3. Move ConfirmDialog to `--io-z-command` (1200). `--io-z-command` is named for the command palette, but in practice ConfirmDialog and the command palette should not overlap; numeric reuse is acceptable. Canvas dialogs at `--io-z-modal` (1000) would then always be below ConfirmDialog.

Option 3 (ConfirmDialog at `--io-z-command`) is the cleanest immediate fix if the DOM-order dependency is undesirable.

---

## Part Four — Risk Assessment Per Remap

| Line | Current | Proposed token | Computed | Risk | Why |
|------|---------|---------------|---------|------|-----|
| 7689 | -1 | `calc(var(--io-z-base) - 1)` | -1 | LOW | Value unchanged; canvas-internal only |
| 7994 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 8222 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 8302 | 15 | `calc(var(--io-z-panel) + 5)` | 15 | LOW | Value unchanged; canvas-internal only |
| 8377 | 20 | `calc(var(--io-z-panel) + 10)` | 20 | LOW | Value unchanged; canvas-internal only |
| 9792 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 9814 | 10 | `var(--io-z-panel)` | 10 | LOW | Value unchanged; canvas-internal only |
| 9837 | 11 | `calc(var(--io-z-panel) + 1)` | 11 | LOW | Value unchanged; canvas-internal only |
| 9863 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | Value unchanged; canvas-internal only |
| 9876 | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | Value unchanged; canvas-internal only |
| 8928 | 3000 | `var(--io-z-emergency)` | 3000 | LOW | Value unchanged; point picker already at emergency layer |
| 8038 | 1000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Canvas badge moves from modal layer to dropdown layer. If ConfirmDialog and this badge render simultaneously, ConfirmDialog now wins. This is the desired fix — but the change in stacking is observable and must be spot-checked. |
| 9917 | 1000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Same as 8038. |
| 10271 | 1000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Same as 8038. |
| 9605 | 2000 | `var(--io-z-dropdown)` | 500 | **HIGH** | Canvas toolbar HUD moves from toast layer (2000) to dropdown layer (500). Any dialog (1000) will now visually obscure the toolbar. This is intended behavior (dialogs block the toolbar) but is a visible stacking change that must be verified. |
| 9426 | 2000 | `var(--io-z-modal)` | 1000 | **HIGH** | Slot assignment popover moves from toast layer (2000) to modal layer (1000). If a canvas blocking dialog (332 or 8621 at 1000) is simultaneously rendered, DOM order determines which wins. Verify these never coexist. |
| 332 | 2000 | `var(--io-z-modal)` | 1000 | MEDIUM | Canvas blocking modal backdrop moves from toast layer to modal layer. Currently it renders above ConfirmDialog (2000 > 1000); after remap, ConfirmDialog can render above it via DOM order. This is an intended fix — ConfirmDialog should win — but requires verifying portal ordering. |
| 8621 | 1200 | `var(--io-z-modal)` | 1000 | MEDIUM | Fixed dialog backdrop moves from command layer (1200) to modal layer (1000). This 200-point reduction is only observable if the command palette (also at 1200) and this canvas backdrop coexist — an extremely unlikely scenario. Verify that neither 332 nor 8621 renders simultaneously (they'd share z=1000 after remap). |
| 3750 | 9999 | Scale gap (no remap yet) | 9999 | FLAGGED | Cannot remap without scale decision. Drag cursor exceeds emergency (3000). Interim recommendation: keep at hardcoded 9999 with a comment until Scale Gap #2 is decided. |

---

## Part Five — Summary

### (a) Applied Remap Table

All 19 remaps applied 2026-05-28. Tier B elements use `--io-z-canvas-overlay` (user decision overrides assessment proposal of `--io-z-dropdown`). Line 3750 kept hardcoded with documented-exception comment.

| Line | Element | Was | Applied token | Computed | Risk | Applied |
|------|---------|-----|--------------|---------|------|---------|
| 332 | Fixed modal backdrop | 2000 | `var(--io-z-modal)` | 1000 | MEDIUM | 2026-05-28 |
| 3750 | Drag cursor overlay | 9999 | hardcoded 9999 + exception comment | 9999 | — | 2026-05-28 |
| 7689 | SVG guide/grid line | -1 | `calc(var(--io-z-base) - 1)` | -1 | LOW | 2026-05-28 |
| 7994 | Canvas container overlay | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 8038 | Canvas badge/overlay | 1000 | `var(--io-z-canvas-overlay)` | 600 | **HIGH** | 2026-05-28 |
| 8222 | Element tooltip | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 8302 | Selection highlight | 15 | `calc(var(--io-z-panel) + 5)` | 15 | LOW | 2026-05-28 |
| 8377 | Inline text editor | 20 | `calc(var(--io-z-panel) + 10)` | 20 | LOW | 2026-05-28 |
| 8621 | Fixed dialog backdrop | 1200 | `var(--io-z-modal)` | 1000 | MEDIUM | 2026-05-28 |
| 8928 | Point picker overlay | 3000 | `var(--io-z-emergency)` | 3000 | LOW | 2026-05-28 |
| 9426 | Slot assignment popover | 2000 | `var(--io-z-modal)` | 1000 | **HIGH** | 2026-05-28 |
| 9605 | Canvas bottom toolbar HUD | 2000 | `var(--io-z-dropdown)` | 500 | **HIGH** | 2026-05-28 |
| 9792 | Ruler bar (top) | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 9814 | Ruler bar (left) | 10 | `var(--io-z-panel)` | 10 | LOW | 2026-05-28 |
| 9837 | Ruler corner tile | 11 | `calc(var(--io-z-panel) + 1)` | 11 | LOW | 2026-05-28 |
| 9863 | Vertical guide drag handle | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | 2026-05-28 |
| 9876 | Horizontal guide drag handle | 9 | `calc(var(--io-z-panel) - 1)` | 9 | LOW | 2026-05-28 |
| 9917 | Tooltip/inline overlay | 1000 | `var(--io-z-canvas-overlay)` | 600 | **HIGH** | 2026-05-28 |
| 10271 | Tooltip/inline overlay | 1000 | `var(--io-z-canvas-overlay)` | 600 | **HIGH** | 2026-05-28 |

### (b) Scale Gaps Requiring User Decision

| # | Gap | Impact | Options |
|---|-----|--------|---------|
| 1 | No token between `--io-z-dropdown` (500) and `--io-z-modal` (1000) for canvas annotation overlays | Tier B elements would use `--io-z-dropdown` (semantic mismatch) or an ad-hoc calc | Add `--io-z-canvas-overlay: 600`; or accept `--io-z-dropdown`; or keep hardcoded 500 with comment |
| 2 | Drag cursor at 9999 exceeds `--io-z-emergency` (3000) scale ceiling | Cannot adopt a token without exceeding the defined scale | Add `--io-z-drag-cursor: 9999`; or document 9999 as an explicit hardcoded exception; or lower to emergency (risk: may conflict if emergency overlay renders during drag) |
| 3 | No "priority modal" layer to guarantee ConfirmDialog beats canvas dialogs when both are at `--io-z-modal` | After remap, ConfirmDialog vs canvas dialog ordering depends on DOM insertion order (portal position) — fragile | Add `--io-z-priority-modal: 1050`; or move ConfirmDialog to `--io-z-command` (1200); or document DOM-order dependency and verify portal ordering |

### (c) Must-change vs. cleanup

**Must change — resolves ConfirmDialog ties:**
- Line 8038 (1000 → 500): canvas badge competing with ConfirmDialog at 1000
- Line 9917 (1000 → 500): same
- Line 10271 (1000 → 500): same

These three are the direct fix for the identified conflict. Moving them to 500 guarantees ConfirmDialog at 1000 always appears above canvas annotation overlays.

**Also required for correct modal layering (canvas dialogs above ConfirmDialog is a bug):**
- Line 332 (2000 → 1000): canvas blocking modal currently above ConfirmDialog
- Line 8621 (1200 → 1000): canvas dialog backdrop currently above ConfirmDialog
- Line 9426 (2000 → 1000): slot popover currently above ConfirmDialog
- Line 9605 (2000 → 500): canvas HUD currently at toast level — not a ConfirmDialog fix but a category correction

**Cleanup — token adoption with no behavior change:**
- Lines 7689, 7994, 8222, 8302, 8377, 9792, 9814, 9837, 9863, 9876: all preserve their exact integer values; remap is notation-only
- Line 8928 (3000 → `var(--io-z-emergency)`): value unchanged, pure token adoption

---

**19 values remapped 2026-05-28. 2 new tokens added to permanent scale (`--io-z-canvas-overlay: 600`, `--io-z-priority-modal: 1050`). ConfirmDialog.tsx NOT touched — its move to `--io-z-priority-modal` is a separate follow-on change.**  
`ui-audit/11-zindex-assessment.md`

---

Produce the review now.
```


## #ASSISTANT

## Summary

The diff matches the prompt intent precisely. All 19 remaps are applied, both new tokens (`--io-z-canvas-overlay: 600`, `--io-z-priority-modal: 1050`) are added consistently across all three theme blocks, line 3750 keeps its hardcoded 9999 with a documented-exception comment, Tier B elements correctly use `var(--io-z-canvas-overlay)` (not `var(--io-z-dropdown)` as the assessment originally proposed), and ConfirmDialog.tsx is untouched. The assessment doc is updated with the complete applied table and token additions dated 2026-05-28. No scope creep is visible.

## Concerns

1. **`as React.CSSProperties` cast applied inconsistently.** Line 7686 (`<line>` SVG element) uses `as React.CSSProperties` to cast the string z-index, correctly, because SVG element `style` props carry a different TypeScript type than HTML element `style` props. However, the same cast is absent on other SVG-context style objects that receive string z-index values — notably line 9914 (inside `RulersOverlay`) and line 10268 (inside `DesignerContextMenuContent`), both of which may be on SVG or nested-SVG elements. If those style objects are on SVG elements rather than HTML elements, the missing cast would be a TypeScript compilation error that `pnpm build` would surface. This is low-risk if those elements are HTML (rendered via portal or absolutely positioned `<div>`), but worth confirming during the type-check pass.

2. **Line 9605 (canvas toolbar HUD): 2000 → `var(--io-z-dropdown)` = 500 is a HIGH-risk behavior change the prompt explicitly flagged for spot-check, but no verification was performed.** The toolbar HUD is persistent canvas chrome at the bottom. Any open dialog at `--io-z-modal` (1000) will now visually cover it. This is the stated intent, but the work unit log contains no browser test or Playwright verification for this change. The assessment itself notes this is observable. It needs a visual spot-check before the diff can be considered verified.

3. **Line 8621 moves from 1200 → `var(--io-z-modal)` = 1000, and line 332 moves from 2000 → `var(--io-z-modal)` = 1000.** Both canvas backdrops now share z=1000 with `--io-z-modal`. The prompt and assessment reason that these two dialogs are never simultaneously rendered by design, but this is an implicit invariant — not enforced by the code. No comment or guard was added to document this assumption. If that invariant is ever violated, the two backdrops at the same z-level would stack in DOM order rather than by priority, which is a silent failure mode.

## Verification Notes

- Token placement in index.css is correct: `--io-z-canvas-overlay: 600` sits between `--io-z-dropdown: 500` and `--io-z-modal: 1000`; `--io-z-priority-modal: 1050` sits between `--io-z-modal: 1000` and `--io-z-command: 1200`. All three theme blocks (dark `:root`, light, hphmi) receive both tokens.
- The dark-theme Z-Index comment count was correctly updated from `(12)` to `(14)`. Light and HPHMI blocks do not carry a count in their comments, so no update was needed there.
- `--io-z-priority-modal` has no consumers in this diff — that is correct per the prompt, which explicitly deferred the ConfirmDialog.tsx one-line change to a follow-on commit.
- The `as React.CSSProperties` cast at line 7686 is the only one in the diff and is appropriate for the SVG `<line>` element context. All other string z-index assignments are on standard HTML element style objects where `React.CSSProperties` accepts `string | number` natively.
- Post-edit verification via grep confirmed no remaining hardcoded z-index values in DesignerCanvas.tsx except the intentional `9999`.


## #TURN_END

_2026-05-28T07:02:11+00:00_

---


## #PROMPT

_2026-05-28T07:02:23+00:00_

```
~deepreview~
```


## #BASH
_Run deep review script_

```bash
!${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/run-review.sh "$(cat ${CLAUDE_PROJECT_DIR}/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #BASH
_Read current log path_

```bash
cat /home/io/io-dev/io/.claude/state/current_log.txt
```


## #BASH
_Run deep review with correct project dir_

```bash
CLAUDE_PROJECT_DIR=/home/io/io-dev/io && /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$(cat /home/io/io-dev/io/.claude/state/current_log.txt)" "$CLAUDE_SESSION_ID" "deep"
```


## #TURN_END

_2026-05-28T07:02:24+00:00_

---


## #PROMPT

_2026-05-28T07:06:11+00:00_

```
Any of those worth resolving before moving on?
```


## #TURN_END

_2026-05-28T07:06:11+00:00_

---


## #PROMPT

_2026-05-28T07:07:36+00:00_

```
Okay fix 1
```


## #BASH
_Run TypeScript type check on frontend_

```bash
cd /home/io/io-dev/io/frontend && pnpm tsc --noEmit 2>&1 | head -60
```


## #TURN_END

_2026-05-28T07:07:36+00:00_

---
---

WORK UNIT SUMMARY:
---
# Work Unit Summary

**Generated**: 2026-05-28T07:09:07+00:00
**Log**: `/home/io/io-dev/io/.claude/logs/2026-05-28_workstream-4-5b-zindex-fix

read-ui-audi_064832.md`
**Session**: 

---

## Work unit purpose

Applied a full z-index token remap to `DesignerCanvas.tsx`, migrating all 19 hardcoded z-index values to CSS custom property tokens, and added two new tokens to the permanent design system scale in `index.css`.

## Key decisions made

- **Full remap scope**: Applied all 19 remaps (behavior-changing + zero-risk cleanup) in a single pass rather than a minimal/safe subset
- **New token `--io-z-canvas-overlay: 600`**: Added to bridge the gap between `--io-z-dropdown` (500) and `--io-z-modal` (1000) for canvas badge/tooltip overlays; overrode assessment's original proposal of `--io-z-dropdown` for Tier B elements
- **New token `--io-z-priority-modal: 1050`**: Added between `--io-z-modal` (1000) and `--io-z-command` (1200) to reserve space for ConfirmDialog promotion — token defined now, consumer migration deferred
- **Line 3750 exception**: Drag cursor kept at hardcoded `9999` with a documented code comment rather than adding a new token or remapping
- **ConfirmDialog.tsx excluded**: Its migration to `--io-z-priority-modal` was explicitly deferred to a follow-on change to keep the canvas diff clean

## What was built or changed

- `frontend/src/index.css`: Added `--io-z-canvas-overlay: 600` and `--io-z-priority-modal: 1050` to all three theme blocks (dark, light, hphmi); updated token count comment from 12 to 14
- `frontend/src/pages/designer/DesignerCanvas.tsx`: Remapped 18 hardcoded z-index values to CSS custom property tokens; added exception comment to line 3750 (9999 stays hardcoded)
- `ui-audit/11-zindex-assessment.md`: Updated status to COMPLETE, added applied-date column to Part Five remap table, documented both new tokens with addition dates

## What was deliberately not done

- `ConfirmDialog.tsx` was not touched — its one-line move to `--io-z-priority-modal` is a separate follow-on change
- No other components modified — scope was strictly `DesignerCanvas.tsx` and `index.css`
- No browser/visual verification performed for the seven behavior-changing remaps flagged as HIGH/MEDIUM risk

## Open questions or follow-ups

- **TypeScript cast correctness** (Concern 1 from review): `as React.CSSProperties` cast present for SVG `<line>` at line 7686 but potentially absent on other SVG-context string z-index assignments (lines 9914, 10268) — a `pnpm tsc --noEmit` check was initiated but result not shown in log; fix for Concern 1 was requested and a tsc run was started
- **Visual spot-check pending** (Concern 2): Line 9605 toolbar HUD drop from 2000→500 needs a browser verification — dialogs now cover it
- **Implicit invariant undocumented** (Concern 3): Lines 332 and 8621 share z=1000 post-remap; assumption they never render simultaneously is not code-enforced

## Files modified

- `frontend/src/index.css`
- `frontend/src/pages/designer/DesignerCanvas.tsx`
- `ui-audit/11-zindex-assessment.md`
SessionEnd hook [${CLAUDE_PROJECT_DIR}/.claude/hooks/session-end.sh] failed: /bin/sh: 1: /home/io/io-dev/io/frontend/.claude/hooks/session-end.sh: not found
---


DIFF OF CHANGES:
---
diff --git a/frontend/src/index.css b/frontend/src/index.css
index 43869db5..bb8c7023 100644
--- a/frontend/src/index.css
+++ b/frontend/src/index.css
@@ -203,14 +203,16 @@ body {
   --io-text-code: 0.8125rem;
   --io-text-code-sm: 0.75rem;
 
-  /* Z-Index (12) */
+  /* Z-Index (14) */
   --io-z-base: 0;
   --io-z-panel: 10;
   --io-z-sidebar: 100;
   --io-z-topbar: 100;
   --io-z-edge-hover: 150;
   --io-z-dropdown: 500;
+  --io-z-canvas-overlay: 600;
   --io-z-modal: 1000;
+  --io-z-priority-modal: 1050;
   --io-z-command: 1200;
   --io-z-visual-lock: 1500;
   --io-z-kiosk-auth: 1800;
@@ -423,7 +425,9 @@ body {
   --io-z-topbar: 100;
   --io-z-edge-hover: 150;
   --io-z-dropdown: 500;
+  --io-z-canvas-overlay: 600;
   --io-z-modal: 1000;
+  --io-z-priority-modal: 1050;
   --io-z-command: 1200;
   --io-z-visual-lock: 1500;
   --io-z-kiosk-auth: 1800;
@@ -628,7 +632,9 @@ body {
   --io-z-topbar: 100;
   --io-z-edge-hover: 150;
   --io-z-dropdown: 500;
+  --io-z-canvas-overlay: 600;
   --io-z-modal: 1000;
+  --io-z-priority-modal: 1050;
   --io-z-command: 1200;
   --io-z-visual-lock: 1500;
   --io-z-kiosk-auth: 1800;
diff --git a/frontend/src/pages/designer/DesignerCanvas.tsx b/frontend/src/pages/designer/DesignerCanvas.tsx
index 3fadec5d..7e9f864e 100644
--- a/frontend/src/pages/designer/DesignerCanvas.tsx
+++ b/frontend/src/pages/designer/DesignerCanvas.tsx
@@ -329,7 +329,7 @@ function NameGroupPrompt({
   const overlayStyle: React.CSSProperties = {
     position: "fixed",
     inset: 0,
-    zIndex: 2000,
+    zIndex: "var(--io-z-modal)",
     background: "rgba(0,0,0,0.5)",
     display: "flex",
     alignItems: "center",
@@ -3747,7 +3747,7 @@ export default function DesignerCanvas({
             ghost.style.cssText = [
               "position:fixed",
               "pointer-events:none",
-              "z-index:9999",
+              "z-index:9999", // intentional exception: pointer-events:none transient drag indicator; must sit above all UI including emergency overlays; deliberately exempt from the token scale
               `left:${e.clientX}px`,
               `top:${e.clientY}px`,
               `width:${bb ? bb.width : 40}px`,
@@ -7686,7 +7686,7 @@ export default function DesignerCanvas({
                       strokeWidth={1 / zoom}
                       strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                       pointerEvents="none"
-                      style={{ zIndex: -1 } as React.CSSProperties}
+                      style={{ zIndex: "calc(var(--io-z-base) - 1)" } as React.CSSProperties}
                     />
                   );
                 })()}
@@ -7991,7 +7991,7 @@ export default function DesignerCanvas({
                 position: "absolute",
                 inset: 0,
                 overflow: "hidden",
-                zIndex: 10,
+                zIndex: "var(--io-z-panel)",
               }}
               onMouseDown={(e) => e.stopPropagation()}
               onMouseMove={(e) => e.stopPropagation()}
@@ -8035,7 +8035,7 @@ export default function DesignerCanvas({
                       minWidth: 160,
                       overflow: "hidden",
                       fontSize: 12,
-                      zIndex: 1000,
+                      zIndex: "var(--io-z-canvas-overlay)",
                     }}
                   >
                     <ContextMenuPrimitive.Item
@@ -8219,7 +8219,7 @@ export default function DesignerCanvas({
                 borderRadius: "var(--io-radius)",
                 padding: "3px 10px",
                 fontSize: 11,
-                zIndex: 10,
+                zIndex: "var(--io-z-panel)",
                 boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                 whiteSpace: "nowrap",
               }}
@@ -8299,7 +8299,7 @@ export default function DesignerCanvas({
                 position: "absolute",
                 inset: 0,
                 pointerEvents: "none",
-                zIndex: 15,
+                zIndex: "calc(var(--io-z-panel) + 5)",
                 overflow: "hidden",
               }}
             >
@@ -8374,7 +8374,7 @@ export default function DesignerCanvas({
                     lineHeight: 1.4,
                     padding: 0,
                     margin: 0,
-                    zIndex: 20,
+                    zIndex: "calc(var(--io-z-panel) + 10)",
                     overflow: "hidden",
                     whiteSpace: "pre",
                   }}
@@ -8618,7 +8618,7 @@ export default function DesignerCanvas({
               style={{
                 position: "fixed",
                 inset: 0,
-                zIndex: 1200,
+                zIndex: "var(--io-z-modal)",
                 background: "rgba(0,0,0,0.55)",
                 display: "flex",
                 alignItems: "center",
@@ -8925,7 +8925,7 @@ export default function DesignerCanvas({
                   style={{
                     position: "fixed",
                     inset: 0,
-                    zIndex: 3000,
+                    zIndex: "var(--io-z-emergency)",
                     cursor: "crosshair",
                   }}
                   onMouseMove={(e) => {
@@ -9423,7 +9423,7 @@ export default function DesignerCanvas({
                     position: "fixed",
                     top: slotPopover.screenY,
                     left: slotPopover.screenX,
-                    zIndex: 2000,
+                    zIndex: "var(--io-z-modal)",
                     background: "var(--io-surface-elevated)",
                     border: "1px solid var(--io-border)",
                     borderRadius: "var(--io-radius)",
@@ -9602,7 +9602,7 @@ export default function DesignerCanvas({
             bottom: 16,
             left: "50%",
             transform: "translateX(-50%)",
-            zIndex: 2000,
+            zIndex: "var(--io-z-dropdown)",
             display: "flex",
             alignItems: "center",
             gap: 8,
@@ -9789,7 +9789,7 @@ function RulersOverlay({
           left: RULER_SIZE,
           width: `calc(100% - ${RULER_SIZE}px)`,
           height: RULER_SIZE,
-          zIndex: 10,
+          zIndex: "var(--io-z-panel)",
           cursor: "s-resize",
           pointerEvents: "all",
         }}
@@ -9811,7 +9811,7 @@ function RulersOverlay({
           left: 0,
           width: RULER_SIZE,
           height: `calc(100% - ${RULER_SIZE}px)`,
-          zIndex: 10,
+          zIndex: "var(--io-z-panel)",
           cursor: "e-resize",
           pointerEvents: "all",
         }}
@@ -9834,7 +9834,7 @@ function RulersOverlay({
           width: RULER_SIZE,
           height: RULER_SIZE,
           background: "var(--io-surface-elevated)",
-          zIndex: 11,
+          zIndex: "calc(var(--io-z-panel) + 1)",
           borderRight: "1px solid var(--io-border)",
           borderBottom: "1px solid var(--io-border)",
         }}
@@ -9860,7 +9860,7 @@ function RulersOverlay({
                     ? "rgba(255,160,0,0.5)"
                     : "rgba(0,200,255,0.5)",
                   cursor: g.locked ? "not-allowed" : "ew-resize",
-                  zIndex: 9,
+                  zIndex: "calc(var(--io-z-panel) - 1)",
                   pointerEvents: "all",
                 }
               : {
@@ -9873,7 +9873,7 @@ function RulersOverlay({
                     ? "rgba(255,160,0,0.5)"
                     : "rgba(0,200,255,0.5)",
                   cursor: g.locked ? "not-allowed" : "ns-resize",
-                  zIndex: 9,
+                  zIndex: "calc(var(--io-z-panel) - 1)",
                   pointerEvents: "all",
                 };
 
@@ -9914,7 +9914,7 @@ function RulersOverlay({
             minWidth: 160,
             overflow: "hidden",
             fontSize: 12,
-            zIndex: 1000,
+            zIndex: "var(--io-z-canvas-overlay)",
             padding: "3px 0",
           };
 
@@ -10268,7 +10268,7 @@ function DesignerContextMenuContent({
     minWidth: 180,
     overflow: "hidden",
     fontSize: 12,
-    zIndex: 1000,
+    zIndex: "var(--io-z-canvas-overlay)",
   };
 
   const subContentStyle: React.CSSProperties = {
---

Produce the review now.
```


## #ASSISTANT

## Summary

The diff matches the initial prompt exactly. All 19 remaps are applied at the correct locations with the correct tokens, both new tokens are added to all three theme blocks at the correct positions in the scale, line 3750 retains its hardcoded 9999 with the exception comment, Tier B elements use `var(--io-z-canvas-overlay)` as specified (overriding the assessment's original `var(--io-z-dropdown)` proposal), and ConfirmDialog.tsx is untouched. No scope creep is visible.

## Concerns

No concerns identified.


## #TURN_END

_2026-05-28T07:10:02+00:00_

---


## #PROMPT

_2026-05-28T07:11:01+00:00_

```
~wrapup~
```


## #BASH
_Read current log path_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && echo "$CLAUDE_LOG"
```


## #BASH
_Generate work unit summary_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/generate-summary.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #BASH
_Run shallow review_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/run-review.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID" "shallow"
```


## #BASH
_Update interim docs_

```bash
CLAUDE_LOG=$(cat /home/io/io-dev/io/.claude/state/current_log.txt) && /home/io/io-dev/io/.claude/hooks/scripts/update-docs.sh "$CLAUDE_LOG" "$CLAUDE_SESSION_ID"
```


## #BASH
_Read shallow review results_

```bash
cat "/home/io/io-dev/io/.claude/reviews/2026-05-28_workstream-4-5b-zindex-fix

read-ui-audi_064832_review_shallow_070909.md"
```


## #TURN_END

_2026-05-28T07:11:02+00:00_

---


## #PROMPT

_2026-05-28T07:13:01+00:00_

```
commit
```


## #BASH
_Show changed files_

```bash
git -C /home/io/io-dev/io diff --stat HEAD
```


## #BASH
_Show git status_

```bash
git -C /home/io/io-dev/io status
```


## #BASH
_Stage the three changed files_

```bash
git -C /home/io/io-dev/io add frontend/src/index.css frontend/src/pages/designer/DesignerCanvas.tsx ui-audit/11-zindex-assessment.md
```


## #BASH
_Commit the z-index remap changes_

```bash
git -C /home/io/io-dev/io commit -m "$(cat <<'EOF'
fix: remap all DesignerCanvas z-index values to permanent token scale

Applies all 19 z-index remaps identified in ui-audit/11-zindex-assessment.md.
Adds two new tokens to the permanent scale in all three theme blocks (dark/light/hphmi):
--io-z-canvas-overlay: 600 (canvas badge/tooltip overlays, below modal layer)
--io-z-priority-modal: 1050 (reserved for ConfirmDialog, follow-on commit)

Tier B elements (canvas annotation overlays) move from 1000 → 600, resolving
the ConfirmDialog stacking tie. Canvas dialogs move from 1200-2000 → 1000.
Canvas toolbar HUD moves from 2000 → 500. Tier A elements adopt token notation
with no computed value change. Line 3750 (drag cursor, 9999) kept hardcoded
with a documented-exception comment. ConfirmDialog.tsx not touched.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```


## #TURN_END

_2026-05-28T07:13:01+00:00_

---

