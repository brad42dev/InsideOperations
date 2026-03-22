---
id: {CX-ID or slug}
title: {Short name for the design decision}
status: decided | open | superseded
contract: {SPEC_MANIFEST.md contract ID, e.g. CX-ENTITY-CONTEXT}
decided: {YYYY-MM-DD}
---

## What Was Decided

{1–3 plain-English sentences summarizing the decision. Written for a developer who hasn't read the Q&A.}

## Inventory (What Exists Today)

{Cross-module comparison table from Phase 2 of the design-qa session.}

| Module / Entity | Implemented? | Current behavior | Gap found |
|-----------------|-------------|-----------------|-----------|
| {module} | ✅ / ⚠️ Partial / ❌ | {what it does} | {what's missing} |

## Questions and Answers

{Each Q&A pair from the design session. Preserve exact wording — future sessions may reference these.}

**Q1**: {question}
**A**: {user's answer}

**Q2**: {question}
**A**: {user's answer}

## Resulting Specification

{The actual behavioral rules that came out of the Q&A. This section is what developers implement against. Write it as non-negotiables.}

### Universal Rules (apply to all qualifying modules)

1. {Rule}
2. {Rule}

### Module-Specific Rules

**{Module}**:
- {Rule specific to this module}

### Explicitly Out of Scope

{Things the user said NOT to do, or features explicitly deferred. Prevents scope creep.}
- {Out of scope item}

## Implementation Notes

{Anything the user said about how to implement it — library choices, component names, where to put shared code. Optional.}

## Open Questions (if any remain)

{Questions not resolved in this session — need a follow-up design-qa or stakeholder input.}
- {Open question}
