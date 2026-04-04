# File Connector Trigger and Delivery Modes — Research

**Date:** 2026-04-04
**Scope:** Enhanced trigger/delivery modes for file-based import connectors in the I/O Import Service.
**Baseline:** See `01_current_architecture.md` for the existing architecture.

---

## Context

The import service today has one-shot file parsers for CSV, TSV, Excel, JSON, and XML, plus an SFTP
connector (`SftpConnector`) that downloads a **single named file** identified by `source_config.remote_path`
and dispatches it to the appropriate parser. The user's stated need is: *"using the EXCEL implementation
on EXCEL files grabbed from an SFTP site as new files show up."* That requires directory polling, pattern
matching, deduplication, and a `file_arrival` schedule trigger — none of which are implemented today.

---

## 1. SFTP / SSH File Sources

### 1.1 Current state

`SftpConnector` (in `connectors/etl/sftp.rs`) does exactly one thing per run: opens a session,
downloads the file at `source_config.remote_path`, writes it to a temp file in `upload_dir`, dispatches
to the right parser, deletes the temp file, and returns `Vec<SourceRecord>`. There is no directory
listing, no pattern matching, and no deduplication.

### 1.2 Directory polling pattern

The natural replacement for the single-file mode is a **directory watcher** that:

1. Opens an SFTP session.
2. Calls `sftp.read_dir(remote_dir)` (or `opendir` + `readdir` + `closedir` in lower-level terms)
   to obtain a listing of `(filename, Metadata)` entries.
3. Filters entries by a glob pattern (`*.xlsx`, `report_*.csv`, etc.).
4. Compares each match against a persisted **seen-state store** (see §1.4) to find new or changed files.
5. Downloads each new/changed file, dispatches to the appropriate parser, and records the file in the
   seen-state store.
6. Optionally archives the file to a remote subdirectory (see §1.5).

**Scheduling fit:** This pattern maps directly to the `interval` and `cron` schedule types already in
`import_schedules`. A `file_arrival` pseudo-type would simply mean: run the directory poll loop and
trigger a pipeline run for each newly discovered file, rather than requiring an external event.

### 1.3 russh-sftp directory listing capabilities

The existing dependency is `russh-sftp = "2.1"` (MIT / Apache-2.0 — confirmed acceptable). The
`SftpSession` high-level API is modelled after `std::fs` and provides the following relevant calls:

| Method | Purpose |
|---|---|
| `sftp.read_dir(path)` | Returns a `Vec<(OsString, FileAttr)>` for the directory |
| `sftp.metadata(path)` | Stat a specific path (follows symlinks) |
| `sftp.symlink_metadata(path)` | Lstat — does not follow symlinks |
| `sftp.open(path)` | Open a file for reading (already used in current connector) |
| `sftp.rename(from, to)` | Rename/move a file (useful for archival, see §1.5) |

`FileAttr` includes `size: Option<u64>`, `mtime: Option<SystemTime>`, `permissions`, and `uid/gid`.
The `mtime` and `size` fields are sufficient for deduplication without downloading the file.

**No additional SFTP crate is needed.** The existing `russh-sftp` dependency covers directory polling.

### 1.4 Pattern matching

Use the `glob` crate (**MIT OR Apache-2.0**, crates.io: `glob = "0.3"`) for matching filenames against
user-configured patterns like `*.csv`, `report_*.xlsx`, `data_{date}.json`.

```
// Pseudocode — pattern match against listing
let pattern = glob::Pattern::new(&source_config.file_pattern)?;
let matches: Vec<_> = listing.iter()
    .filter(|(name, _attr)| pattern.matches(name.to_str().unwrap_or("")))
    .collect();
```

`glob` is already in the Rust ecosystem standard toolbox (used by cargo, rustfmt, etc.) and requires no
additional concern. Alternatively, `globset` (BSD-3-Clause, from BurntSushi) handles multiple patterns
simultaneously — useful if users want to specify `["*.csv", "*.xlsx"]`.

### 1.5 Deduplication — tracking seen files

Three viable strategies, in increasing fidelity:

| Strategy | Key | Cost | Reliability |
|---|---|---|---|
| **Filename only** | `filename` | Zero — no stat required | Breaks if file is overwritten in place |
| **Filename + mtime** | `filename + mtime (unix timestamp)` | One `metadata()` call per file | Good for most industrial sources; fails if server clock drifts |
| **Filename + size + SHA-256** | `filename + size + hash` | Must download to hash | Correct; expensive for large files |

