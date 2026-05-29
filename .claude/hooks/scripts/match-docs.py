#!/usr/bin/env python3
"""
match-docs.py — deterministic doc-matching script.

Scores all interim docs against a set of modified files and topics,
then decides whether to UPDATE an existing doc, CREATE a new one,
or TRIAGE (ambiguous match).

No model calls. No network access. Deterministic.
"""

import argparse
import json
import os
import subprocess
import sys

# Decision thresholds — adjust here if tuning is needed
HIGH_THRESHOLD = 2.0
LOW_THRESHOLD = 0.5
MARGIN_REQUIRED = 1.0

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
LIB_FRONTMATTER = os.path.join(SCRIPTS_DIR, "lib-frontmatter.py")


def get_repo_root():
    """Return the absolute repo root path, or cwd as fallback."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return os.getcwd()


def normalize_path(path, repo_root):
    """Strip repo root prefix and leading ./ to get a repo-relative path."""
    if repo_root and path.startswith(repo_root):
        path = path[len(repo_root):]
        if path.startswith("/"):
            path = path[1:]
    if path.startswith("./"):
        path = path[2:]
    return path


def parse_args():
    p = argparse.ArgumentParser(description="Match work-unit output to interim docs.")
    p.add_argument("--files-modified", required=True,
                   help="Path to file listing modified files, one per line.")
    p.add_argument("--topics", default="",
                   help="Comma-separated topic slugs.")
    p.add_argument("--interim-dir", default=".claude/docs/interim",
                   help="Directory containing interim docs.")
    p.add_argument("--topics-file", default=".claude/docs/topics.txt",
                   help="Path to topics vocabulary file.")
    p.add_argument("--debug", action="store_true",
                   help="Print per-doc score breakdown to stderr.")
    return p.parse_args()


def load_topics_vocab(topics_file):
    if not os.path.exists(topics_file):
        print(f"Error: topics file not found: {topics_file}", file=sys.stderr)
        sys.exit(2)
    vocab = set()
    with open(topics_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                vocab.add(line)
    return vocab


def load_modified_files(path, repo_root):
    if not os.path.exists(path):
        print(f"Error: --files-modified file not found: {path}", file=sys.stderr)
        sys.exit(2)
    files = set()
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                files.add(normalize_path(line, repo_root))
    return files


def parse_doc_frontmatter(doc_path):
    """Call lib-frontmatter.py parse and return dict, or None on failure."""
    try:
        result = subprocess.run(
            [sys.executable, LIB_FRONTMATTER, "parse", doc_path],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"Warning: failed to parse {doc_path}: {result.stderr.strip()}",
                  file=sys.stderr)
            return None
        return json.loads(result.stdout)
    except Exception as e:
        print(f"Warning: exception parsing {doc_path}: {e}", file=sys.stderr)
        return None


def collect_docs(interim_dir, repo_root):
    """Return list of (path, slug, frontmatter) for all parseable .md docs."""
    docs = []
    if not os.path.isdir(interim_dir):
        return docs
    for fname in sorted(os.listdir(interim_dir)):
        if not fname.endswith(".md"):
            continue
        path = os.path.join(interim_dir, fname)
        fm = parse_doc_frontmatter(path)
        if fm is None:
            continue
        slug = fm.get("id") or os.path.splitext(fname)[0]
        impl = fm.get("implementation") or []
        if not isinstance(impl, list):
            impl = []
        impl = [normalize_path(f, repo_root) for f in impl]
        topics = fm.get("topics") or []
        if not isinstance(topics, list):
            topics = []
        docs.append({
            "path": path,
            "slug": slug,
            "implementation": impl,
            "topics": topics,
        })
    return docs


def build_file_freq(docs):
    """Map each file path to the number of docs that list it."""
    freq = {}
    for doc in docs:
        for f in doc["implementation"]:
            freq[f] = freq.get(f, 0) + 1
    return freq


def score_docs(docs, modified_files, input_topics, file_freq, debug):
    results = []
    for doc in docs:
        impl_set = set(doc["implementation"])
        overlap = modified_files & impl_set

        files_matched = []
        file_score = 0.0
        for f in overlap:
            n = file_freq.get(f, 1)
            w = 1.0 / n
            file_score += w
            files_matched.append((f, w, n))

        doc_topics = set(doc["topics"])
        topics_matched = list(input_topics & doc_topics)
        topic_score = len(topics_matched) * 1.5

        total = file_score + topic_score

        if total > 0:
            results.append({
                "slug": doc["slug"],
                "path": doc["path"],
                "score": total,
                "breakdown": {
                    "file_score": file_score,
                    "topic_score": topic_score,
                    "files_matched": [f for f, _, _ in files_matched],
                    "topics_matched": topics_matched,
                },
                "_files_detail": files_matched,
            })

        if debug and total > 0:
            print(f"DEBUG: {doc['slug']}", file=sys.stderr)
            print(f"  file_score={file_score:.4f} (from {len(files_matched)} matched files)",
                  file=sys.stderr)
            for f, w, n in files_matched:
                print(f"    {f}: weight={w:.4f} (listed by {n} docs)", file=sys.stderr)
            print(f"  topic_score={topic_score:.4f} (from {len(topics_matched)} matched topics)",
                  file=sys.stderr)
            if topics_matched:
                print(f"    matched: {', '.join(sorted(topics_matched))}", file=sys.stderr)
            print(f"  total={total:.4f}", file=sys.stderr)

    results.sort(key=lambda x: x["score"], reverse=True)
    return results


def decide(results, debug):
    top = results[0] if results else None
    runner_up = results[1] if len(results) > 1 else None

    if top is None or top["score"] < LOW_THRESHOLD:
        decision = "create"
        target_doc = None
        merge_candidates = []
    elif (top["score"] >= HIGH_THRESHOLD and
          (runner_up is None or top["score"] - runner_up["score"] >= MARGIN_REQUIRED)):
        decision = "update"
        target_doc = top["path"]
        merge_candidates = []
    else:
        decision = "triage"
        target_doc = None
        merge_candidates = [r["slug"] for r in results[:3]]

    if debug:
        top_slug = top["slug"] if top else "none"
        top_score = top["score"] if top else 0.0
        ru_slug = runner_up["slug"] if runner_up else "none"
        ru_score = runner_up["score"] if runner_up else 0.0
        print(f"DEBUG: decision={decision}", file=sys.stderr)
        print(f"  threshold_high={HIGH_THRESHOLD}", file=sys.stderr)
        print(f"  threshold_low={LOW_THRESHOLD}", file=sys.stderr)
        print(f"  margin_required={MARGIN_REQUIRED}", file=sys.stderr)
        print(f"  top={top_slug}: {top_score:.4f}", file=sys.stderr)
        print(f"  runner_up={ru_slug}: {ru_score:.4f}", file=sys.stderr)

    return decision, target_doc, merge_candidates


def main():
    args = parse_args()

    repo_root = get_repo_root()

    vocab = load_topics_vocab(args.topics_file)
    modified_files = load_modified_files(args.files_modified, repo_root)

    if args.debug:
        print("DEBUG: normalized files-modified:", file=sys.stderr)
        for f in sorted(modified_files):
            print(f"  {f}", file=sys.stderr)

    raw_topics = [t.strip() for t in args.topics.split(",") if t.strip()]
    unknown = [t for t in raw_topics if t not in vocab]
    for t in unknown:
        print(f"Warning: unknown topic '{t}' ignored", file=sys.stderr)
    input_topics = set(t for t in raw_topics if t in vocab)

    docs = collect_docs(args.interim_dir, repo_root)
    file_freq = build_file_freq(docs)

    results = score_docs(docs, modified_files, input_topics, file_freq, args.debug)

    decision, target_doc, merge_candidates = decide(results, args.debug)

    output = {
        "decision": decision,
        "target_doc": target_doc,
        "merge_candidates": merge_candidates,
        "scores": [
            {
                "slug": r["slug"],
                "score": r["score"],
                "breakdown": r["breakdown"],
            }
            for r in results
        ],
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
