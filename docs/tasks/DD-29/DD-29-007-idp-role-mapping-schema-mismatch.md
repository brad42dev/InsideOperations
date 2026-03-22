---
id: DD-29-007
title: Fix IdP role mapping column name mismatch and add regex match type
unit: DD-29
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `apply_group_role_mappings` function in `oidc.rs` must correctly query the `idp_role_mappings` table using the actual schema column names, and must support the `regex` match type as specified. Currently it queries a column `idp_group` which does not exist in the spec schema (the column is named `idp_group_value`), and the `regex` match type is silently skipped.

## Spec Excerpt (verbatim)

> ```sql
> CREATE TABLE idp_role_mappings (
>     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
>     provider_id     UUID NOT NULL REFERENCES auth_provider_configs(id) ON DELETE CASCADE,
>     idp_group_value TEXT NOT NULL,         -- group name/ID from IdP assertion
>     role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
>     match_type      VARCHAR(20) NOT NULL DEFAULT 'exact',
>                     -- 'exact': idp_group_value must match exactly
>                     -- 'prefix': idp_group_value is a prefix (for nested group paths)
>                     -- 'regex': idp_group_value is a regex pattern
> ```
> — design-docs/29_AUTHENTICATION.md, §IdP Role Mapping

## Where to Look in the Codebase

Primary files:
- `services/auth-service/src/handlers/oidc.rs` — `apply_group_role_mappings` function (lines 610-648); column `idp_group` at line 618, `idp_group` get at line 625; match_type `regex` case missing (only exact/prefix/contains)
- Database migrations — check which column name was actually used in the DDL

## Verification Checklist

- [ ] The SQL query at oidc.rs:618 references `idp_group_value` not `idp_group`.
- [ ] The column name in `mapping.get()` at line 625 is `idp_group_value`.
- [ ] The `regex` match type is implemented using Rust's `regex` crate.
- [ ] The `contains` match type (currently implemented but not in spec) is reviewed — replace with `regex` if it is a substitute, or remove if not spec-required.
- [ ] `apply_group_role_mappings` is also used by `ldap_auth.rs` (line 19 import) — verify both callers work after the fix.

## Assessment

- **Status**: ⚠️ Wrong
- **Current state**: `oidc.rs:618` queries `"SELECT idp_group, role_id, match_type FROM idp_role_mappings WHERE provider_config_id = $1"`. The spec schema column is `idp_group_value` and the FK column is `provider_id` (not `provider_config_id`). Line 625 reads `mapping.get("idp_group")`. Lines 630-634 implement `exact`, `prefix`, `contains` — but spec defines `exact`, `prefix`, `regex`. The `contains` match type is not in the spec; `regex` is.

## Fix Instructions

**Step 1 — Fix column and FK names** in the SQL query at oidc.rs:618:
```sql
SELECT idp_group_value, role_id, match_type
FROM idp_role_mappings
WHERE provider_id = $1 AND enabled = true
```
Note: also filter `enabled = true` per the spec index definition.

**Step 2 — Fix column read** at line 625:
```rust
let idp_group_value: String = mapping.get("idp_group_value");
```

**Step 3 — Add regex match** and update the match expression (lines 629-634):
```rust
let matched = groups.iter().any(|g| match match_type.as_str() {
    "exact" => g == &idp_group_value,
    "prefix" => g.starts_with(&idp_group_value),
    "regex" => {
        regex::Regex::new(&idp_group_value)
            .map(|re| re.is_match(g))
            .unwrap_or(false)
    }
    _ => false,
});
```

Add `regex = "1"` to `Cargo.toml` if not already present.

**Step 4 — Remove `contains` match type** if it is not in the spec (it is not). The `_ => false` branch handles it safely by ignoring unknown match types.

**Step 5 — Check FK migration**: If the actual database column is `provider_config_id` (matching the current query), then the query is correct for the actual DB but the spec says `provider_id`. Verify against the applied migration. If the migration used `provider_id`, fix the query to match; if it used `provider_config_id`, fix the schema to match the spec.

Do NOT:
- Break the LDAP auth flow which also calls `apply_group_role_mappings` via import
- Compile regex patterns on every login — cache compiled patterns if performance requires it (for now, compiling per-login is acceptable)