**Recommended:** filename + mtime for SFTP polling. The `FileAttr.mtime` field is already returned
by `read_dir` without an extra round-trip. Hash-based deduplication is overkill for periodic polling;
it is warranted only for connectors with known clock issues (some legacy OT equipment).

**Persistence:** The seen-state store belongs in `import_runs.watermark_state JSONB` (per
`import_definitions`), which is already in the schema but never populated. A suitable shape:

```json
{
  "seen": {
    "report_2026-04-01.xlsx": { "mtime": 1743494400, "size": 204800 },
    "report_2026-04-02.xlsx": { "mtime": 1743580800, "size": 197632 }
  }
}
```

This is written back to the most recent completed run's `watermark_state` at the end of each poll cycle.
The next run reads the latest `watermark_state` for the definition's most recent successful run.

### 1.6 Archival — moving processed files on the remote

After successful import, the connector can optionally call `sftp.rename(original_path, archive_path)`,
e.g. moving `reports/data.xlsx` to `reports/archive/data.xlsx`. The user should be able to configure:

- `archive_dir` (string, optional) — if set, move processed files here.
- `archive_on_error` (bool, default false) — whether to move files that failed parsing.

This is a source-side concern only. The scheduler and pipeline do not need to know about it. The SFTP
connector handles it internally after calling `dispatch_to_parser`.

---

## 2. S3 / Object Storage

### 2.1 Industrial use cases

S3 (or S3-compatible: MinIO, Wasabi, Ceph RGW) appears in industrial environments primarily as a
document drop zone, not a real-time data bus:

- **LIMS / lab systems:** Lab report PDFs and CSVs exported nightly to an S3 bucket by a LIMS scheduled
  job. The bucket is effectively a file server that I/O polls on a schedule.
- **DCS historian exports:** Some DCS systems (e.g. OSIsoft PI) can push periodic snapshot CSV/Excel
  files to an S3 location via an adapter. I/O picks these up and ingests them.
- **Third-party data providers:** Environmental monitoring, utility, or trading data delivered as CSV
  drops on a customer's S3 bucket.
- **Contractor reports:** Maintenance or inspection reports uploaded by field staff via a contractor
  portal that stores to S3.

In all cases the data cadence is minutes-to-days, not milliseconds. Polling is always sufficient.

### 2.2 Crate: `aws-sdk-s3`

**License:** Apache-2.0. Confirmed acceptable per I/O licensing rules.
**Source:** `awslabs/aws-sdk-rust` (official AWS SDK for Rust).
**Version:** 1.122.0+ (as of late 2025/early 2026).
**Tokio-native:** Fully async, integrates directly with the existing Tokio runtime.

Add to `import-service/Cargo.toml`:
```toml
aws-sdk-s3 = "1"
aws-config = "1"   # Apache-2.0 — handles credential chain (env vars, ~/.aws, instance profile)
```

### 2.3 Poll-based approach (recommended for I/O)

```
1. Build S3 client from connection_config (endpoint, region, access_key_id, secret_access_key).
2. Call list_objects_v2(bucket, prefix) with pagination.
3. For each Object, check last_modified > watermark_timestamp from watermark_state.
4. Download (get_object) each new object, detect format, dispatch to parser.
5. Update watermark_state.last_checked = now() and record seen keys.
```

`list_objects_v2` does not support server-side filtering by `LastModified` — filtering is always
client-side. For large buckets (thousands of objects) with a stable prefix this is still fast: the
listing API pages at 1000 objects per call and returns only key/size/mtime metadata.

**Watermark state for S3:**
```json
{
  "last_checked_at": "2026-04-04T06:00:00Z",
  "seen_keys": {
    "exports/lab/report_2026-04-03.csv": "2026-04-03T23:45:00Z"
  }
}
```

### 2.4 Event-driven approach (S3 → SQS → poll SQS)

S3 can emit `s3:ObjectCreated:*` events to an SQS queue. I/O would poll SQS on a short interval
(e.g. every 30 seconds) and download only files whose creation was notified.

**Crate:** `aws-sdk-sqs` — **Apache-2.0**, same source (`awslabs/aws-sdk-rust`).

The event-driven path has lower latency and avoids scanning large buckets, but requires additional
AWS infrastructure setup (SQS queue, S3 event notification config, IAM policy for SQS). For most
industrial deployments the polling approach is simpler to configure and operationally transparent.

