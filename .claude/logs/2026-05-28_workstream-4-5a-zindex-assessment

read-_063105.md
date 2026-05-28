# Work Unit Log: workstream-4-5a-zindex-assessment

read-

Started: 2026-05-28T06:31:05+00:00
Session: be2c2459-cf25-410d-b7e3-d0f2f490f5ce

---


## #WRITE `/home/io/io-dev/io/ui-audit/11-zindex-assessment.md` (20691 chars written)

_2026-05-28T06:36:06+00:00_


## #PROMPT

_2026-05-28T06:36:09+00:00_

```
~initprompt~ workstream-4.5a-zindex-assessment

Read-only analysis task. Do not modify any code. Read ui-audit/00-preflight-facts.md section 2 (the full DesignerCanvas z-index inventory) and index.css to get the permanent z-index scale (the --io-z-* tokens with their values: dropdown 500, modal 1000, command 1200, visual-lock 1500, kiosk-auth 1800, toast 2000, emergency 3000).

Context: ConfirmDialog (patched in Claim B) uses var(--io-z-modal) = 1000. The preflight found 19 hardcoded z-index integers in DesignerCanvas and zero token usage. The goal is to map each onto the permanent token scale so the canvas participates in the same stacking system as the rest of the app, resolving both the three exact-1000 ties with ConfirmDialog and the canvas's above-modal overlays.

Goal: produce ui-audit/11-zindex-assessment.md with a proposed remap for every DesignerCanvas z-index value.

Part one, classify each of the 19 values by intent. Using the element descriptions from the preflight inventory, group the 19 into stacking tiers by what they are: base canvas content and chrome (rulers, guide handles, tooltips, selection overlays — the sub-100 and low values); canvas-internal dialogs and popovers (the 1000/1200/2000 fixed backdrops and popovers); full-screen capture overlays (the 3000 point-picker, the 9999 drag cursor). For each value, state which tier it belongs to and why, based on the element description.

Part two, propose a token mapping per tier. For each tier, recommend which --io-z-* token (or relative offset from one) the elements should use. Key questions to resolve:
- The three elements at exactly 1000: should they sit below the modal layer (because ConfirmDialog should appear above canvas tooltips/badges) or are they themselves modal-level? Most canvas tooltips/badges should be below modal. Recommend per element.
- The internal fixed dialog backdrop at 1200 and popovers at 2000: these are canvas-spawned dialogs. Should they use --io-z-modal so they stack consistently with ConfirmDialog, or are they intentionally above it? Recommend, noting that two canvas dialogs both wanting to be "the modal" creates its own ordering question.
- The 3000 full-screen point-picker and 9999 drag cursor: these are capture overlays that legitimately sit above everything including modals. Map to --io-z-emergency (3000) or document why they exceed it. The 9999 drag cursor likely wants to be above even emergency — flag whether the scale needs a documented "drag cursor" position or whether emergency suffices.

Part three, flag scale gaps. If the remap reveals the canvas needs a stacking position the permanent scale does not provide (e.g. a "canvas chrome" tier between base and dropdown, or an "above emergency" drag layer), flag it explicitly. Do NOT propose adding to the scale unilaterally — adding a layer affects the eight-module rebuild. List the gap for user decision.

Part four, risk assessment per change. For each proposed remap, note whether changing the value could alter current visible stacking behavior. A remap that preserves the current visual order is low-risk; one that changes which element appears on top is higher-risk and needs spot-checking. The three exact-1000 elements are the highest priority because their current behavior against ConfirmDialog is already undefined (tie).

Part five, summary. Produce: (a) the proposed remap table (element, current value, proposed token, risk), (b) the list of scale gaps needing a user decision, (c) the subset that must change to resolve the ConfirmDialog ties versus the subset that is cleanup (token adoption without behavior change).

Do not modify code. This is strategy only; the fix prompt applies it.

When done print: count of values to remap, count of scale gaps flagged for decision, count of high-risk (behavior-changing) remaps, and the file path. Stop.
```


## #ASSISTANT

I'll read the preflight facts and index.css to gather the data needed for this analysis.


## #BASH
_Find z-index token definitions in index.css_

```bash
grep -n "\-\-io-z-" /home/io/io-dev/io/frontend/src/index.css | head -40
```


## #ASSISTANT

I have all the data I need. Now I'll produce the assessment document.


## #TURN_END

_2026-05-28T06:36:10+00:00_

---

