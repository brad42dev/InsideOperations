---
name: spec-index
description: Print a quick-reference index of every audit unit — unit ID, canonical name, wave, and current task status. Use this to look up the correct unit ID or module name before running spec-scout or feature-agent.
---

# Spec Index

Print a quick-reference index of every unit in the project. Use this when you've forgotten what something is called, want to confirm a unit ID before running spec-scout, or just need a fast overview of what exists and where things stand.

## Steps

1. Read `docs/SPEC_MANIFEST.md` — extract unit IDs and their human-readable names from the Audit Execution Order section.

2. Read `comms/AUDIT_PROGRESS.json` — for each unit in `unit_queue`, read:
   - `wave`
   - `last_audit_round` (null = never audited)
   - `verified_since_last_audit`
   - Task counts: count entries in `task_registry` matching this unit, broken down by status (pending/completed/verified)

3. Output the following table. Do not add prose before or after — just the index.

```
SPEC INDEX — I/O Project
Updated: <today's date>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WAVE 0 — Cross-Cutting Contracts (applied to every qualifying module)
  These are not standalone units — they are injected into Wave 1–3 audits.

  CX-EXPORT          Universal export button + 6 formats in every module
  CX-POINT-CONTEXT   Point right-click context menu (all modules)
  CX-ENTITY-CONTEXT  Entity list row right-click CRUD menu
  CX-CANVAS-CONTEXT  Designer canvas right-click menus (MOD-DESIGNER only)
  CX-POINT-DETAIL    Point Detail floating panel
  CX-PLAYBACK        Historical Playback Bar (time-aware modules)
  CX-RBAC            Per-module RBAC on every route, action, and CTA
  CX-ERROR           React error boundary + [Reload Module] recovery
  CX-LOADING         Module-shaped skeleton loading states
  CX-EMPTY           Tailored empty states (not generic "No data found")
  CX-TOKENS          Design token compliance — all 3 themes, no hardcoded colors
  CX-KIOSK           Kiosk mode (?kiosk=true) in applicable modules

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WAVE 1 — Graphics Foundation
  Unit           Name                              Tasks   Verified  Pending  Audited
  ─────────────────────────────────────────────────────────────────────────────────
  GFX-CORE       Graphics scene graph + pipeline    <N>     <N>       <N>      <yes/no>
  GFX-DISPLAY    Point value display elements       <N>     <N>       <N>      <yes/no>
  GFX-SHAPES     Equipment shape library            <N>     <N>       <N>      <yes/no>

WAVE 2 — Module Consumers
  Unit           Name                              Tasks   Verified  Pending  Audited
  ─────────────────────────────────────────────────────────────────────────────────
  MOD-CONSOLE    Console module                     <N>     <N>       <N>      <yes/no>
  MOD-PROCESS    Process module                     <N>     <N>       <N>      <yes/no>
  MOD-DESIGNER   Designer module                    <N>     <N>       <N>      <yes/no>
  OPC-BACKEND    OPC UA backend integration         <N>     <N>       <N>      <yes/no>

WAVE 3 — Remaining Modules & Cross-Cutting Systems
  Unit           Name                              Tasks   Verified  Pending  Audited
  ─────────────────────────────────────────────────────────────────────────────────
  DD-06          Frontend shell + app chrome        <N>     <N>       <N>      <yes/no>
  DD-10          Dashboards module                  <N>     <N>       <N>      <yes/no>
  DD-11          Reports module                     <N>     <N>       <N>      <yes/no>
  DD-12          Forensics module                   <N>     <N>       <N>      <yes/no>
  DD-13          Log module                         <N>     <N>       <N>      <yes/no>
  DD-14          Rounds module                      <N>     <N>       <N>      <yes/no>
  DD-15          Settings module                    <N>     <N>       <N>      <yes/no>
  DD-16          Real-time WebSocket protocol       <N>     <N>       <N>      <yes/no>
  DD-18          Time-series data (backend)         <N>     <N>       <N>      <yes/no>
  DD-20          Mobile architecture + PWA          <N>     <N>       <N>      <yes/no>
  DD-21          API design conventions             <N>     <N>       <N>      <yes/no>
  DD-22          Deployment guide (infra)           <N>     <N>       <N>      <yes/no>
  DD-23          Expression builder                 <N>     <N>       <N>      <yes/no>
  DD-24          Universal import                   <N>     <N>       <N>      <yes/no>
  DD-25          Export system                      <N>     <N>       <N>      <yes/no>
  DD-26          P&ID recognition                   <N>     <N>       <N>      <yes/no>
  DD-27          Alert system (backend engine)      <N>     <N>       <N>      <yes/no>
  DD-28          Email service                      <N>     <N>       <N>      <yes/no>
  DD-29          Authentication                     <N>     <N>       <N>      <yes/no>
  DD-30          Access control + shifts            <N>     <N>       <N>      <yes/no>
  DD-31          Alerts module (frontend)           <N>     <N>       <N>      <yes/no>
  DD-32          Shared UI components               <N>     <N>       <N>      <yes/no>
  DD-33          Testing strategy                   <N>     <N>       <N>      <yes/no>
  DD-34          DCS graphics import                <N>     <N>       <N>      <yes/no>
  DD-36          Observability                      <N>     <N>       <N>      <yes/no>
  DD-37          IPC contracts + wire formats       <N>     <N>       <N>      <yes/no>
  DD-38          Frontend contracts + route map     <N>     <N>       <N>      <yes/no>
  DD-39          .iographic format                  <N>     <N>       <N>      <yes/no>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DECISION FILES
  <list any files found in docs/decisions/ with their slug and the unit they affect>
  <if none: "None yet.">

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use these unit IDs exactly when running:
  claude --agent spec-scout      → "what is the state of <Unit>"
  claude --agent feature-agent   → "change <behavior> in <Unit>"
  audit-orchestrator "audit force <UNIT-ID>"
  audit-orchestrator "implement force <TASK-ID>"
```

4. If any decision files exist in `docs/decisions/`, list them with:
   - The decision slug (filename without .md)
   - The `unit:` field from its frontmatter
   - The `type:` field (new / change / fix)
   - One-line description of what it decides

Keep the output clean — no preamble, no explanation, just the index.