**Assessment:** Implement poll-based first. SQS event-driven is an enhancement for phase N+1 if
customers with large active buckets request it.

### 2.5 Realistic scope question — native S3 vs. presigned URL

**Native S3 connector is warranted** for the following reasons:
- Lab and DCS exports are a named use case in the design docs (`design-docs/24_UNIVERSAL_IMPORT.md`).
- Presigned URLs are one-time-use; they do not model a recurring poll against a bucket.
- `aws-config` handles all standard credential sources (environment variables, instance profile,
  `~/.aws/credentials`) transparently, so no credential baking is required.
- `aws-sdk-s3` is Apache-2.0, well-maintained, and the official AWS SDK — licensing is clean.

**Note on S3-compatible stores:** The `aws-sdk-s3` client supports custom endpoints via `aws-config`
endpoint configuration, making MinIO and other S3-compatible stores work without a separate connector.
The connection_config should include an optional `endpoint_url` field.

---

## 3. Local / Network Filesystem

### 3.1 Use cases

- A DCS exports tag snapshots to a shared network folder (NFS or SMB mount on the server).
- A lab instrument writes CSV files to a watched directory.
- An operator drops files into a monitored inbox folder via a file manager.
- A batch process writes completed export files to a local path on the I/O server.

These are all valid in a refinery environment where the I/O server is co-located with OT systems or
connected via a trusted network share.

### 3.2 `inotify` and the `notify` crate

**`inotify` (Linux kernel):** The kernel facility that provides instant filesystem event delivery for
watched directories (`IN_CREATE`, `IN_CLOSE_WRITE`, `IN_MOVED_TO`). It does not work for remote
filesystems (NFS, CIFS/SMB) — kernel inotify only fires for local filesystem events.

**`notify` crate:** Cross-platform filesystem notification library. **License: CC Zero 1.0** (public
domain dedication). CC0 is not a copyleft license; it imposes no restrictions and no patent grants are
required. Commercial use is explicitly permitted. It is used in production by alacritty, deno,
cargo-watch, rust-analyzer, and watchexec. It is production-grade for this use case.

On Linux it uses inotify. On network-mounted paths it falls back to polling (configurable interval).
The `notify-debouncer-full` sub-crate (MIT OR Apache-2.0) adds event deduplication, which prevents
multiple events for a single file write.

**Appropriate for I/O?** Yes for local paths. For network-mounted paths the polling backend still
works — it just loses instant delivery and becomes equivalent to the SFTP polling pattern but without
the SSH overhead. Since I/O is a server-side service running on Linux, this is fully appropriate.

### 3.3 Recommended pattern for local file watching

```
1. At schedule startup (file_arrival trigger type), spawn a watcher task:
   - Use notify::recommended_watcher() with a tokio channel.
   - Watch source_config.watch_dir, recursive=false.
   - Debounce with notify-debouncer-full (50ms window).
2. On IN_CLOSE_WRITE or IN_MOVED_TO events:
   - Check filename against source_config.file_pattern (glob crate).
   - Check deduplication state (filename + mtime or filename + size).
   - Dispatch to pipeline::execute() via tokio::spawn.
3. Move file to archive_dir if configured.
```

The `file_arrival` schedule type in the existing `import_schedules` schema maps cleanly to this watcher
model. Unlike cron/interval, a file_arrival schedule does not have a `next_run_at` — the watcher task
runs continuously and fires on events.

### 3.4 Crates summary for local watching

| Crate | Version | License | Purpose |
|---|---|---|---|
| `notify` | 8.x | CC0 1.0 | Filesystem events (inotify on Linux) |
| `notify-debouncer-full` | 0.4.x | MIT OR Apache-2.0 | Event deduplication |
| `glob` | 0.3 | MIT OR Apache-2.0 | Filename pattern matching |

---

## 4. FTP (Plain FTP, not SFTP)

### 4.1 Current state

`SftpConnector.open_sftp()` explicitly returns an error if `connection_config.protocol == "ftp"`:
```
Err(anyhow!("sftp: FTP protocol is not yet supported; use SFTP"))
```
This is the correct behavior for the current implementation.

### 4.2 Is FTP a real gap?

**Yes, in the industrial/OT space.** Many older industrial systems only support plain FTP:
- Legacy DCS platforms (pre-2010 era) with built-in FTP servers for export data.
- Some LIMS systems on older infrastructure.
- PLC data loggers and HMI systems in brownfield plants.
- Third-party environmental monitoring stations.

