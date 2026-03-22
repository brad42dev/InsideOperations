# Task Template

Copy this file to `docs/tasks/{unit-id}/{unit-id}-NNN-{slug}.md` for each task.

---

```markdown
---
id: {UNIT-ID}-{NNN}
title: {Short feature name}
unit: {GFX-CORE | GFX-DISPLAY | GFX-SHAPES | MOD-CONSOLE | MOD-PROCESS | MOD-DESIGNER | OPC-BACKEND | DD-XX}
status: pending
priority: high | medium | low
depends-on: []
---

## What This Feature Should Do

{2-4 sentence plain-English description of the feature from the user's perspective.}

## Spec Excerpt (verbatim)

> {Exact quote from the authoritative spec file. Include section heading.}
> — {spec filename}, §{section}

## Where to Look in the Codebase

Primary files:
- `{file path}` — {what this file is responsible for}
- `{file path}` — {what to look for}

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] {Specific, binary check. Pass = correct. Fail = wrong or missing.}
- [ ] {Another specific check.}
- [ ] {Another specific check.}

## Assessment

After checking:
- **Status**: ✅ Correct | ⚠️ Partial (describe delta) | ❌ Missing
- **If partial/missing**: {What specifically needs to change}

## Fix Instructions (if needed)

{Only fill this in if status is ⚠️ or ❌}

{Specific instructions for what to implement or fix. Reference exact file paths and line numbers if known. Include what NOT to change.}

Do NOT:
- {Common mistake to avoid}
- {Another thing to avoid}
```
