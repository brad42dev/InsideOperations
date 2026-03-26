#!/usr/bin/env python3
"""
stream_proc.py — process claude --output-format stream-json --verbose output.

Reads JSONL events from stdin, extracts:
  - usage / modelUsage from the final result event (cumulative session totals)
  - last_turn_input_tokens: input tokens for the LAST assistant turn only,
    which approximates final context-window fill (not cumulative)
  - compaction_count (number of compaction events during the session)
  - num_turns (from result event)
  - total_cost_usd

The distinction matters for context_utilization_pct:
  - result.usage.input_tokens is CUMULATIVE across all turns (useless as %)
  - last_turn_input_tokens is the actual context size at the final turn

Writes a single normalized JSON line to stdout.
If no result event is found, writes nothing (empty file).
"""

import sys
import json

compaction_count = 0
result_event = None
last_turn_usage = {}   # usage from the most recent assistant turn

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

    # Track the last assistant-turn usage so we can report final context fill.
    # Each assistant message event carries per-turn (not cumulative) token counts.
    if etype == "assistant":
        turn_usage = event.get("usage") or event.get("message", {}).get("usage", {})
        if turn_usage:
            last_turn_usage = turn_usage

    if etype == "result":
        result_event = event

if result_event:
    # last_turn_input_tokens: best proxy for "how full was the context window
    # at the end of the session" — single-turn input, not session cumulative.
    ltu = last_turn_usage
    last_turn_input = (
        ltu.get("input_tokens", 0)
        + ltu.get("cache_read_input_tokens", 0)
        + ltu.get("cache_creation_input_tokens", 0)
    )
    print(json.dumps({
        "usage":                  result_event.get("usage", {}),
        "modelUsage":             result_event.get("modelUsage", {}),
        "last_turn_input_tokens": last_turn_input or None,
        "compaction_count":       compaction_count,
        "num_turns":              result_event.get("num_turns", 0),
        "total_cost_usd":         result_event.get("total_cost_usd"),
    }))