The gap is real. A significant fraction of brownfield refinery and manufacturing IT still runs on
infrastructure that predates widespread SFTP adoption. Returning "use SFTP" is a valid stub for
the current phase but will be a genuine customer friction point.

### 4.3 FTP crate options

| Crate | License | Async | FTPS | Status |
|---|---|---|---|---|
| `suppaftp` | MIT OR Apache-2.0 | Yes (async-std or tokio feature) | Yes (native-tls or rustls) | Actively maintained; fork of rust-ftp |
| `rust-ftp` | MIT | No | Partial | **Unmaintained** — do not use |

**Recommendation: `suppaftp`.**
- License: MIT OR Apache-2.0 — both acceptable.
- Supports async with a `tokio` feature flag, consistent with the rest of the service.
- Supports FTPS (FTP over TLS) via rustls — important since plain FTP is insecure and some sites use FTPS.
- Actively maintained (last release 6.x, early 2025).
- Provides `LIST` command output parsing, directory listing, `RETR` for file download.

**No license concerns.** Both MIT and Apache-2.0 are on the approved list.

### 4.4 Implementation approach

An `FtpConnector` would be a separate registered connector type (`"ftp"`) in `get_etl_connector()`.
It should not be a mode on `SftpConnector` — the protocols are unrelated and the crates are different.
The `connection_config` would mirror the SFTP shape (`host`, `port`, `username`) with `auth_config`
holding `password`. A boolean `use_tls` flag enables FTPS.

The directory polling and deduplication logic (§1.2–1.5) is identical to the SFTP case and should be
extracted into a shared `FilePollingState` struct that both `FtpConnector` and `SftpConnector` use.

---

## 5. Combined Pipeline: SFTP + Excel ("new files as they show up")

This is the primary user-described use case. The full end-to-end pipeline:

### 5.1 Configuration

**`import_connections` row** (type `sftp`):
```json
{
  "host": "lab-server.plant.local",
  "port": 22,
  "username": "labexport",
  "protocol": "sftp"
}
// auth_config (encrypted): { "password": "..." }
```

**`import_definitions.source_config`**:
```json
{
  "source_type": "sftp",
  "remote_dir": "/exports/lab/reports",
  "file_pattern": "LabReport_*.xlsx",
  "file_format": "excel",
  "sheet_name": "Results",
  "header_row": 0,
  "archive_dir": "/exports/lab/archive",
  "dedup_strategy": "filename_mtime"
}
```

**`import_schedules` row**:
```json
{
  "schedule_type": "interval",
  "schedule_config": { "interval_seconds": 300 },
  "enabled": true
}
```
(Or `schedule_type: "cron"` with `cron_expression: "*/15 * * * *"` to check every 15 minutes.)

For true event-driven delivery, `schedule_type: "file_arrival"` would be appropriate once that
trigger type is implemented beyond its current schema-stub status.

### 5.2 Execution flow

```
Scheduler fires (interval elapsed or file_arrival event detected)
  │
  ▼
pipeline::execute(db, run_id, def_id, ...)
  │
  ├── [EXTRACT] SftpConnector.extract(cfg)
  │     │
  │     ├── open_sftp(cfg)          → SSH connection, SFTP subsystem
  │     ├── sftp.read_dir(remote_dir) → Vec<(filename, FileAttr)>
  │     ├── filter by file_pattern  → glob::Pattern::matches()
  │     ├── load watermark_state    → seen files from last successful run
  │     ├── diff against seen state → new / changed files
  │     │
  │     └── for each new file:
  │           ├── sftp.open(remote_path) → download bytes
  │           ├── write to temp file in upload_dir
  │           ├── dispatch_to_parser("excel", cfg_with_file_id)
  │           │     └── ExcelFileConnector.extract(cfg)
  │           │           └── calamine → Vec<SourceRecord>
  │           ├── accumulate records
  │           └── if archive_dir set: sftp.rename(file, archive_dir/file)
  │
  │     returns: accumulated Vec<SourceRecord> (all rows from all new files)
  │
  ├── [MAP / TRANSFORM / VALIDATE]  (existing pipeline stages, unchanged)
  │
  ├── [LOAD] → custom_import_data (or target_table when routing is implemented)
  │
  └── [FINALIZE]
        ├── update watermark_state with newly seen filenames + mtimes
        └── pg_notify, metrics, status update
```

### 5.3 Multi-file run considerations

