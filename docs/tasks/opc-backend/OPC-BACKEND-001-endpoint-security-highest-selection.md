---
id: OPC-BACKEND-001
title: Endpoint auto-selection fallback must select highest-security endpoint, not lowest
unit: OPC-BACKEND
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When the user configures a source with security policy "None" (meaning: auto-detect), the OPC UA client should probe the server's endpoint list and select the *highest*-security endpoint available — not the lowest. This matches the behavior of commercial OPC UA clients (Ignition, UaExpert) and satisfies the I/O design doc requirement to pre-select `Basic256Sha256 + SignAndEncrypt` as the default.

## Spec Excerpt (verbatim)

> "When presenting the endpoint list, sort and pre-select in this priority order:
> 1. SignAndEncrypt + Basic256Sha256 ← pre-selected default
> 2. SignAndEncrypt + Aes128_Sha256_RsaOaep
> 3. SignAndEncrypt + Aes256_Sha256_RsaPss
> ...
> 7. None (no security — show 🔴 warning)
>
> Never silently downgrade security."
> — 17_OPC_INTEGRATION.md, §Security Policy Selection Algorithm

Also from the manifest non-negotiable §1:
> "Client must negotiate the highest available: prefer Aes256_Sha256_RsaPss/SignAndEncrypt, fall back gracefully."

## Where to Look in the Codebase

Primary files:
- `services/opc-service/src/driver.rs` lines 234-268 — Step 3 of endpoint negotiation (the "only when policy is None" branch)

## Verification Checklist

- [ ] When `is_none_policy` is true and server returns multiple endpoints, the code selects the endpoint with the *highest* `security_level` value (not the lowest)
- [ ] `sort_by_key(|e| e.security_level)` is followed by `.last()` or `sort_by(|a,b| b.security_level.cmp(a.security_level))` + `.first()` — not `.next()` which gives the minimum
- [ ] The auto-trust path still works after this change (signing requires a keypair, which is already rebuilt at line 283 when `security_mode != None`)

## Assessment

- **Status**: ⚠️ Wrong
- **Current state**: Line 253-255 sorts ascending by `security_level` and then calls `.into_iter().next()`, which gives the endpoint with the *lowest* security level. This is the opposite of the spec requirement.

```rust
// CURRENT (wrong) — picks lowest:
candidates.sort_by_key(|e| e.security_level);
candidates.into_iter().next()

// CORRECT — picks highest:
candidates.sort_by_key(|e| std::cmp::Reverse(e.security_level));
candidates.into_iter().next()
// or equivalently:
candidates.sort_by_key(|e| e.security_level);
candidates.into_iter().last()
```

## Fix Instructions

In `services/opc-service/src/driver.rs`, find the Step 3 fallback block around line 252-268:

```rust
// Policy is None — pick the lowest-security endpoint.
let mut candidates = server_endpoints.clone();
candidates.sort_by_key(|e| e.security_level);
candidates.into_iter().next().map(|mut ep| {
```

Change to pick the *highest*-security endpoint:

```rust
// Policy is None — pick the highest-security endpoint available.
let mut candidates = server_endpoints.clone();
candidates.sort_by_key(|e| std::cmp::Reverse(e.security_level));
candidates.into_iter().next().map(|mut ep| {
```

Also update the log message at line 260 from "Auto-selected lowest-security endpoint" to "Auto-selected highest-security endpoint".

Do NOT:
- Change the behavior when `is_none_policy` is false (that branch is correct — configured policy not found means warn and return None)
- Remove the hostname rewrite logic that follows (that is still needed)
- Skip the keypair rebuild at line 283 — signing/encrypting policies require it and the existing logic handles this correctly
