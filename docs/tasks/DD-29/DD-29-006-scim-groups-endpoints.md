---
id: DD-29-006
title: Implement SCIM 2.0 Groups endpoints
unit: DD-29
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

SCIM 2.0 provisioning from Azure AD and Okta requires a complete Groups resource implementation in addition to Users. IdPs use Groups to sync role membership. When Azure AD or Okta pushes a group change (e.g., user removed from "Operators" group), I/O must process it and update the user's `user_roles` table accordingly.

## Spec Excerpt (verbatim)

> | Method | Path | Description |
> |--------|------|-------------|
> | `GET` | `/scim/v2/Groups` | List/filter groups |
> | `GET` | `/scim/v2/Groups/:id` | Get group |
> | `POST` | `/scim/v2/Groups` | Create group |
> | `PUT` | `/scim/v2/Groups/:id` | Replace group |
> | `PATCH` | `/scim/v2/Groups/:id` | Partial update group |
> | `DELETE` | `/scim/v2/Groups/:id` | Delete group |
>
> **Azure AD/Entra ID**: Sends `active: false` for deprovisioning (never DELETE). Requires `/ServiceProviderConfig` and `/Schemas`. Sends `externalId` as primary identifier.
> — design-docs/29_AUTHENTICATION.md, §5. SCIM 2.0 Provisioning

## Where to Look in the Codebase

Primary files:
- `services/auth-service/src/handlers/scim.rs` — all SCIM handling; no group handlers exist; add group handlers to this file
- `services/auth-service/src/main.rs` — lines 213-224: SCIM routes; Groups routes not present

## Verification Checklist

- [ ] `GET /scim/v2/Groups` returns a SCIM ListResponse with all groups (roles mapped as groups).
- [ ] `GET /scim/v2/Groups/:id` returns a single group or 404.
- [ ] `POST /scim/v2/Groups` creates a new role/group mapping entry.
- [ ] `PUT /scim/v2/Groups/:id` replaces group members (diffs against current `user_roles` for idp-sourced roles).
- [ ] `PATCH /scim/v2/Groups/:id` supports `op: add/remove/replace` on `members` array.
- [ ] `DELETE /scim/v2/Groups/:id` removes the group (or marks inactive).
- [ ] All group endpoints validate the SCIM bearer token (same `validate_scim_token` function used by Users).
- [ ] SCIM Schemas endpoint (`GET /scim/v2/Schemas`) already includes the Group schema — verify it does.

## Assessment

- **Status**: ❌ Missing
- **No group handlers exist** in `scim.rs`. The `main.rs` routes at lines 213-224 register only User endpoints (`/scim/v2/Users` and `/scim/v2/Users/:id`). No `/scim/v2/Groups` routes exist. The `list_schemas` handler (scim.rs:243) does advertise the Group schema in its response, which is correct — but there are no endpoints to back it up.

## Fix Instructions

**Data model**: I/O groups in SCIM context map to I/O roles. A SCIM Group with `displayName = "Operators"` corresponds to the `roles` table row with `name = "Operators"`. Members of that group are users in `user_roles` where `role_source = 'scim'`.

**Step 1 — Add group type structs** in `scim.rs`:
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ScimGroup {
    pub schemas: Vec<String>,
    pub id: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub members: Option<Vec<ScimGroupMember>>,
    #[serde(rename = "externalId")]
    pub external_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScimGroupMember {
    pub value: String,         // user ID
    pub display: Option<String>,
}
```

**Step 2 — Implement handlers**:

`list_groups`: Query `roles` table, return as SCIM ListResponse. Support `filter=displayName eq "..."`.

`get_group`: Query `roles` by UUID, return with current members from `user_roles WHERE role_source = 'scim'`.

`create_group`: Insert into `roles` table. If a role with the same name exists, return existing (idempotent).

`replace_group` (PUT): Full member replacement — diff incoming `members` array against current `user_roles` rows with `role_source = 'scim'`, insert missing, remove extra.

`patch_group` (PATCH): Handle `op: add/remove/replace` on `members` path:
- `add`: Insert `user_roles` rows for listed members
- `remove`: Delete `user_roles` rows for listed members
- `replace` on members: Same as PUT members list

`delete_group`: Remove `user_roles` rows with `role_source = 'scim'` for this role; optionally soft-delete the role itself.

**Step 3 — Register routes** in `main.rs` after the SCIM Users routes (around line 224):
```rust
.route("/scim/v2/Groups",
    get(handlers::scim::list_groups)
        .post(handlers::scim::create_group))
.route("/scim/v2/Groups/:id",
    get(handlers::scim::get_group)
        .put(handlers::scim::replace_group)
        .patch(handlers::scim::patch_group)
        .delete(handlers::scim::delete_group))
```

Do NOT:
- Forget to call `validate_scim_token` in every group handler
- Create new database tables — use the existing `roles` and `user_roles` tables
- Set `role_source = 'manual'` for SCIM-managed role assignments (must be `'scim'`)
