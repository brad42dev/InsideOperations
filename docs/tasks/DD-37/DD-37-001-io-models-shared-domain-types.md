---
id: DD-37-001
title: Add shared domain types to io-models crate (§8 PointValue, Event, Alert, User, Source, Permission)
unit: DD-37
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The `io-models` crate is the canonical home for all types that cross service boundaries.
Every service imports these types rather than defining its own. Currently the crate only
contains envelope types (`ApiResponse`, `PagedResponse`). All domain types from §8 of
doc 37 are completely absent, meaning each service either defines its own (divergent)
versions or uses `serde_json::Value` as a workaround.

## Spec Excerpt (verbatim)

> These are the types that cross service boundaries. Every service that sends or receives
> these types uses the exact same struct from `io-models`.
> — 37_IPC_CONTRACTS.md, §8 Shared Domain Types

The spec then defines:
- `PointValue`, `PointQuality` enum, `PointMetadata`
- `Event`, `EventType` enum, `EventSeverity` enum
- `AlertDispatch`, `AlertRecipient`, `AlertChannel` enum
- `UserIdentity`, `WsTicket`
- `SourceStatus`, `SourceState` enum

And in §18:

> Rust implementation: `io-models` crate, `pub enum Permission` with `#[serde(rename_all = "snake_case")]`
> and string serialization matching the format below.
> — 37_IPC_CONTRACTS.md, §18

## Where to Look in the Codebase

Primary files:
- `crates/io-models/src/lib.rs` — the only source file in the crate; currently has zero domain types
- `design-docs/37_IPC_CONTRACTS.md` §8 — verbatim Rust struct definitions to implement
- `design-docs/37_IPC_CONTRACTS.md` §18 — full 118-permission enum with exact `#[serde(rename = "...")]` annotations

## Verification Checklist

- [ ] `io-models` defines `PointValue`, `PointQuality`, `PointMetadata` with exact field names from spec §8
- [ ] `io-models` defines `Event`, `EventType`, `EventSeverity` with `#[serde(rename_all = "snake_case")]` on enums
- [ ] `io-models` defines `AlertDispatch`, `AlertRecipient`, `AlertChannel` with all variants from spec
- [ ] `io-models` defines `UserIdentity` and `WsTicket` with `consumed: bool` field
- [ ] `io-models` defines `SourceStatus` and `SourceState` with all four variants (`Active`, `Inactive`, `Connecting`, `Error`)
- [ ] `io-models` defines `Permission` enum with all 118 permissions using per-variant `#[serde(rename = "console:read")]` annotations

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: All 14+ domain types and the Permission enum are absent. The crate has only 5 types (ApiResponse, PagedResponse, Pagination, PageParams, SortOrder).

## Fix Instructions (if needed)

Add the following to `crates/io-models/src/lib.rs` (or split into submodules `models/point.rs`,
`models/event.rs`, etc. and re-export from `lib.rs`).

Copy the exact struct definitions from `37_IPC_CONTRACTS.md` §8. Critical rules:
- `PointQuality` gets `#[serde(rename_all = "snake_case")]`
- `EventType`, `EventSeverity`, `AlertChannel`, `SourceState` all get `#[serde(rename_all = "snake_case")]`
- `PointValue.timestamp` is `DateTime<Utc>` in Rust (not String); serializes to RFC 3339 via chrono serde
- `WsTicket` must include `consumed: bool`

For `Permission` enum (§18): each variant needs an explicit `#[serde(rename = "module:action")]`
attribute (do NOT use `rename_all` — the colons in names require explicit renames). Add
`PartialEq`, `Eq`, `Hash` derives. The spec shows 118 variants — implement all of them.

Add `uuid`, `chrono`, and `serde_json` as dependencies in `crates/io-models/Cargo.toml`
if not already present (check `[dependencies]` section).

Do NOT:
- Put these types in `io-bus` (that crate is for wire/transport types, not domain types)
- Use `rename_all = "snake_case"` on the Permission enum (colons in names won't serialize correctly)
- Omit the `Permission` enum thinking it belongs only in `io-auth` — it must be in `io-models` for all services to use