When the directory poll finds N new files, the current pipeline model (one `import_runs` row per
trigger) must load all N files into one run. This is acceptable for low-frequency polling (hourly,
daily). For high-frequency polling with many files per cycle, a future enhancement would spawn one
`import_runs` row per file — but this is a phase N+1 concern.

The current `rows_extracted` counter naturally sums across all files. The `run_metadata` JSONB can
carry a `files_processed` list for diagnostics.

---

## 6. Scheduling for File-Based Sources

### 6.1 Schedule types and their fit

| Schedule type | `schedule_type` value | Fit for file sources |
|---|---|---|
| **Interval** | `interval` | Best default for SFTP/FTP/S3/local polling. Configure `interval_seconds`. Simple, predictable, low overhead. |
| **Cron** | `cron` | Use when the source system exports at known times (e.g. lab system exports at 06:00 every day). Avoids unnecessary polls between export windows. |
| **File arrival** | `file_arrival` | Ideal for local filesystem watching (inotify). Sub-second latency. Also usable as a conceptual framing for SFTP/FTP/S3 (poll aggressively, e.g. every 30s, and only fire pipeline when new files found). |
| **Webhook** | `webhook` | Applicable only if the source system can call I/O's HTTP endpoint when a file is ready (rare in OT). |
| **Manual** | `manual` | Baseline — user clicks "Run Now". Always supported regardless of schedule config. |

### 6.2 Recommended defaults per source type

| Source | Default schedule | Rationale |
|---|---|---|
| SFTP | `interval`, 300s | Lab systems export infrequently; 5-min poll is fine. Configurable. |
| S3 | `interval`, 300s | Same rationale; S3 list operations are cheap. |
| Local filesystem | `file_arrival` (inotify) | Zero-latency; no wasted polls. |
| FTP | `interval`, 300s | FTP servers are often legacy; avoid hammering with rapid polls. |
| Cron-based sources | `cron` | When source export time is known. |

### 6.3 `file_arrival` implementation strategy

For SFTP, FTP, and S3, there is no kernel-level notification available. The `file_arrival` schedule
type for these connectors should be implemented as a **short-interval poll with a no-op run when
nothing is new** — the system fires `pipeline::execute()` which quickly discovers zero new files,
creates a run record with `rows_extracted=0` and status `completed`, and exits. This is cheap and
provides a complete audit trail.

Alternatively, the scheduler can pre-check for new files before spawning `pipeline::execute()` and
skip creating a run row entirely if nothing is new. The latter avoids run-history noise but loses
the visibility of "we checked and there was nothing." The audit-trail approach is recommended for
industrial environments where demonstrating that monitoring is active has compliance value.

---

## 7. Recommended Implementation Approach

### Priority order

1. **Fix the scheduler first.** The `poll_import_schedules` function has a schema mismatch that
   makes it entirely non-functional (documented in `01_current_architecture.md` §1b). No file-arrival
   feature matters until scheduled execution works. A migration must add the missing columns to
   `import_schedules`: `cron_expression`, `interval_seconds`, `running`, `last_heartbeat_at`.

2. **Extend `SftpConnector` for directory polling.** This is the stated user need (SFTP + Excel).
   - Add `remote_dir` + `file_pattern` + `dedup_strategy` + `archive_dir` to the recognized
     `source_config` fields.
   - Add a `poll_directory()` method to `SftpConnector` using `sftp.read_dir()`.
   - Maintain backwards compatibility: if `source_config.remote_path` is set and `remote_dir` is
     not, use the existing single-file download path.
   - Persist seen-state in `watermark_state`.
   - No new crates required — `russh-sftp` already has `read_dir`.

3. **Add `glob` crate for pattern matching.**
   ```toml
   glob = "0.3"  # MIT OR Apache-2.0
   ```
   Used by both the extended SFTP connector and the future local filesystem connector.

4. **Add local filesystem watching** (lower priority than SFTP).
   ```toml
   notify = "8"                # CC0-1.0 — public domain, commercial use OK
   notify-debouncer-full = "0.4"  # MIT OR Apache-2.0
   ```
   Implement as a new `LocalFileConnector` with a background watcher task per active `file_arrival`
   schedule. The watcher task is spawned at startup and managed by the import service's AppState.

