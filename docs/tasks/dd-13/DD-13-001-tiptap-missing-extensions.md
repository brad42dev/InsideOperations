---
id: DD-13-001
title: Add missing Tiptap extensions (Underline, Image, Table, Color/TextStyle)
unit: DD-13
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The WYSIWYG editor in log entries must support underline formatting, inline images, tables, and font colors. These are architectural gaps — the StarterKit alone does not provide them, and omitting them means operators cannot use core formatting features that the spec requires.

## Spec Excerpt (verbatim)

> Rich text formatting (bold, italic, underline, strikethrough)
> Fonts and colors
> Tables
> Images (inline)
> — design-docs/13_LOG_MODULE.md, §WYSIWYG Editor

## Where to Look in the Codebase

Primary files:
- `frontend/package.json` — add the missing `@tiptap/extension-*` packages
- `frontend/src/pages/log/LogEditor.tsx:4-5` — import and register extensions in `useEditor`
- `frontend/src/pages/log/LogEditor.tsx:92-99` — `extensions: [StarterKit]` must be expanded

## Verification Checklist

- [ ] `package.json` lists `@tiptap/extension-underline`, `@tiptap/extension-image`, `@tiptap/extension-table`, `@tiptap/extension-text-style`, `@tiptap/extension-color`
- [ ] `useEditor` in `WysiwygSegment` passes all 5 extensions in the `extensions` array alongside `StarterKit`
- [ ] The Tiptap toolbar includes working buttons for Underline (separate from Strike), an image insert action, a table insert action, and a color picker
- [ ] No new libraries outside the approved @tiptap/* ecosystem (all MIT licensed)

## Assessment

- **Status**: ❌ Missing
- `frontend/package.json` only includes `@tiptap/react`, `@tiptap/pm`, and `@tiptap/starter-kit` (lines 29-31). The four required extension packages are not installed.
- `LogEditor.tsx:93` passes only `[StarterKit]` to `useEditor`.
- The toolbar has buttons labeled for underline, but they have no effect (underline is not in StarterKit and the command is wired wrong — see DD-13-002).

## Fix Instructions

1. In `frontend/`, install the missing packages:
   ```
   pnpm add @tiptap/extension-underline @tiptap/extension-image @tiptap/extension-table @tiptap/extension-text-style @tiptap/extension-color
   ```

2. In `frontend/src/pages/log/LogEditor.tsx`, add imports after line 5:
   ```ts
   import Underline from '@tiptap/extension-underline'
   import Image from '@tiptap/extension-image'
   import Table from '@tiptap/extension-table'
   import TableRow from '@tiptap/extension-table-row'
   import TableCell from '@tiptap/extension-table-cell'
   import TableHeader from '@tiptap/extension-table-header'
   import TextStyle from '@tiptap/extension-text-style'
   import Color from '@tiptap/extension-color'
   ```

3. In the `WysiwygSegment` component at line 93, change `extensions: [StarterKit]` to:
   ```ts
   extensions: [
     StarterKit,
     Underline,
     Image,
     Table.configure({ resizable: true }),
     TableRow,
     TableCell,
     TableHeader,
     TextStyle,
     Color,
   ],
   ```

4. Add toolbar buttons for:
   - Image: prompt for URL and call `editor.chain().focus().setImage({ src: url }).run()`
   - Table: call `editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()`
   - Color picker: use an `<input type="color">` that calls `editor.chain().focus().setColor(color).run()`
   - Fix Underline button (see DD-13-002 for that specific fix)

Do NOT:
- Remove or replace `StarterKit` — it provides heading, bold, italic, strike, lists, blockquote, code, etc.
- Use `@tiptap/extension-table-cell-extension` (wrong package name) — the correct packages are as listed above
- Use non-MIT libraries for rich text functionality
