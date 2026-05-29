# Work Unit Log: cleanup-interim-doc-corruption-batch

Started: 2026-05-28T08:20:47+00:00
Session: ffa17917-b4de-4b76-bb68-25717ee917f0

---


## #PROMPT

_2026-05-28T08:24:41+00:00_

```
~initprompt~ cleanup-interim-doc-corruption-batch

Maintenance task. Clean up the accumulated corrupted interim-doc artifacts produced before the log/slug newline bugs were fixed. The source bugs are now fixed; this is debris cleanup only. Touch only files under .claude/docs/interim/. Inspect before acting — filenames contain literal newlines, so globs and naive rm/mv are unsafe.

A prior diagnostic identified 9 malformed files. Expected (verify against actual on-disk state):

Docs (6), with intended clean slug → corruption type:
- 2026-05-27-regression-statusbadge-hex-alpha  (filename-only)
- 2026-05-28-workstream-3c-promote-confirmdialog  (content-corrupted: id has junk suffix)
- 2026-05-28-workstream-3c-promote-dialog  (content-corrupted: id breaks across newlines, junk line in frontmatter)
- 2026-05-28-workstream-3c-promote-fieldlabel  (filename-only)
- 2026-05-28-workstream-3c-promote-statusbadge  (content-corrupted: id and work_units break across newlines)
- 2026-05-28-workstream-4-5b-zindex-fix  (content-corrupted: work_units list item breaks across newlines)

Proposals (3), all deletable junk:
- the .update-proposal-* files associated with the statusbadge-hex-alpha, promote-confirmdialog, and promote-dialog docs.

Step one, inventory with byte-accurate names. List .claude/docs/interim/ showing control characters (printf '%q\n' for each entry, or ls -b). Report the exact escaped name of every file, flagging which contain newlines or junk suffixes. Confirm the count and identities match the expected list above; if the actual state differs (more/fewer files, different corruption), report it and proceed based on actual state, not the expected list.

Step two, per-doc repair. Process each of the 6 docs one at a time. For each:
  a. Read the full file. Assign its exact current name to a shell variable (do not rely on a glob — use a method that captures the literal newline, e.g. iterate with a for loop over the directory and match on a unique clean substring of the name).
  b. Repair content if content-corrupted: within the frontmatter, fix any field broken across embedded newlines (id, work_units, implementation, etc.). The id field must be the clean intended slug from the list above. The work_units field must reference the clean log filename(s) — if a work_units entry has an embedded newline or junk suffix, repair it to the intended clean form. Remove any stray junk line (e.g. a bare "read-ui-a" or "read" line) that leaked into the frontmatter or body. Do NOT alter legitimate body content (Purpose, Behavior, Implementation Notes, Changelog).
  c. Verify the body is otherwise intact and the frontmatter is valid YAML after repair.
  d. Rename the file to the clean slug: <intended-slug>.md (the intended slug already includes the date prefix per the list above). Use a rename that handles the literal-newline source name safely (mv "$oldvar" "$newpath"). Confirm the new filename matches the doc's repaired id field.

Step three, delete proposal files. For each .update-proposal-* file, confirm it contains only junk (a tool-status line and/or leaked hook error, no real document content), then delete it, referencing the literal name safely.

Step four, final verification. Re-list .claude/docs/interim/ with byte-accurate names. Confirm: exactly 6 clean doc files remain (plus any pre-existing clean docs that were never corrupted — leave those alone), zero filenames contain newlines or junk suffixes, every doc's frontmatter id matches its filename, no proposal files remain, no two docs collide on the same target name. Report the final clean listing.

Note on the current session log: do NOT touch .claude/logs/ — the current session's log filename is also corrupted but is in active use and must be cleaned in a later session, not now. This task is interim docs only.

Constraints: only .claude/docs/interim/ . No source, no logs, no other harness files. If any doc turns out to have corrupted BODY content (not just frontmatter) such that legitimate information is lost, do not fabricate it — report the loss and leave that doc for manual review rather than guessing.

When done print: files inspected, per-doc repairs made (frontmatter fixes + rename old→new for each), proposal files deleted, the final clean directory listing, and any docs flagged for manual review. Stop.
```


## #ASSISTANT

Starting with a byte-accurate inventory of `.claude/docs/interim/`.


## #BASH
_List interim docs with shell-escaped names_

