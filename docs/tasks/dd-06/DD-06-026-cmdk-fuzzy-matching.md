---
id: DD-06-026
title: Replace command palette with cmdk library and command-score fuzzy matching
unit: DD-06
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The command palette uses the `cmdk` library (MIT license) with `command-score` fuzzy matching. Currently the palette is built on `@radix-ui/react-dialog` with simple `.includes()` string matching. The result is that partial matches like "mcr" for "Main Control Room" do not work — only exact substring matches do.

## Spec Excerpt (verbatim)

> **Library:** `cmdk` (MIT license, used by Linear and Vercel). Headless/unstyled — I/O controls all theming. Zero dependencies. Accessible by default. Fuzzy search via `command-score`.
>
> **Fuzzy matching:** `command-score` algorithm ranks by substring position, consecutive character matches, and word boundary alignment. "mcr" matches "Main Control Room."
> — design-docs/06_FRONTEND_SHELL.md, §Command Palette

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/CommandPalette.tsx:1–3` — current imports (Radix Dialog, no cmdk)
- `frontend/src/shared/components/CommandPalette.tsx:133–143` — current `.includes()` matching
- `frontend/package.json` — cmdk not present

## Verification Checklist

- [ ] `cmdk` is in `package.json` dependencies
- [ ] `CommandPalette.tsx` imports from `cmdk` (e.g., `import { Command } from 'cmdk'`)
- [ ] Typing "mcr" in the palette matches "Main Control Room" and ranks it at the top
- [ ] Typing "cons" matches "Console" before matching "Connections"
- [ ] Navigation commands sorted by fuzzy relevance score, not alphabetically

## Assessment

- **Status**: ❌ Missing — cmdk not installed; current matching is `label.includes(q)` (exact substring only)

## Fix Instructions

1. Install cmdk: `pnpm add cmdk` (from `frontend/`). Verify MIT license.

2. Refactor `CommandPalette.tsx` to use the `<Command>` primitive from cmdk:
   - Replace `@radix-ui/react-dialog` wrapper with cmdk's built-in `<Command.Dialog>` (which wraps Radix Dialog internally).
   - Use `<Command.Input>` for the search field — cmdk handles fuzzy ranking automatically.
   - Use `<Command.List>`, `<Command.Item>`, `<Command.Group>` for rendering.
   - Remove the manual `filteredCommands` `.includes()` filter — cmdk handles this.
   - Keep the API search debounce for server-side results (cmdk does not search the API).

3. cmdk's default filter uses `command-score`. Items rendered as `<Command.Item value={cmd.label}>` are automatically ranked by the fuzzy algorithm. Pass `keywords` as part of the `value` string or use the `keywords` prop if supported.

4. Preserve the prefix scope behavior (parseQuery, SCOPE_TYPES): when a prefix is active, filter the item list before passing to cmdk, so only the correct category of items is rendered.

5. The keyboard shortcuts (ArrowUp/Down/Enter) are handled by cmdk — remove the manual `handleKeyDown` override for those keys.

Do NOT:
- Replace Radix Dialog with cmdk's dialog wrapper without checking that the existing overlay z-index (3000) still works correctly
- Remove the API debounce search — cmdk only fuzzy-ranks client-side items; server results still need to be fetched separately and merged
- Install `command-score` separately — it ships inside cmdk
