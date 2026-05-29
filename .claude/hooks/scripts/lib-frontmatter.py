#!/usr/bin/env python3
"""
lib-frontmatter.py — trusted deterministic frontmatter helper.

This is a trusted deterministic helper; it must not call any model and must
not perform any network access.

Round-trip fidelity note: PyYAML (not ruamel.yaml) is used because ruamel.yaml
is not installed. As a result, YAML comments in frontmatter are stripped when
any write subcommand (set, ensure-keys) is called. Read-only subcommands
(parse, get, validate) do not modify files and never strip comments.

Subcommands:
  parse <path>                    — print frontmatter as JSON to stdout
  get <path> <key>                — print one frontmatter value to stdout
  set <path> <key> <json-value>   — set a key; atomic write; idempotent
  ensure-keys <path> <json-obj>   — add missing keys from defaults; idempotent
  validate <path>                 — exit 0 if doc has valid complete frontmatter
"""

import json
import os
import re
import sys
import tempfile

import yaml

REQUIRED_KEYS = [
    "id", "title", "status", "created", "last_updated",
    "last_synced_with_code", "work_units", "implementation", "related",
    "topics", "aliases", "keywords", "covers",
]


def _topics_path():
    return os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..", "..", "docs", "topics.txt",
    )


def _load_known_topics():
    """Return set of known topics, or None if topics.txt does not exist."""
    path = _topics_path()
    if not os.path.exists(path):
        return None
    known = set()
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                known.add(line)
    return known


def _parse_frontmatter(path):
    """
    Read a markdown file with YAML frontmatter.

    Returns (frontmatter_dict, body_str).
    Raises ValueError with a descriptive message on any error.
    """
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if not content.startswith("---"):
        raise ValueError("No frontmatter: file does not start with '---'")

    after_open = content[3:]
    if after_open and after_open[0] not in ("\n", "\r"):
        raise ValueError("Opening '---' is not immediately followed by a newline")

    match = re.search(r"\n---[ \t]*(\n|$)", after_open)
    if not match:
        raise ValueError("Frontmatter closing '---' not found")

    fm_text = after_open[: match.start()]
    body = after_open[match.end() :]

    try:
        fm = yaml.safe_load(fm_text)
    except yaml.YAMLError as exc:
        raise ValueError(f"YAML parse error: {exc}") from exc

    if fm is None:
        fm = {}
    if not isinstance(fm, dict):
        raise ValueError("Frontmatter is not a YAML mapping")

    return fm, body