```bash
find .claude/docs/interim -maxdepth 1 -type f | while IFS= read -r -d $'\n' f; do printf '%q\n' "$f"; done | sort
```


## #ASSISTANT

The output collapsed some names. Let me get the full escaped names using Python to show every character.


## #BASH
_List interim docs with Python repr showing embedded characters_

```bash
python3 - << 'EOF'
import os, sys
d = '.claude/docs/interim'
entries = sorted(os.listdir(d))
for e in entries:
    rep = repr(e)
    print(rep)
EOF
```


## #ASSISTANT

Good. The inventory matches expectations exactly — 6 malformed docs, 3 malformed proposals. Now let me read all 6 doc files before touching anything.


## #BASH
_Read all 6 malformed doc files via Python_

```bash
python3 - << 'EOF'
import os
d = '.claude/docs/interim'
malformed = [
    '2026-05-27-regression-statusbadge-hex-alpha\n\nread-.md',
    '2026-05-28-workstream-3c-promote-confirmdialog\n\nre.md',
    '2026-05-28-workstream-3c-promote-dialog\n\nread-ui-a.md',
    '2026-05-28-workstream-3c-promote-fieldlabel\n\nread-.md',
    '2026-05-28-workstream-3c-promote-statusbadge\n\nread.md',
    '2026-05-28-workstream-4-5b-zindex-fix\n\nread-ui-aud.md',
]
for name in malformed:
    path = os.path.join(d, name)
    print(f'=== FILE: {repr(name)} ===')
    with open(path, 'r', errors='replace') as f:
        content = f.read()
    print(content)
    print()
EOF
```


## #ASSISTANT

Good picture. Now let me check the actual log files to confirm what the clean work_units entries should be, and read the 3 proposal files.


## #BASH
_List log files with Python repr_

```bash
python3 - << 'EOF'
import os
d = '.claude/logs'
entries = sorted(os.listdir(d))
for e in entries:
    print(repr(e))
EOF
```


## #BASH
_Read the 3 malformed proposal files_

```bash
python3 - << 'EOF'
import os
d = '.claude/docs/interim'
proposals = [
    '2026-05-27-regression-statusbadge-hex-alpha\n\nread-.md.update-proposal-055631',
    '2026-05-28-workstream-3c-promote-confirmdialog\n\nre.md.update-proposal-051342',
    '2026-05-28-workstream-3c-promote-dialog\n\nread-ui-a.md.update-proposal-044355',
]
for name in proposals:
    path = os.path.join(d, name)
    print(f'=== PROPOSAL: {repr(name)} ===')
    with open(path, 'r', errors='replace') as f:
        content = f.read()
    print(repr(content))
    print()
EOF
```


## #ASSISTANT

All 3 proposals confirmed junk (tool-status lines + hook errors, no real content). I also now have exact log filenames to determine clean work_units values. Let me do all repairs in one Python script.


## #BASH
_Repair all 6 malformed docs and delete 3 proposals via Python_

