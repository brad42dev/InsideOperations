---
unit: OPC-BACKEND
audited: 2026-03-21
relationship: SUPPLEMENT
spec-files:
  - /home/io/spec_docs/opc-server-protocol-spec.md
  - /home/io/io-dev/io/design-docs/17_OPC_INTEGRATION.md
result: ⚠️ Gaps found
tasks-generated: 3
---

## Summary

The OPC UA client service (`services/opc-service/`) is substantially implemented: connection management, namespace browsing, A&C event subscription, EUInformation binary decode, and historical read-back are all present and architecturally correct. Three gaps remain: (1) the endpoint auto-selection fallback selects the *lowest*-security endpoint when policy is unspecified, but the spec requires selecting the *highest*-security available; (2) the six operator-facing A&C methods (Acknowledge, Enable, Disable, TimedShelve, OneShotShelve, Unshelve) are never sent from the client to the server — the service only *receives* alarm events, it cannot act on them; (3) the DataChange subscription uses no deadband filter (queue_size=1, no filter), but the design doc requires PercentDeadband 1% for AnalogItemType nodes with EURange, falling back to AbsoluteDeadband 0 for others.

## Non-Negotiables

| # | Non-Negotiable | Status | Evidence |
|---|---------------|--------|----------|
| 1 | 7 security policy endpoints on SimBLAH; client negotiates highest available, falls back gracefully | ⚠️ Wrong | `driver.rs:253-255` — `sort_by_key(|e| e.security_level)` + `.next()` selects the *lowest*, not highest; spec (manifest §1) says "prefer Aes256_Sha256_RsaPss/SignAndEncrypt" |
| 2 | Namespace ns=1 (`urn:simblah:opc-server`) is application namespace; browse skips ns=0 nodes correctly | ✅ | `driver.rs:512` — `if node_id.namespace == 0 { continue; }` |
| 3 | OPC UA A&C event subscription via EventFilter; ConditionRefresh NodeId ns=0;i=3875; events written to `events` table | ✅ | `driver.rs:1217-1568` — EventFilter with 10 select clauses; ConditionRefresh at `driver.rs:1499` using ns=0;i=3875 on Server node; events written via `db::write_opc_events` |
| 3b | All 7 A&C methods implemented: Acknowledge, ConditionRefresh, Enable, Disable, TimedShelve, OneShotShelve, Unshelve | ❌ Missing | `driver.rs` and all other service files — only ConditionRefresh is called (at connect time); Acknowledge, Enable, Disable, TimedShelve, OneShotShelve, Unshelve are never invoked; no HTTP endpoint exists to trigger them |
| 4 | EUInformation binary decode: namespace_uri (skip), unit_id (skip), displayName.text (extract); Range is 2×f64 LE | ✅ | `driver.rs:970-994` — `decode_eu_display_name` skips OPC UA String + 4-byte int32, reads LocalizedText; `driver.rs:1047-1074` — `decode_eu_range` reads two f64 LE values |
| 5 | Username/password auth via Argon2id on `users` table | ✅ | `driver.rs:2022` — `IdentityToken::UserName(user, pass)` passed from `build_security`; SimBLAH spec confirms auth is DB-backed Argon2id on the server side |

## False-DONE Patterns

| Pattern | Present? | Evidence |
|---------|----------|----------|
| OPC client hardcoded to connect with None/None security only | ✅ Not present | `driver.rs:2004-2011` — `build_security` maps all 5 policy strings; None is default fallback only |
| A&C event subscription missing or non-functional | ✅ Not present | `driver.rs:1217-1568` — full EventFilter subscription with 10 fields |
| EUInformation decode wrong (wrong byte offsets for displayName.text) | ✅ Not present | `driver.rs:970-994` — byte layout correctly skips namespace_uri string and 4-byte unit_id before reading LocalizedText |
| Only some A&C methods implemented | ⚠️ Found | Only ConditionRefresh is called at connect time; all operator-action methods (Acknowledge, Shelve, Enable, Disable) are absent |
| A&C method dispatch using only ns=1 NodeId | ✅ Not present (N/A — methods not implemented) | N/A |

## Wave 0 Contract Gaps

OPC-BACKEND is a pure Rust backend service. Wave 0 contracts (CX-EXPORT, CX-RBAC, CX-TOKENS, etc.) apply to frontend modules only. Not applicable.

## Findings Summary

- [OPC-BACKEND-001] Endpoint auto-selection fallback picks lowest-security endpoint instead of highest — `driver.rs:253-255`
- [OPC-BACKEND-002] A&C operator methods (Acknowledge, Enable, Disable, TimedShelve, OneShotShelve, Unshelve) never sent to server — entire `services/opc-service/`
- [OPC-BACKEND-003] DataChange subscriptions use no deadband filter; design-doc requires PercentDeadband 1% for AnalogItemType with EURange — `driver.rs:1147-1154`
