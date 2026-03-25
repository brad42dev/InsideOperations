#!/usr/bin/env python3
"""
stream_proc.py — process claude --output-format stream-json --verbose output.

Reads JSONL events from stdin, extracts:
  - usage / modelUsage from the final result event
  - compaction_count (number of compaction events during the session)
  - num_turns (from result event)
  - total_cost_usd

Writes a single normalized JSON line to stdout, compatible with the
existing usage parsing code (same 'usage' and 'modelUsage' keys), plus the
new fields.  If no result event is found, writes nothing (empty file).
"""

import sys
import json

compaction_count = 0
result_event = None

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        event = json.loads(line)
    except Exception:
        continue

    etype = event.get("type", "")
    esubtype = event.get("subtype", "")

    # Compaction event — Claude Code emits this when it summarises the context
    # to reclaim window space.  Observed field names from binary: compactionUsage,
    # compactionInputTokens, compactSummary.  Guard against either top-level type
    # or system/compacted subtype.
    if etype == "compaction" or (etype == "system" and esubtype == "compacted"):
        compaction_count += 1

    if etype == "result":
        result_event = event

if result_event:
    print(json.dumps({
        "usage":            result_event.get("usage", {}),
        "modelUsage":       result_event.get("modelUsage", {}),
        "compaction_count": compaction_count,
        "num_turns":        result_event.get("num_turns", 0),
        "total_cost_usd":   result_event.get("total_cost_usd"),
    }))
