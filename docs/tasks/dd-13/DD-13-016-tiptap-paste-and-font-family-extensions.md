---
id: DD-13-016
title: Add Tiptap paste-from-office and font-family extensions to WYSIWYG editor
unit: DD-13
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The WYSIWYG editor in log entries must support pasting content from Microsoft Office or Google Docs while preserving formatting (bold, tables, lists), and must allow operators to change font family in their text entries. Both are explicitly listed in the spec's WYSIWYG feature requirements.

## Spec Excerpt (verbatim)

> Paste from Microsoft Office/Google Docs (preserve formatting)
> Fonts and colors
> — design-docs/13_LOG_MODULE.md, §WYSIWYG Editor

## Where to Look in the Codebase

Primary files:
- `frontend/package.json` — add `@tiptap/extension-paste-from-office` and `@tiptap/extension-font-family`
- `frontend/src/pages/log/LogEditor.tsx:1–16` — imports section; add the two new extension imports
- `frontend/src/pages/log/LogEditor.tsx:102–113` — `extensions: [...]` array in `useEditor()`; register both extensions
- `frontend/src/pages/log/LogEditor.tsx:120–255` — WYSIWYG toolbar; add a font-family selector dropdown

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `@tiptap/extension-paste-from-office` is listed in `frontend/package.json` dependencies.
- [ ] `@tiptap/extension-font-family` is listed in `frontend/package.json` dependencies.
- [ ] Both extensions are imported and added to the `extensions` array in `useEditor()` at LogEditor.tsx:102–113.
- [ ] The WYSIWYG toolbar (LogEditor.tsx:120–255) includes a font-family `<select>` or similar control that calls `editor.chain().focus().setFontFamily(value).run()`.
- [ ] Pasting from Word/Google Docs into the editor preserves bold, lists, and table structure (manual test).

## Assessment

After checking:
- **Status**: ❌ Missing
- **What's missing**: `@tiptap/extension-paste-from-office` — not in package.json and not imported. `@tiptap/extension-font-family` — not in package.json and not imported. No font selector in the toolbar.

## Fix Instructions

**Step 1 — Install packages:**
```
cd frontend
pnpm add @tiptap/extension-paste-from-office @tiptap/extension-font-family
```
Both packages are MIT-licensed as part of the Tiptap ecosystem.

**Step 2 — Import in LogEditor.tsx** (after existing imports at line 13):
```ts
import { FontFamily } from '@tiptap/extension-font-family'
import { PasteFromOffice } from '@tiptap/extension-paste-from-office'
```

**Step 3 — Register in `useEditor()` extensions array** (LogEditor.tsx:103–113):
Add `FontFamily` and `PasteFromOffice` to the extensions list. `PasteFromOffice` requires no configuration. `FontFamily` works with the existing `TextStyle` extension (already loaded).

**Step 4 — Add font selector to toolbar** (LogEditor.tsx:120–255):
Add a `<select>` element near the Color picker in the toolbar that offers 4–6 font families (e.g., Default, Monospace, Serif, Inter). On change: `editor.chain().focus().setFontFamily(value).run()`. Set value to `''` to unset back to default.

Do NOT:
- Remove the existing `TextStyle` extension — `FontFamily` depends on it.
- Add a paid or GPL-licensed font extension. `@tiptap/extension-font-family` is MIT.
- Block paste entirely to "sanitize" — let PasteFromOffice transform the clipboard content; backend already does XSS sanitization on save.
