---
id: DD-29-003
title: Verify SAML assertion XML signature using IdP certificate
unit: DD-29
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When the auth service receives a SAML Response at the Assertion Consumer Service (ACS) endpoint, it must cryptographically verify the XML digital signature on the assertion using the IdP's signing certificate. Without this, any party who can POST to the ACS endpoint can forge a SAML Response with arbitrary user claims and gain unauthorized access.

## Spec Excerpt (verbatim)

> 6. I/O validates: XML signature, `InResponseTo` matches `RequestID`, assertion timestamps, audience restriction
> — design-docs/29_AUTHENTICATION.md, §3. SAML 2.0 (SP-Initiated Flow)

> **Crate**: `samael` v0.0.19 (MIT). Pre-1.0, C dependency on `xmlsec1` for XML signature verification.
> — design-docs/29_AUTHENTICATION.md, §3. SAML 2.0

## Where to Look in the Codebase

Primary files:
- `services/auth-service/src/handlers/saml.rs` — `saml_acs` function (lines 167-313); assertion is parsed via `samael` at line 188 but no signature verification call is made; `extract_saml_claims` (lines 315-397) reads attributes from the parsed structure without any validation
- `services/auth-service/Cargo.toml` — check if `samael` is present with XML signature feature

## Verification Checklist

- [ ] The IdP's signing certificate is loaded from `auth_provider_configs.config["idp_certificate"]` at ACS time.
- [ ] `samael`'s signature verification API is called before any claims are extracted from the assertion.
- [ ] The `InResponseTo` attribute of the SAML Response is matched against the stored `request_id` from `saml_request_store`.
- [ ] Assertion timestamp conditions (`NotBefore`, `NotOnOrAfter`) are validated (allow ±2 minute clock skew).
- [ ] Audience restriction element is validated to confirm the assertion is intended for this SP.
- [ ] A SAML Response with a missing or invalid signature is rejected with 401, not accepted.
- [ ] A SAML Response whose `InResponseTo` does not match a stored request is rejected (replay prevention).

## Assessment

- **Status**: ❌ Missing
- **Current state**: `saml.rs:188` uses `samael::schema::Response::parse()` which parses XML structure only. No signature validation API is called. The `request_id` from the stored SAML request (line 210) is suppressed with `let _ = &request_id;` at line 220 — it is not used to validate `InResponseTo`. The `idp_certificate` from config is loaded but never passed to any verification function. Claims are read from the bare parsed structure.

## Fix Instructions

**Step 1 — Load IdP certificate**: In `saml_acs`, after loading `config_row`, extract `config["idp_certificate"]` as a PEM string.

**Step 2 — Verify signature**: The `samael` crate provides signature verification. Check the samael API for your version (0.0.19):
```rust
// Example pattern — verify against the response-level or assertion-level signature
response.verify_against_certificate(&idp_cert_pem)
    .map_err(|e| IoError::BadRequest(format!("SAML signature invalid: {e}")))?;
```

If the samael API has changed, use `samael::metadata::IdpSsoDescriptor` or the raw xmlsec1 bindings. The key requirement is that the signature verification path is called before `extract_saml_claims`.

**Step 3 — Validate InResponseTo**: Restore use of `request_id`. After line 210 (`let (request_id, config_id)`), check:
```rust
if let Some(in_response_to) = response.in_response_to.as_deref() {
    if in_response_to != request_id {
        return IoError::Unauthorized.into_response();
    }
}
```

**Step 4 — Validate timestamps**: Check `response.assertion.as_ref().unwrap().conditions` for `NotBefore` and `NotOnOrAfter` with ±2 minute clock skew allowance.

**Step 5 — Validate audience**: Check `AudienceRestriction` elements contain the SP entity ID (`SAML_SP_ENTITY_ID` env var).

**Build note**: The `samael` crate requires `libxmlsec1-dev` on the build system. The deployment guide (DD-22) should document this. If `samael` is not already in `Cargo.toml`, add `samael = "0.0.19"`.

Do NOT:
- Accept SAML assertions before signature verification
- Remove the `request_id` from the database lookup query
- Skip timestamp or audience validation after adding signature verification