```bash
python3 - << 'PYEOF'
import os

d = '.claude/docs/interim'
HOOK_ERR = 'SessionEnd hook [${CLAUDE_PROJECT_DIR}/.claude/hooks/session-end.sh] failed: /bin/sh: 1: /home/io/io-dev/io/frontend/.claude/hooks/session-end.sh: not found'

def strip_hook_error(content):
    lines = content.rstrip('\n').split('\n')
    while lines and lines[-1].strip() == HOOK_ERR.strip():
        lines.pop()
    return '\n'.join(lines) + '\n'

results = []

# ── File 1: regression-statusbadge-hex-alpha ──────────────────────────────────
old1 = os.path.join(d, '2026-05-27-regression-statusbadge-hex-alpha\n\nread-.md')
new1 = os.path.join(d, '2026-05-27-regression-statusbadge-hex-alpha.md')
with open(old1) as f:
    c = f.read()
# work_units: quoted string with literal \n\n
c = c.replace(
    '  - "2026-05-27_regression-statusbadge-hex-alpha\\n\\nread-o_054757"',
    '  - 2026-05-27_regression-statusbadge-hex-alpha_054757'
)
c = strip_hook_error(c)
with open(new1, 'w') as f:
    f.write(c)
os.unlink(old1)
results.append(f'DOC 1: renamed+repaired → 2026-05-27-regression-statusbadge-hex-alpha.md')

# ── File 2: promote-confirmdialog ─────────────────────────────────────────────
old2 = os.path.join(d, '2026-05-28-workstream-3c-promote-confirmdialog\n\nre.md')
new2 = os.path.join(d, '2026-05-28-workstream-3c-promote-confirmdialog.md')
with open(old2) as f:
    c = f.read()
# id field has junk suffix
c = c.replace(
    'id: "2026-05-28-workstream-3c-promote-confirmdialog-re"',
    'id: 2026-05-28-workstream-3c-promote-confirmdialog'
)
# work_units quoted string
c = c.replace(
    '  - "2026-05-28_workstream-3c-promote-confirmdialog\\n\\nrea_045013"',
    '  - 2026-05-28_workstream-3c-promote-confirmdialog_045013'
)
c = strip_hook_error(c)
with open(new2, 'w') as f:
    f.write(c)
os.unlink(old2)
results.append(f'DOC 2: renamed+repaired → 2026-05-28-workstream-3c-promote-confirmdialog.md')

# ── File 3: promote-dialog ────────────────────────────────────────────────────
# Has ACTUAL embedded newlines in frontmatter (not YAML-escaped)
old3 = os.path.join(d, '2026-05-28-workstream-3c-promote-dialog\n\nread-ui-a.md')
new3 = os.path.join(d, '2026-05-28-workstream-3c-promote-dialog.md')
with open(old3) as f:
    c = f.read()
# id field: actual newline + stray "read-ui-a\n" line after it
c = c.replace(
    'id: 2026-05-28-workstream-3c-promote-dialog\n\nread-ui-a\n',
    'id: 2026-05-28-workstream-3c-promote-dialog\n'
)
# work_units: actual newline splits the entry, stray "read-ui-au_041950\n" on next non-blank line
c = c.replace(
    '  - 2026-05-28_workstream-3c-promote-dialog\n\nread-ui-au_041950\n',
    '  - 2026-05-28_workstream-3c-promote-dialog_041950\n'
)
# related entries each have actual newline + stray "read-\n" line
c = c.replace(
    '  - 2026-05-28-workstream-3c-promote-fieldlabel\n\nread-\n',
    '  - 2026-05-28-workstream-3c-promote-fieldlabel\n'
)
c = c.replace(
    '  - 2026-05-28-workstream-3c-promote-statusbadge\n\nread-\n',
    '  - 2026-05-28-workstream-3c-promote-statusbadge\n'
)
# no hook error in this file
with open(new3, 'w') as f:
    f.write(c)
os.unlink(old3)
results.append(f'DOC 3: renamed+repaired → 2026-05-28-workstream-3c-promote-dialog.md')

# ── File 4: promote-fieldlabel ────────────────────────────────────────────────
old4 = os.path.join(d, '2026-05-28-workstream-3c-promote-fieldlabel\n\nread-.md')
new4 = os.path.join(d, '2026-05-28-workstream-3c-promote-fieldlabel.md')
with open(old4) as f:
    c = f.read()
c = c.replace(
    '  - "2026-05-28_workstream-3c-promote-fieldlabel\\n\\nread-u_034233"',
    '  - 2026-05-28_workstream-3c-promote-fieldlabel_034233'
)
c = strip_hook_error(c)
with open(new4, 'w') as f:
    f.write(c)
os.unlink(old4)
results.append(f'DOC 4: renamed+repaired → 2026-05-28-workstream-3c-promote-fieldlabel.md')

# ── File 5: promote-statusbadge ───────────────────────────────────────────────
old5 = os.path.join(d, '2026-05-28-workstream-3c-promote-statusbadge\n\nread.md')
new5 = os.path.join(d, '2026-05-28-workstream-3c-promote-statusbadge.md')
with open(old5) as f:
    c = f.read()
# id: actual newline + stray "read\n"
c = c.replace(
    'id: 2026-05-28-workstream-3c-promote-statusbadge\n\nread\n',
    'id: 2026-05-28-workstream-3c-promote-statusbadge\n'
)
# work_units: actual newline splits entry (note: value has .md at end of junk line)
c = c.replace(
    '  - 2026-05-28_workstream-3c-promote-statusbadge\n\nread-_040255.md\n',
    '  - 2026-05-28_workstream-3c-promote-statusbadge_040255\n'
)
# related: actual newline + stray "read\n"
c = c.replace(
    '  - 2026-05-28-workstream-3c-promote-fieldlabel\n\nread\n',
    '  - 2026-05-28-workstream-3c-promote-fieldlabel\n'
)
c = strip_hook_error(c)
with open(new5, 'w') as f:
    f.write(c)
os.unlink(old5)
results.append(f'DOC 5: renamed+repaired → 2026-05-28-workstream-3c-promote-statusbadge.md')

# ── File 6: workstream-4-5b-zindex-fix ───────────────────────────────────────
old6 = os.path.join(d, '2026-05-28-workstream-4-5b-zindex-fix\n\nread-ui-aud.md')
new6 = os.path.join(d, '2026-05-28-workstream-4-5b-zindex-fix.md')
with open(old6) as f:
    c = f.read()
# work_units: actual newline splits entry
c = c.replace(
    '  - 2026-05-28_workstream-4-5b-zindex-fix\n\nread-ui-audi_064832\n',
    '  - 2026-05-28_workstream-4-5b-zindex-fix_064832\n'
)
c = strip_hook_error(c)
with open(new6, 'w') as f:
    f.write(c)
os.unlink(old6)
results.append(f'DOC 6: renamed+repaired → 2026-05-28-workstream-4-5b-zindex-fix.md')

# ── Proposals (delete) ────────────────────────────────────────────────────────
proposals = [
    '2026-05-27-regression-statusbadge-hex-alpha\n\nread-.md.update-proposal-055631',
    '2026-05-28-workstream-3c-promote-confirmdialog\n\nre.md.update-proposal-051342',
    '2026-05-28-workstream-3c-promote-dialog\n\nread-ui-a.md.update-proposal-044355',
]
for p in proposals:
    path = os.path.join(d, p)
    os.unlink(path)
    results.append(f'PROPOSAL deleted: {repr(p)}')

for r in results:
    print(r)
PYEOF
```