def _write_frontmatter(path, fm, body):
    """Atomically overwrite path with serialised frontmatter + body."""
    fm_text = yaml.dump(
        fm, allow_unicode=True, sort_keys=False, default_flow_style=False
    )
    content = f"---\n{fm_text}---\n{body}"
    dir_ = os.path.dirname(os.path.abspath(path))
    fd, tmp_path = tempfile.mkstemp(dir=dir_, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tf:
            tf.write(content)
        os.replace(tmp_path, path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


# ---------------------------------------------------------------------------
# Subcommand implementations
# ---------------------------------------------------------------------------


def cmd_parse(args):
    if len(args) != 1:
        print("Usage: parse <path>", file=sys.stderr)
        sys.exit(1)
    try:
        fm, _ = _parse_frontmatter(args[0])
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
    print(json.dumps(fm, default=str))


def cmd_get(args):
    if len(args) != 2:
        print("Usage: get <path> <key>", file=sys.stderr)
        sys.exit(1)
    path, key = args
    try:
        fm, _ = _parse_frontmatter(path)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
    if key not in fm:
        print(f"Error: key '{key}' not found in frontmatter", file=sys.stderr)
        sys.exit(1)
    val = fm[key]
    if isinstance(val, list):
        print(json.dumps(val, default=str))
    else:
        print("" if val is None else str(val))


def cmd_set(args):
    if len(args) != 3:
        print("Usage: set <path> <key> <json-value>", file=sys.stderr)
        sys.exit(1)
    path, key, json_value = args

    try:
        new_val = json.loads(json_value)
    except json.JSONDecodeError as exc:
        print(f"Error: invalid JSON value: {exc}", file=sys.stderr)
        sys.exit(1)

    if key == "covers" and isinstance(new_val, str) and "\n" in new_val:
        print("Error: 'covers' value must not contain newlines", file=sys.stderr)
        sys.exit(1)

    try:
        fm, body = _parse_frontmatter(path)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    if key in fm and fm[key] == new_val:
        return  # idempotent no-op

    fm[key] = new_val
    try:
        _write_frontmatter(path, fm, body)
    except Exception as exc:
        print(f"Error writing file: {exc}", file=sys.stderr)
        sys.exit(1)


def cmd_ensure_keys(args):
    if len(args) != 2:
        print("Usage: ensure-keys <path> <defaults-json>", file=sys.stderr)
        sys.exit(1)
    path, defaults_json = args

    try:
        defaults = json.loads(defaults_json)
    except json.JSONDecodeError as exc:
        print(f"Error: invalid JSON defaults: {exc}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(defaults, dict):
        print("Error: defaults must be a JSON object", file=sys.stderr)
        sys.exit(1)

    try:
        fm, body = _parse_frontmatter(path)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    changed = False
    for k, v in defaults.items():
        if k not in fm:
            fm[k] = v
            changed = True

    if not changed:
        return  # idempotent no-op

    try:
        _write_frontmatter(path, fm, body)
    except Exception as exc:
        print(f"Error writing file: {exc}", file=sys.stderr)
        sys.exit(1)


def cmd_validate(args):
    if len(args) != 1:
        print("Usage: validate <path>", file=sys.stderr)
        sys.exit(1)

    try:
        fm, _ = _parse_frontmatter(args[0])
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    problems = []

    for key in REQUIRED_KEYS:
        if key not in fm:
            problems.append(f"Missing required key: '{key}'")

    if "topics" in fm:
        topics_val = fm["topics"]
        if not isinstance(topics_val, list):
            problems.append("'topics' must be a list")
        else:
            known = _load_known_topics()
            if known is not None:
                for t in topics_val:
                    if t not in known:
                        problems.append(f"Unknown topic '{t}' (not in topics.txt)")

    if "covers" in fm:
        val = fm["covers"]
        if isinstance(val, str):
            if "\n" in val:
                problems.append("'covers' must be a single line (no newlines)")
            if len(val) > 140:
                problems.append(
                    f"'covers' exceeds 140 characters ({len(val)})"
                )

    if "keywords" in fm:
        kw = fm["keywords"]
        if not isinstance(kw, list):
            problems.append("'keywords' must be a list")
        else:
            if len(kw) > 8:
                problems.append(
                    f"'keywords' has {len(kw)} entries; max is 8"
                )
            for item in kw:
                if isinstance(item, str) and len(item) > 30:
                    problems.append(
                        f"keyword '{item}' exceeds 30 characters"
                    )

    if problems:
        for p in problems:
            print(p, file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

_COMMANDS = {
    "parse": cmd_parse,
    "get": cmd_get,
    "set": cmd_set,
    "ensure-keys": cmd_ensure_keys,
    "validate": cmd_validate,
}


def main():
    if len(sys.argv) < 2:
        print(
            "Usage: lib-frontmatter.py <subcommand> [args...]\n"
            "Subcommands: parse, get, set, ensure-keys, validate",
            file=sys.stderr,
        )
        sys.exit(1)

    sub = sys.argv[1]
    if sub not in _COMMANDS:
        print(f"Unknown subcommand: '{sub}'", file=sys.stderr)
        sys.exit(1)

    _COMMANDS[sub](sys.argv[2:])


if __name__ == "__main__":
    main()