5. **Add S3 connector** (medium priority — real industrial use case).
   ```toml
   aws-sdk-s3 = "1"   # Apache-2.0
   aws-config = "1"   # Apache-2.0
   ```
   Implement as a new `S3FileConnector`. Poll-based initially; SQS event-driven as a future
   enhancement. Supports S3-compatible stores via configurable `endpoint_url`.

6. **Add FTP connector** (lower priority — long tail of legacy systems).
   ```toml
   suppaftp = { version = "6", features = ["async", "rustls"] }  # MIT OR Apache-2.0
   ```
   Implement as a new `FtpConnector`, separate from `SftpConnector`. Share `FilePollingState`
   deduplication logic with the SFTP connector via a common struct/trait.

### Shared `FilePollingState` abstraction

Extract deduplication and watermark logic into a reusable struct that all file-based connectors use:

```rust
pub struct FilePollingState {
    /// filename → (mtime_unix, size_bytes)
    pub seen: HashMap<String, (u64, u64)>,
}

impl FilePollingState {
    pub fn from_watermark(watermark: &JsonValue) -> Self { ... }
    pub fn to_watermark(&self) -> JsonValue { ... }
    pub fn is_new_or_changed(&self, name: &str, mtime: u64, size: u64) -> bool { ... }
    pub fn mark_seen(&mut self, name: &str, mtime: u64, size: u64) { ... }
}
```

This struct lives in `connectors/etl/file_polling.rs` and is used by `SftpConnector`, `FtpConnector`,
`S3FileConnector`, and `LocalFileConnector`.

---

## 8. Crate Reference Summary

| Crate | License | Use | Required? |
|---|---|---|---|
| `russh-sftp` 2.1 | MIT OR Apache-2.0 | SFTP directory listing (read_dir) | Already in deps |
| `glob` 0.3 | MIT OR Apache-2.0 | Filename pattern matching | Add |
| `globset` 0.4 (ripgrep) | MIT OR Apache-2.0 | Multi-pattern matching (optional) | Add if needed |
| `notify` 8.x | CC0-1.0 (public domain) | Local filesystem inotify | Add for local watcher |
| `notify-debouncer-full` 0.4 | MIT OR Apache-2.0 | Event deduplication | Add with notify |
| `aws-sdk-s3` 1.x | Apache-2.0 | S3 object storage connector | Add for S3 |
| `aws-sdk-sqs` 1.x | Apache-2.0 | S3 event-driven via SQS (future) | Add when event-driven needed |
| `aws-config` 1.x | Apache-2.0 | AWS credential chain | Add with aws-sdk-s3 |
| `suppaftp` 6.x | MIT OR Apache-2.0 | Plain FTP / FTPS connector | Add for FTP support |
| `filetime` 0.2 | MIT OR Apache-2.0 | Local file mtime reading | Consider for local connector |

All listed crates are confirmed acceptable under I/O licensing rules (MIT, Apache-2.0, or CC0).
None are GPL, AGPL, LGPL, or otherwise copyleft.

---

## 9. Open Questions / Decisions Needed

1. **Single run per poll cycle vs. one run per file.** When a directory poll finds 5 new Excel files,
   should that be 1 `import_runs` row (all files in one pipeline execution) or 5 rows? One row is
   simpler; 5 rows give per-file error isolation and run history. Recommend: one row per poll cycle
   initially, with a config option `one_run_per_file: bool` for upgrade.

2. **Watermark persistence location.** `import_runs.watermark_state` (current schema) is on a run
   row, not on the definition or schedule. The last successful run's `watermark_state` must be queried
   at the start of each new run. Alternatively, add `watermark_state JSONB` to `import_schedules` for
   cleaner semantics. Recommend: query the latest completed run's watermark (avoids schema change).

3. **Archive-on-error behavior.** If parsing fails for one of several files in a batch, should the
   other successfully-parsed files still be moved to archive? Recommend: yes (per-file archival,
   not per-run), with a flag `archive_failed_files: bool` defaulting to false.

4. **FTP priority.** If no customer has specifically requested FTP, defer it. Implement SFTP directory
   polling and local watching first. Add FTP when a brownfield customer requirement is confirmed.

5. **`notify` CC0 license acceptability.** CC0 is public domain — stricter than MIT in that it waives
   all rights, not merely grants them. This is unconditionally more permissive than MIT for the I/O
   project's commercial-use requirement. No issue. If there is internal policy uncertainty, the
   `notify-debouncer-full` sub-crate is MIT OR Apache-2.0 and can be used without `notify` by
   implementing polling instead of inotify (at the cost of latency).
