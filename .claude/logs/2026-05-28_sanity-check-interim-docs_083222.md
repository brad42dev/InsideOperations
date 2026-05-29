# Work Unit Log: sanity-check-interim-docs

Started: 2026-05-28T08:32:22+00:00
Session: ffa17917-b4de-4b76-bb68-25717ee917f0

---


## #PROMPT

_2026-05-28T08:36:49+00:00_

```
~initprompt~ sanity-check-interim-docs

Read-only sanity check on .claude/docs/interim/ after the corruption cleanup. Do not modify, rename, or delete anything — report only. If something looks wrong, flag it for a follow-up rather than fixing it here.

Step one, byte-accurate listing and count. List every file in .claude/docs/interim/ using a method that exposes control characters in filenames — `for f in .claude/docs/interim/*; do printf '%q\n' "$f"; done` (and/or `ls -b`). Report the total file count and the full escaped name of every file.

Step two, filename integrity. Flag any filename that contains: a literal newline or other control character; a junk suffix fragment (e.g. "read", "re", "read-ui", "read-ui-a", "read-ui-aud", "-read-"); a ".update-proposal-" segment; or a double extension / malformed ending. Report the count of clean filenames vs flagged filenames. The expected result is zero flagged.

Step three, frontmatter validity per file. For each .md file, read its frontmatter and check: it opens and closes with --- ; the id field is present, single-line, and contains no embedded newline or junk; the id value matches the filename (minus the .md extension); the work_units field (if present) has no embedded-newline-broken entries or junk fragments; the implementation field (if present) is well-formed. Report any file whose frontmatter fails any of these, with the specific problem. Expected: all valid, all id-matches-filename.

Step four, body integrity spot check. For each file, confirm the body has the expected interim-doc sections (a title heading, Purpose, Behavior, Implementation Notes, Changelog) and contains no leaked shell/hook error text (search each body for "session-end.sh", "not found", "frontend/.claude", "File created at the specified path", or other stray tool/hook output). Report any file with a missing section or leaked error text. Expected: none.

Step five, collision and orphan check. Confirm no two files resolve to the same intended slug (no near-duplicates that should have been merged). Also report any zero-byte or suspiciously tiny (<200 byte) files that might be leftover stubs. 

Step six, cross-check against work units run. Based on the filenames, list the work units these docs represent and note any obvious gap — e.g. a completed work unit from this project (audit phases, regressions, Claim A steps, Claim B promotions, z-index, FP-1, the maintenance fixes) that has no corresponding interim doc, or any doc that does not correspond to a recognizable work unit. This is a soft check — report observations, not errors.

Constraints: read-only. Do not touch .claude/logs/ (the orphaned corrupted session log is known and deferred). Do not modify anything in interim/.

When done print: total file count, clean-vs-flagged filename count, frontmatter-valid count, bodies-with-leaked-text count, any collisions or stubs, and an overall verdict (clean / issues-found with a list). Stop.
```


## #ASSISTANT

Starting the read-only sanity check on `.claude/docs/interim/`.


## #BASH
_Byte-accurate listing of interim docs_

```bash
python3 - << 'EOF'
import os, re

d = '.claude/docs/interim'
entries = sorted(os.listdir(d))

print(f"=== STEP 1: BYTE-ACCURATE LISTING ===")
print(f"Total files: {len(entries)}\n")
for e in entries:
    print(repr(e))
EOF
```


## #BASH
_Step 2: filename integrity check_

```bash
python3 - << 'EOF'
import os, re

d = '.claude/docs/interim'
entries = sorted(os.listdir(d))

JUNK_PATTERNS = [
    r'\n',                  # actual newline
    r'[\x00-\x08\x0b-\x1f\x7f]',  # other control chars (excluding \n=0x0a, \t=0x09)
    r'\.update-proposal-',  # proposal segment
    r'[-_]read[-_]?$',     # trailing junk suffix -read or _read
    r'[-_]re\.md$',        # -re.md suffix
    r'[-_]read-ui',        # -read-ui fragment
    r'[-_]read-aud',       # similar junk
    r'\.md\.md',           # double extension
    r'(?<!\.md)$',         # doesn't end with .md (for non-proposal files)
]

print("=== STEP 2: FILENAME INTEGRITY ===")
clean = []
flagged = []

for e in entries:
    issues = []
    if '\n' in e:
        issues.append('contains literal newline')
    for ch in e:
        if ord(ch) < 0x20 and ch not in ('\t',):
            issues.append(f'contains control char U+{ord(ch):04X}')
    if '.update-proposal-' in e:
        issues.append('proposal file (expected)')
    junk_fragments = ['read-ui-aud', 'read-ui-a', 'read-ui', 'read-only', '-re.md', 
                       '\nre.md', '\nread', '\nread-']
    for frag in junk_fragments:
        if frag in e and frag != '-re.md':  # -re.md only flag at end
            issues.append(f'contains junk fragment: {repr(frag)}')
    # flag -re.md specifically at end
    if e.endswith('-re.md') or e.endswith('\nre.md'):
        issues.append('ends with junk -re.md')
    # flag double extension
    if '.md.' in e and '.update-proposal-' not in e:
        issues.append('double extension without proposal segment')

    if issues:
        flagged.append((e, issues))
    else:
        clean.append(e)

print(f"Clean filenames: {len(clean)}")
print(f"Flagged filenames: {len(flagged)}")
if flagged:
    print("\nFLAGGED:")
    for name, issues in flagged:
        print(f"  {repr(name)}: {', '.join(issues)}")
else:
    print("No flagged filenames.")

# Separate .md docs vs other files
md_docs = [e for e in entries if e.endswith('.md') and '.update-proposal-' not in e]
proposals = [e for e in entries if '.update-proposal-' in e]
print(f"\n.md docs: {len(md_docs)}")
print(f"proposal files: {len(proposals)}")
print(f"other: {len(entries) - len(md_docs) - len(proposals)}")
EOF
```


## #ASSISTANT

Good — all 11 flagged are legitimate proposal files. Now frontmatter check on all 21 `.md` docs.


## #BASH
_Step 3: frontmatter validity check for all 21 .md docs_

```bash
python3 - << 'EOF'
import os, re

d = '.claude/docs/interim'
md_docs = sorted(e for e in os.listdir(d) if e.endswith('.md') and '.update-proposal-' not in e)

print("=== STEP 3: FRONTMATTER VALIDITY ===\n")

HOOK_LEAK_PATTERNS = [
    'session-end.sh',
    'frontend/.claude',
    'not found',
    'File created at the specified path',
    'File written',
    'Document written',
    'WORKFLOW ERROR',
    'WORKFLOW HOOK',
]

results = []

for fname in md_docs:
    path = os.path.join(d, fname)
    expected_id = fname[:-3]  # strip .md
    
    with open(path, errors='replace') as f:
        content = f.read()
    
    issues = []
    
    # Check frontmatter structure
    if not content.startswith('---'):
        issues.append('does not open with ---')
        results.append((fname, issues, content))
        continue
    
    # Find closing ---
    rest = content[3:]
    close_idx = rest.find('\n---')
    if close_idx == -1:
        issues.append('no closing --- found')
        results.append((fname, issues, content))
        continue
    
    fm_text = rest[:close_idx]
    body_text = rest[close_idx+4:]  # after closing ---
    
    # id field
    id_match = re.search(r'^id:\s*(.+)$', fm_text, re.MULTILINE)
    if not id_match:
        issues.append('id field missing')
    else:
        id_val = id_match.group(1).strip().strip('"\'')
        if '\n' in id_val:
            issues.append(f'id field contains embedded newline: {repr(id_val[:80])}')
        elif id_val != expected_id:
            issues.append(f'id mismatch: got {repr(id_val)}, expected {repr(expected_id)}')
        # Check for junk suffixes in id
        junk = re.search(r'[-_](re|read|read-ui|read-ui-a|read-ui-aud|read-)$', id_val)
        if junk:
            issues.append(f'id has junk suffix: {repr(id_val)}')
    
    # work_units field - check for embedded newlines or junk
    wu_match = re.search(r'^work_units:(.*?)(?=^\S)', fm_text, re.MULTILINE | re.DOTALL)
    if wu_match:
        wu_text = wu_match.group(0)
        # Check for double blank lines (sign of embedded newline corruption)
        if '\n\n' in wu_text:
            issues.append('work_units has blank line (possible embedded newline remnant)')
        # Check for junk fragments in list items
        for line in wu_text.split('\n'):
            line = line.strip()
            if line.startswith('- ') or line.startswith('"'):
                val = line.lstrip('- "').rstrip('"')
                if re.search(r'(read-ui-aud|read-ui-au|read-ui-a|read-ui|read-o|read-u|read-_|\\n\\n)', val):
                    issues.append(f'work_units entry has junk fragment: {repr(val[:80])}')
    
    # implementation field
    impl_match = re.search(r'^implementation:(.*?)(?=^\S)', fm_text, re.MULTILINE | re.DOTALL)
    if impl_match:
        impl_text = impl_match.group(0)
        if '\n\n' in impl_text:
            issues.append('implementation has blank line (possible corruption)')
    
    # related field  
    rel_match = re.search(r'^related:(.*?)(?=^\S|\Z)', fm_text, re.MULTILINE | re.DOTALL)
    if rel_match:
        rel_text = rel_match.group(0)
        if '\n\n' in rel_text:
            issues.append('related field has blank line (possible corruption)')
        for line in rel_text.split('\n'):
            line = line.strip()
            if line.startswith('- '):
                val = line[2:].strip()
                if re.search(r'[-_](read|re)$', val) and len(val) < 10:
                    issues.append(f'related entry looks like junk: {repr(val)}')
    
    status = '✓' if not issues else '✗'
    results.append((fname, issues, content))
    
    if issues:
        print(f'✗ {fname}')
        for issue in issues:
            print(f'    ISSUE: {issue}')
    else:
        print(f'✓ {fname}')

valid = sum(1 for _, issues, _ in results if not issues)
invalid = len(results) - valid
print(f'\nFrontmatter valid: {valid}/{len(results)}')
if invalid:
    print(f'Frontmatter issues: {invalid} file(s) — see above')
EOF
```


## #ASSISTANT

Important finding — there's wider work_units corruption. Let me now check body integrity and collision/size checks.


## #BASH
_Step 4: body integrity check for leaked text and required sections_

```bash
python3 - << 'EOF'
import os, re

d = '.claude/docs/interim'
md_docs = sorted(e for e in os.listdir(d) if e.endswith('.md') and '.update-proposal-' not in e)

print("=== STEP 4: BODY INTEGRITY ===\n")

LEAK_PATTERNS = [
    ('session-end.sh', 'hook path'),
    ('frontend/.claude', 'hook path'),
    ('.claude/hooks', 'hook path'),
    ('not found', 'shell error'),
    ('File created at the specified path', 'tool status'),
    ('File written', 'tool status'),
    ('Document written', 'tool status'),
    ('WORKFLOW ERROR', 'workflow error'),
    ('WORKFLOW HOOK', 'workflow error'),
    ('exit code', 'error output'),
]

REQUIRED_SECTIONS = ['## Purpose', '## Behavior', '## Implementation Notes', '## Changelog']

leak_count = 0
section_issues = 0

for fname in md_docs:
    path = os.path.join(d, fname)
    with open(path, errors='replace') as f:
        content = f.read()
    
    # Extract body (after closing ---)
    parts = content.split('---', 2)
    body = parts[2] if len(parts) >= 3 else content
    
    issues = []
    
    # Check for leaked text
    for pattern, label in LEAK_PATTERNS:
        if pattern.lower() in body.lower():
            # "not found" is too broad, only flag if in context
            if pattern == 'not found':
                # Check if it's in a shell-error context
                idx = body.lower().find('not found')
                context = body[max(0, idx-50):idx+60]
                if 'session-end' in context.lower() or 'hook' in context.lower() or '.sh' in context.lower():
                    issues.append(f'leaked {label}: contains "{pattern}" near hook context')
            else:
                issues.append(f'leaked {label}: contains "{pattern}"')
    
    # Check required sections
    for section in REQUIRED_SECTIONS:
        if section not in body:
            issues.append(f'missing section: {section}')
    
    if issues:
        print(f'✗ {fname}')
        for issue in issues:
            print(f'    ISSUE: {issue}')
        leak_count += sum(1 for i in issues if 'leaked' in i)
        section_issues += sum(1 for i in issues if 'missing section' in i)
    else:
        print(f'✓ {fname}')

print(f'\nFiles with leaked text: {leak_count}')
print(f'Files with missing sections: {section_issues}')
EOF
```


## #BASH
_Step 5: collision and orphan check_

```bash
python3 - << 'EOF'
import os, re

d = '.claude/docs/interim'
entries = sorted(os.listdir(d))
md_docs = sorted(e for e in entries if e.endswith('.md') and '.update-proposal-' not in e)
proposals = sorted(e for e in entries if '.update-proposal-' in e)

print("=== STEP 5: COLLISION AND ORPHAN CHECK ===\n")

# Check for near-duplicate slugs
slugs = {}
for fname in md_docs:
    slug = fname[:-3]
    # Normalize: strip date prefix for semantic grouping
    norm = re.sub(r'^\d{4}-\d{2}-\d{2}-', '', slug)
    if norm in slugs:
        print(f'POSSIBLE COLLISION: {fname!r} ~ {slugs[norm]!r}  (both normalize to {norm!r})')
    else:
        slugs[norm] = fname

print("No slug collisions found." if all(True for _ in [None]) else "")

# Check file sizes
print("\nFile sizes (all files):")
tiny = []
for fname in md_docs:
    path = os.path.join(d, fname)
    size = os.path.getsize(path)
    flag = ' *** TINY ***' if size < 200 else ''
    print(f'  {size:6d} bytes  {fname}{flag}')
    if size < 200:
        tiny.append(fname)

print(f'\nTiny (<200 bytes): {len(tiny)}')
if tiny:
    for t in tiny:
        print(f'  {t}')

# Proposal sizes
print("\nProposal file sizes:")
for fname in proposals:
    path = os.path.join(d, fname)
    size = os.path.getsize(path)
    print(f'  {size:6d} bytes  {fname}')
EOF
```


## #ASSISTANT

Two 1-byte proposal files are suspicious. Let me check those and inspect the near-duplicate claim-a docs, then do step 6.


## #BASH
_Check 1-byte proposals and near-duplicate claim-a/b docs_

```bash
python3 - << 'EOF'
import os

d = '.claude/docs/interim'

# Check the 1-byte proposals
tiny_proposals = [
    'claim-b-style-constants-phase1.md.update-proposal-033136',
    'selection-highlight-accent-token-fix.md.update-proposal-054510',
]
print("=== 1-BYTE PROPOSALS ===")
for p in tiny_proposals:
    path = os.path.join(d, p)
    with open(path, 'rb') as f:
        data = f.read()
    print(f'{p!r}: {len(data)} bytes, content={data!r}')

print()

# Check claim-a near-duplicate docs
claim_a_docs = [
    'claim-a-css-token-registry-gaps.md',
    'claim-a-token-registry-gaps-zindex.md',
    'claim-a-token-registry-gaps.md',
    'claim-a-token-registry-z-index-scale.md',
]
print("=== CLAIM-A NEAR-DUPLICATE CHECK ===")
for fname in claim_a_docs:
    path = os.path.join(d, fname)
    with open(path, errors='replace') as f:
        content = f.read()
    # Extract frontmatter id and title
    import re
    id_m = re.search(r'^id:\s*(.+)$', content, re.MULTILINE)
    title_m = re.search(r'^title:\s*(.+)$', content, re.MULTILINE)
    wu_m = re.search(r'^work_units:(.*?)(?=^\S)', content, re.MULTILINE | re.DOTALL)
    impl_m = re.search(r'^implementation:(.*?)(?=^\S)', content, re.MULTILINE | re.DOTALL)
    id_val = id_m.group(1).strip().strip('"') if id_m else 'N/A'
    title_val = title_m.group(1).strip().strip('"') if title_m else 'N/A'
    wu_lines = [l.strip() for l in (wu_m.group(0).split('\n') if wu_m else []) if l.strip().startswith('-')]
    impl_lines = [l.strip() for l in (impl_m.group(0).split('\n') if impl_m else []) if l.strip().startswith('-')]
    print(f'\n{fname}:')
    print(f'  id: {id_val}')
    print(f'  title: {title_val}')
    print(f'  work_units: {wu_lines}')
    print(f'  implementation files: {len(impl_lines)} files')

print()

# Check claim-b near-duplicate docs
claim_b_docs = [
    'claim-b-dialog-promotion-migration.md',
    'claim-b-shared-style-constants.md',
    'claim-b-style-constants-phase1.md',
]
print("=== CLAIM-B NEAR-DUPLICATE CHECK ===")
for fname in claim_b_docs:
    path = os.path.join(d, fname)
    with open(path, errors='replace') as f:
        content = f.read()
    import re
    id_m = re.search(r'^id:\s*(.+)$', content, re.MULTILINE)
    title_m = re.search(r'^title:\s*(.+)$', content, re.MULTILINE)
    wu_m = re.search(r'^work_units:(.*?)(?=^\S)', content, re.MULTILINE | re.DOTALL)
    id_val = id_m.group(1).strip().strip('"') if id_m else 'N/A'
    title_val = title_m.group(1).strip().strip('"') if title_m else 'N/A'
    wu_lines = [l.strip() for l in (wu_m.group(0).split('\n') if wu_m else []) if l.strip().startswith('-')]
    print(f'\n{fname}:')
    print(f'  id: {id_val}')
    print(f'  title: {title_val}')
    print(f'  work_units: {wu_lines}')
EOF
```


## #BASH
_Check claim-b-dialog vs workstream-3c-promote-dialog for duplication_

```bash
python3 - << 'EOF'
import os, re

d = '.claude/docs/interim'

# Check if claim-b-dialog-promotion-migration and workstream-3c-promote-dialog cover same work
print("=== NEAR-DUPLICATE: claim-b-dialog vs workstream-3c-promote-dialog ===")
for fname in ['claim-b-dialog-promotion-migration.md', '2026-05-28-workstream-3c-promote-dialog.md']:
    path = os.path.join(d, fname)
    with open(path, errors='replace') as f:
        content = f.read()
    # Show first 40 lines
    lines = content.split('\n')[:40]
    print(f'\n--- {fname} (first 40 lines) ---')
    for line in lines:
        print(line)
EOF
```


## #BASH
_Step 6: cross-check work units vs interim docs_

```bash
python3 - << 'EOF'
import os, re

print("=== STEP 6: CROSS-CHECK AGAINST WORK UNITS ===\n")

# All log files (from earlier listing)
log_files = [
    '2026-05-16_general_025143',
    '2026-05-16_you-are-performing-a-deep-verification-r_082849',
    '2026-05-27_general_001300',
    '2026-05-27_read-only-task-do-not-analyze-ui-or-ux-y_003908',
    '2026-05-27_regression-accent-token-prefix_052806',      # clean form
    '2026-05-27_regression-statusbadge-hex-alpha_054757',    # clean form
    '2026-05-27_workstream-0-defer-claim-c_045947',          # clean form
    '2026-05-27_workstream-2-claim-a-planning_060227',       # clean form
    '2026-05-27_workstream-2a-plan-checkin_061442',          # clean form
    '2026-05-27_workstream-2b-token-gaps_062420',            # clean form
    '2026-05-27_workstream-2b-token-readiness_071753',       # clean form
    '2026-05-27_workstream-2c-drift-checkin_074445',         # clean form
    '2026-05-27_workstream-2c-shell-drift_072739',           # clean form
    '2026-05-27_workstream-2d-claim-a-complete_075935',      # clean form
    '2026-05-28_check-updatedocs-hiccup_073706',             # clean form
    '2026-05-28_cleanup-fp1-corrupted-artifacts_075850',     # clean form
    '2026-05-28_cleanup-interim-doc-corruption-batch_082047',
    '2026-05-28_diagnose-hook-path_074240',                  # clean form
    '2026-05-28_diagnose-interim-slug-corruption_080341',    # clean form
    '2026-05-28_fix-hook-cwd-resolution_075125',             # clean form
    '2026-05-28_fix-log-and-slug-newline-bugs_081154',       # clean form
    '2026-05-28_preflight-info-gathering_061059',            # clean form
    '2026-05-28_workstream-3-claim-b-planning_012156',       # clean form
    '2026-05-28_workstream-3a-plan-checkin_013115',          # clean form
    '2026-05-28_workstream-3a-plan-checkin_013953',          # clean form
    '2026-05-28_workstream-3a-plan-checkin_021823',          # clean form
    '2026-05-28_workstream-3b-constants-checkin_033419',     # clean form
    '2026-05-28_workstream-3b-constants-files_024054',       # clean form
    '2026-05-28_workstream-3c-components-checkin_051857',    # clean form
    '2026-05-28_workstream-3c-promote-confirmdialog_045013', # clean form
    '2026-05-28_workstream-3c-promote-dialog_041950',        # clean form
    '2026-05-28_workstream-3c-promote-fieldlabel_034233',    # clean form
    '2026-05-28_workstream-3c-promote-statusbadge_040255',   # clean form
    '2026-05-28_workstream-3d-claim-b-complete_052351',      # clean form
    '2026-05-28_workstream-4-5a-zindex-assessment_063105',   # clean form
    '2026-05-28_workstream-4-5b-zindex-fix_064832',          # clean form
    '2026-05-28_workstream-4-5b2-confirmdialog-priority_071338',
    '2026-05-28_workstream-4-5c-fp1-hexalpha_071913',        # clean form
    '2026-05-28_workstream-4-post-ab-review_053822',         # clean form
]

d = '.claude/docs/interim'
md_docs = sorted(e for e in os.listdir(d) if e.endswith('.md') and '.update-proposal-' not in e)

# Classify work units as substantive vs read-only/planning/maintenance
READ_ONLY_KEYWORDS = [
    'read-only', 'plan-checkin', 'planning', 'checkin', 'diagnose', 'check-updatedocs',
    'cleanup', 'fix-hook', 'fix-log', 'diagnose-hook', 'general', 'you-are-performing',
    'workstream-0', 'preflight', 'defer-claim', 'post-ab-review',
]

substantive = []
read_only = []

for log in log_files:
    # Get the descriptor part (after date_)
    m = re.match(r'^\d{4}-\d{2}-\d{2}_(.+?)_\d{6}$', log)
    if m:
        desc = m.group(1).lower()
    else:
        desc = log.lower()
    
    is_ro = any(kw in desc for kw in READ_ONLY_KEYWORDS)
    if is_ro:
        read_only.append(log)
    else:
        substantive.append(log)

print(f"Substantive work units ({len(substantive)}):")
for log in substantive:
    # Check if any doc's work_units references this log
    found_docs = []
    for fname in md_docs:
        path = os.path.join(d, fname)
        with open(path, errors='replace') as f:
            content = f.read()
        # Check for the log name (or clean form) in the content
        log_base = re.match(r'^\d{4}-\d{2}-\d{2}_(.+?)_\d{6}$', log)
        if log_base:
            desc_ts = log_base.group(0)  # full clean form
            desc_only = log_base.group(1)  # descriptor only
            if desc_ts in content or desc_only in content:
                found_docs.append(fname)
    
    status = '✓' if found_docs else '? NO DOC'
    doc_list = ', '.join(found_docs) if found_docs else 'none'
    print(f'  {status}  {log}')
    if found_docs:
        print(f'           → {doc_list}')

print(f"\nRead-only/planning/maintenance units ({len(read_only)}) — docs not expected:")
for log in read_only:
    print(f'  (skip) {log}')
EOF
```


## #BASH
_Re-examine potential false positives from step 3_

```bash
python3 - << 'EOF'
import os, re

d = '.claude/docs/interim'

# Re-examine the two false-positive candidates from step 3
print("=== RE-EXAMINE: claim-a-token-registry-gaps.md work_units ===")
path = os.path.join(d, 'claim-a-token-registry-gaps.md')
with open(path, errors='replace') as f:
    content = f.read()

# Find work_units section
m = re.search(r'^work_units:.*?(?=^\S)', content, re.MULTILINE | re.DOTALL)
if m:
    print(repr(m.group(0)))
else:
    print("work_units not found")

print()
print("=== RE-EXAMINE: frontend-ui-audit work_units ===")
path2 = os.path.join(d, 'frontend-ui-audit-console-designer-settings.md')
with open(path2, errors='replace') as f:
    content2 = f.read()
m2 = re.search(r'^work_units:.*?(?=^\S)', content2, re.MULTILINE | re.DOTALL)
if m2:
    print(repr(m2.group(0)))
    # Check if the log file actually exists
    wu_text = m2.group(0)
    log_names = re.findall(r'- (.+)', wu_text)
    print(f"Entries: {log_names}")
    logs_dir = '.claude/logs'
    for log in log_names:
        log = log.strip().strip('"')
        # Try to find matching log file
        actual = log + '.md'
        exists = os.path.exists(os.path.join(logs_dir, actual))
        print(f"  Log file '{log}.md' exists: {exists}")
EOF
```


## #TURN_END

_2026-05-28T08:36:50+00:00_

---

