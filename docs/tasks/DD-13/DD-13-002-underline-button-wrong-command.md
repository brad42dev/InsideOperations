---
id: DD-13-002
title: Fix Underline toolbar button wired to toggleStrike instead of toggleUnderline
unit: DD-13
status: pending
priority: high
depends-on: [DD-13-001]
---

## What This Feature Should Do

The "Underline" button in the WYSIWYG editor toolbar must apply underline formatting. Currently it calls `toggleStrike()` — clicking "Underline" applies strikethrough text, and the active-state check is also wrong.

## Spec Excerpt (verbatim)

> Rich text formatting (bold, italic, underline, strikethrough)
> — design-docs/13_LOG_MODULE.md, §WYSIWYG Editor

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/log/LogEditor.tsx:128-134` — the Underline `ToolbarBtn` definition

## Verification Checklist

- [ ] The "Underline" toolbar button calls `editor.chain().focus().toggleUnderline().run()` (not `toggleStrike`)
- [ ] The `active` prop on the Underline button checks `editor.isActive('underline')` (not `editor.isActive('strike')` or any other node)
- [ ] A separate "Strikethrough" button exists and correctly calls `toggleStrike()`
- [ ] DD-13-001 is completed first so the Underline extension is available

## Assessment

- **Status**: ⚠️ Wrong
- `LogEditor.tsx:131`: `onClick={() => editor.chain().focus().toggleStrike().run()}` — wrong command
- `LogEditor.tsx:130`: `active={editor.isActive('underline')}` — the isActive check references 'underline' which does not exist in StarterKit, so it always returns false

## Fix Instructions

At `frontend/src/pages/log/LogEditor.tsx`, find the Underline `ToolbarBtn` block (lines 121-134) and replace it with:

```tsx
<ToolbarBtn
  title="Underline"
  active={editor.isActive('underline')}
  onClick={() => editor.chain().focus().toggleUnderline().run()}
>
  <u>U</u>
</ToolbarBtn>
```

Then add a separate Strikethrough button (currently missing since the original Underline button was incorrectly filling that role):

```tsx
<ToolbarBtn
  title="Strikethrough"
  active={editor.isActive('strike')}
  onClick={() => editor.chain().focus().toggleStrike().run()}
>
  <s>S</s>
</ToolbarBtn>
```

This fix requires DD-13-001 to be done first (Underline extension must be installed and registered).

Do NOT:
- Remove the Strike button — strikethrough is separately required by the spec
- Leave the existing "S" button as-is (it currently shows "S" in the toolbar label which is visually ambiguous)
