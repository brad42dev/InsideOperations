# Workflow Batch 7 — Final Remaining Items
_Created: 2026-03-25 — After Batch 6 completion. Read at session start._

---

## Context

Batches 1–6 are fully complete. See:
- docs/WORKFLOW_IMPROVEMENT_PLAN.md — all P1–P5 items plus Batch 5 items
- docs/WORKFLOW_BATCH6_PLAN.md — B6-A through B6-G, all done

Two items remain. Work top to bottom.

---

## Items

### B7-A: H3 — Browser state leaks between UAT scenarios
**Effort: LOW — Spec edit only (uat-agent.md)**
**File: .claude/agents/uat-agent.md**

Between Phase 4 scenarios, the browser stays in whatever state the prior scenario
left it: wrong URL, open modal, stale filter, or partially logged-out state. The
next scenario begins from that dirty state rather than a clean baseline. This
corrupts multi-scenario runs — a scenario that would pass in isolation fails
because scenario N-1 navigated somewhere weird.

Fix: At the top of the Phase 4 scenario loop, before running each scenario,
add a reset step. Insert after the "Before running any scenarios" preamble
and before the first scenario begins:

**Per-scenario reset (runs before EACH scenario, not just the first):**
```
At the start of each scenario:
1. browser_navigate: http://localhost:5173
2. browser_wait_for: time=1000
3. Take a snapshot — confirm the app is responsive (any page, not an error/blank screen)
   If the snapshot shows an error, blank, or login screen (session expired):
   - Re-login using the same sequence as Phase 3 login
   - If login fails: mark this scenario ❌ fail with note "browser_state_reset_failed — could not restore session"
     and continue to the next scenario (do not crash-streak for a reset failure)
4. Proceed with the scenario as written
```

This reset is cheap: a navigation to the app root takes <1 second and eliminates
cross-scenario contamination. It does NOT require a full browser restart — just
a nav to ensure the URL and modal state are clean.

Status: [x] done

---

### B7-B: P6-A — Duplicate startup logic in io-run.sh
**Effort: MEDIUM — io-run.sh refactor**
**File: io-run.sh**

The backend/frontend health-check/startup block is copy-pasted 4 times across
uat, release-uat, integration-test, and the combined startup block. Any bug fix
or improvement must be applied 4 times.

Fix: Extract two functions at the top of io-run.sh (after existing helper functions):

```bash
ensure_backend_running() {
    # Check if backend is already up
    if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
        echo "✓ Backend already running"
        return 0
    fi
    # ... wait loop with timeout, error on failure
    local TRIES=0
    while ! curl -sf http://localhost:3000/health >/dev/null 2>&1; do
        TRIES=$((TRIES + 1))
        if [ "$TRIES" -ge 30 ]; then
            echo "✗ Backend not responding after 30s — start it first"
            return 1
        fi
        sleep 1
    done
    echo "✓ Backend ready"
}

ensure_frontend_running() {
    # Same pattern for http://localhost:5173
    ...
}
```

Then replace the 4 copy-pasted blocks with calls to these functions.

Run `bash -n io-run.sh` after any change. This is a refactor — behavior must
be identical before and after. If the current copy-pasted blocks differ from
each other (likely), match the most complete version.

Note: B7-B is cosmetic/maintenance. Do B7-A first. If context is short,
stop after B7-A and leave B7-B for later — it has zero correctness impact.

Status: [x] done

---

## Execution Order

1. Read uat-agent.md, make B7-A edit, verify with grep, mark done
2. Read io-run.sh, make B7-B refactor, verify with bash -n, mark done

After both items: update WORKFLOW_IMPROVEMENT_PLAN.md deferred section to
reflect H3 and P6-A as done.

---

## Notes

- `bash -n io-run.sh` after any io-run.sh change
- For uat-agent.md: grep for "browser_state_reset_failed" after edit to confirm landing
- This is the last planned batch — no further workflow items are queued after B7