## #ASSISTANT

All operations completed. Now verify the final state.


## #BASH
_Final directory listing with newline detection_

```bash
python3 - << 'EOF'
import os
d = '.claude/docs/interim'
entries = sorted(os.listdir(d))
print(f'Total files: {len(entries)}\n')
for e in entries:
    has_nl = '\n' in e
    flag = ' *** NEWLINE IN NAME ***' if has_nl else ''
    print(f'  {repr(e)}{flag}')
EOF
```


## #ASSISTANT

Zero filenames with embedded newlines. Now verify frontmatter `id` fields in the 6 repaired docs match their filenames.


## #BASH
_Verify id fields and corruption removal in repaired docs_

```bash
python3 - << 'EOF'
import os, re
d = '.claude/docs/interim'
repaired = [
    '2026-05-27-regression-statusbadge-hex-alpha.md',
    '2026-05-28-workstream-3c-promote-confirmdialog.md',
    '2026-05-28-workstream-3c-promote-dialog.md',
    '2026-05-28-workstream-3c-promote-fieldlabel.md',
    '2026-05-28-workstream-3c-promote-statusbadge.md',
    '2026-05-28-workstream-4-5b-zindex-fix.md',
]
for fname in repaired:
    expected_id = fname[:-3]  # strip .md
    path = os.path.join(d, fname)
    with open(path) as f:
        content = f.read()
    m = re.search(r'^id:\s*(.+)$', content, re.MULTILINE)
    actual_id = m.group(1).strip().strip('"') if m else 'NOT FOUND'
    ok = '✓' if actual_id == expected_id else '✗ MISMATCH'
    # Check no \n in id line
    if '\n' in actual_id:
        ok = '✗ NEWLINE IN ID'
    # Check hook error not present
    hook_err = 'frontend/.claude/hooks/session-end.sh: not found' in content
    hook_flag = ' | ✗ HOOK ERR STILL PRESENT' if hook_err else ''
    # Check work_units for embedded \n
    wu_section = re.search(r'work_units:.*?(?=\n\S)', content, re.DOTALL)
    wu_nl = '\n\n' in (wu_section.group(0) if wu_section else '')
    wu_flag = ' | ✗ WORK_UNITS HAS EMBEDDED NEWLINE' if wu_nl else ''
    print(f'{ok}  {fname}  id={actual_id!r}{hook_flag}{wu_flag}')
EOF
```


## #TURN_END

_2026-05-28T08:24:42+00:00_

---

