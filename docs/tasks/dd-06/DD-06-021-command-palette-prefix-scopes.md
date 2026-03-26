---
id: DD-06-021
title: Fix command palette prefix scopes (@=points, /=graphics, #=entities)
unit: DD-06
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The command palette supports four prefix characters that narrow searches to a specific category. Typing `@` searches point tagnames and descriptions. Typing `/` searches graphics and process views by name. Typing `#` searches entities (dashboards, reports, workspaces, round templates). Typing `>` searches actions and commands. Currently the implementation has the wrong categories wired to `@`, `/`, and `#`.

## Spec Excerpt (verbatim)

> | Prefix | Scope | What's Searched |
> |--------|-------|-----------------|
> | (none) | Everything | Modules, graphics, dashboards, reports, points, recent items |
> | `>` | Commands | Actions: create, acknowledge, export, run report, change theme, toggle settings |
> | `@` | Points | Point tagnames and descriptions. Results show tagname, description, current value, unit |
> | `/` | Graphics | Graphics and process views by name |
> | `#` | Entities | Dashboards, reports, workspaces, round templates |
> — design-docs/06_FRONTEND_SHELL.md, §Search Scopes (Prefix-Based)

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/CommandPalette.tsx:47–80` — `parseQuery()` function and `SCOPE_TYPES` / `SCOPE_HINTS` constants define the current wrong mappings
- `frontend/src/api/search.ts` — `SearchResult['type']` enum defines what types the API supports

## Verification Checklist

- [ ] `parseQuery('@foo')` returns `scope: 'points'` (not `'users'`)
- [ ] `parseQuery('/foo')` returns `scope: 'graphics'` (not `'routes'`)
- [ ] `parseQuery('#foo')` returns `scope: 'entities'` (not `'tags'`)
- [ ] `SCOPE_TYPES['points']` maps to API types that cover point/tag results
- [ ] `SCOPE_TYPES['graphics']` maps to API types for graphic/process views
- [ ] `SCOPE_TYPES['entities']` maps to API types for dashboards, reports, workspaces, templates
- [ ] Scope hint labels in the UI match the corrected scope names

## Assessment

- **Status**: ⚠️ Partial — scopes present but all three non-command prefixes are wrong
- **What needs to change**: rename scope values and update `SCOPE_TYPES` to match spec

## Fix Instructions

In `frontend/src/shared/components/CommandPalette.tsx`:

1. Change `type PrefixScope` (line ~47) to use correct values:
   ```ts
   type PrefixScope = 'commands' | 'points' | 'graphics' | 'entities' | null
   ```

2. Update `parseQuery()` (lines 56–61):
   ```ts
   if (raw.startsWith('>')) return { scope: 'commands',  term: ..., prefix: '>' }
   if (raw.startsWith('@')) return { scope: 'points',    term: ..., prefix: '@' }
   if (raw.startsWith('/')) return { scope: 'graphics',  term: ..., prefix: '/' }
   if (raw.startsWith('#')) return { scope: 'entities',  term: ..., prefix: '#' }
   ```

3. Update `SCOPE_PLACEHOLDER` to reflect correct descriptions.

4. Update `SCOPE_TYPES` to map each scope to the correct API `type` filter strings. Check `SearchResult['type']` in `frontend/src/api/search.ts` for valid values. `points` should map to `['point']`; `graphics` to `['graphic']`; `entities` to `['dashboard', 'report']` (or whatever the API returns for workspace/template).

5. Update `SCOPE_HINTS` labels to match new scope names.

Do NOT:
- Remove the `>` commands scope — it is correct
- Change the prefix characters themselves (>, @, /, #)
- Break the `showNavCommands` logic that decides when to show navigation commands
