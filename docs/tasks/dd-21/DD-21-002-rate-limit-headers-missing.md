---
id: DD-21-002
title: Emit X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset on every response
unit: DD-21
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Every API response — not just 429 responses — must include three rate-limit informational headers so clients can monitor their quota and implement proactive backoff before hitting the limit.

## Spec Excerpt (verbatim)

> **Headers on every response:**
> - `X-RateLimit-Limit`: Maximum requests allowed in the window
> - `X-RateLimit-Remaining`: Requests remaining in current window
> - `X-RateLimit-Reset`: Unix timestamp when the window resets
> - `Retry-After`: Seconds to wait (only on 429 responses)
> — design-docs/21_API_DESIGN.md, §Rate Limiting

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/mw.rs:179-244` — The `rate_limit` middleware. Currently only adds `x-ratelimit-limit` and `retry-after` inside the `if !allowed` block (lines 232-240). The `next.run(req).await` path on line 243 returns the response with no rate-limit headers at all.

## Verification Checklist

- [ ] Every successful (non-429) response contains `X-RateLimit-Limit` header.
- [ ] Every successful (non-429) response contains `X-RateLimit-Remaining` header with an integer equal to the remaining tokens for the bucket key.
- [ ] Every successful (non-429) response contains `X-RateLimit-Reset` header with a Unix timestamp (seconds) when the current window resets.
- [ ] 429 responses still include all four headers including `Retry-After`.
- [ ] Header names use the correct capitalisation: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset` (HTTP headers are case-insensitive, but use lowercase per the existing `retry-after` convention in this codebase).

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `x-ratelimit-limit` is added only on 429. `x-ratelimit-remaining` and `x-ratelimit-reset` are never added. The allowed-request path (`next.run(req).await` at mw.rs:243) returns the response with no mutation.

## Fix Instructions

In `services/api-gateway/src/mw.rs`, update the `rate_limit` middleware function:

1. After the `RATE_BUCKETS.entry(...)` block (around line 217), **compute the remaining tokens and reset timestamp** before running the next handler:
   ```rust
   // Read remaining after deducting one token (or 0 if blocked)
   let remaining = {
       let entry = RATE_BUCKETS.get(&key).map(|e| e.tokens.floor() as u64).unwrap_or(0);
       entry
   };
   let reset_ts = now + window_secs as i64; // approximate reset = now + window
   ```

2. After the 429 early-return block, call `next.run(req).await` and **inject the headers into the response**:
   ```rust
   let mut resp = next.run(req).await;
   resp.headers_mut().insert(
       "x-ratelimit-limit",
       HeaderValue::from_str(&(limit as u64).to_string()).unwrap(),
   );
   resp.headers_mut().insert(
       "x-ratelimit-remaining",
       HeaderValue::from_str(&remaining.to_string()).unwrap(),
   );
   resp.headers_mut().insert(
       "x-ratelimit-reset",
       HeaderValue::from_str(&reset_ts.to_string()).unwrap(),
   );
   resp
   ```

3. **On 429 responses**, add the same three headers in addition to `retry-after`:
   - `x-ratelimit-limit` — already present (mw.rs:236-239)
   - `x-ratelimit-remaining` — add: value is `0`
   - `x-ratelimit-reset` — add: value is `now + window_secs as i64`

Note: The `window_secs` value is already in scope within `rate_limit`. The `now` variable is the start-of-request timestamp already computed at line 181.

Do NOT:
- Remove the `retry-after` header that already exists on 429 responses — it is correct and required.
- Change the bucket computation logic — only the response mutation needs updating.
- Use milliseconds for `X-RateLimit-Reset` — the spec implies Unix seconds (consistent with standard `Retry-After` semantics).
