# 29. Authentication & Identity

## Overview

This document specifies I/O's authentication, identity provider integration, multi-factor authentication, and user provisioning architecture. It replaces the brief authentication section in doc 03 (Security & RBAC) with a comprehensive design while doc 03 retains ownership of RBAC permissions, audit logging, and input validation.

I/O supports multiple authentication methods simultaneously via a pluggable provider model:

- **Local** — Username/password with Argon2id hashing (existing)
- **OIDC** — OpenID Connect SSO with any compliant IdP (primary SSO path)
- **SAML 2.0** — SP-initiated and IdP-initiated SSO (enterprise compatibility)
- **LDAP/AD** — Bind authentication against Active Directory or LDAP servers
- **SCIM 2.0** — Automated user/group provisioning from IdPs

Multi-factor authentication is enforced for local and LDAP users (SSO IdPs handle their own MFA):

- **TOTP** — Time-based one-time passwords (Google/Microsoft/Duo/Okta Authenticator, Authy, 1Password, Bitwarden)
- **Duo Security** — Duo Universal Prompt via OIDC Auth API
- **SMS** — 6-digit codes via Twilio (admin-disablable, security warning)
- **Email** — 6-digit codes via Email Service (admin-disablable, security warning)
- **Recovery Codes** — Backup codes for TOTP enrollment

---

## Architecture

### Auth Flow Overview

```
                         ┌──────────────────┐
                         │    Login Page     │
                         │                   │
                         │ [User/Pass]  [SSO]│
                         └────────┬──────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │              │
                    ▼             ▼              ▼
              ┌──────────┐ ┌──────────┐  ┌──────────┐
              │  Local   │ │   OIDC   │  │   SAML   │
              │  Auth    │ │   Flow   │  │   Flow   │
              │          │ │          │  │          │
              │ Argon2id │ │ AuthCode │  │ AuthnReq │
              │ verify   │ │ + PKCE   │  │ → IdP    │
              └────┬─────┘ └────┬─────┘  └────┬─────┘
                   │             │              │
              ┌────▼─────┐      │              │
              │  LDAP    │      │              │
              │  Bind    │      │              │
              │ (alt)    │      │              │
              └────┬─────┘      │              │
                   │             │              │
                   └──────┬──────┘──────┬──────┘
                          │             │
                          ▼             │
                   ┌─────────────┐      │
                   │ MFA Check   │      │ SSO IdPs
                   │ (local/LDAP │      │ handle
                   │  users only)│      │ their own
                   │             │      │ MFA
                   │ TOTP / Duo  │      │
                   │ SMS / Email │      │
                   └──────┬──────┘      │
                          │             │
                          └──────┬──────┘
                                 │
                                 ▼
                          ┌─────────────┐
                          │  JWT Issue  │
                          │             │
                          │ Access 15m  │
                          │ Refresh 7d  │
                          └─────────────┘
```

### Provider Selection

The login page dynamically renders available auth options based on which providers are enabled:

- **Local auth** always appears as username/password fields (unless disabled by admin)
- **SSO providers** appear as buttons: "Sign in with Corporate SSO", "Sign in with Okta", etc.
- **LDAP** appears as a separate username/password form or a domain selector dropdown
- Admin configures display order and default provider

### Post-Auth Convergence

All auth providers converge to the same JWT token infrastructure. Once primary authentication (+ MFA if applicable) succeeds:

1. Look up or create local user record (JIT provisioning for SSO/LDAP)
2. Map external groups/claims to I/O roles
3. **EULA acceptance check** (see below)
4. Issue JWT access token (15min) + refresh token (7-day, httpOnly cookie, rotating)
5. From this point forward, the session is indistinguishable regardless of auth source

### EULA Acceptance Gate

After successful authentication (including MFA) but before issuing JWT tokens, the Auth Service checks whether the user has accepted the current EULA version. This is a hard gate — no tokens are issued until acceptance is recorded.

**Acceptance check flow:**

1. Auth Service queries `eula_acceptances` for any row matching `(user_id, eula_version_id)` where `eula_version_id` is the current active version
2. If at least one acceptance row exists for that user + version → proceed to JWT issuance
3. If no acceptance exists → return a `eula_required` response instead of tokens

**Backend response when EULA acceptance is needed:**

```json
{
  "status": "eula_required",
  "eula_pending_token": "<short-lived-opaque-token>",
  "eula": {
    "version": "1.0",
    "title": "End User License Agreement",
    "content_url": "/api/auth/eula/current"
  }
}
```

The `eula_pending_token` is a short-lived token (5 minutes, single-use) stored in an in-memory `DashMap` (same pattern as WebSocket tickets). It proves the user passed authentication but cannot access any API endpoint except `POST /api/auth/eula/accept`.

**Frontend clickwrap UI:**

The frontend intercepts the `eula_required` response and renders a full-screen EULA acceptance page:

- EULA text rendered in a scrollable container (markdown rendered to HTML)
- Scroll-to-bottom indicator (subtle "scroll to continue" hint, not a gate — users can accept without scrolling to the bottom)
- **Checkbox**: "I have read and agree to the End User License Agreement" (unchecked by default)
- **Button**: "Accept and Continue" (disabled until checkbox is checked)
- EULA version number displayed below the title (e.g., "Version 1.0")
- No "Decline" button — the user simply closes the browser or navigates away
- If the user closes without accepting, their next login attempt shows the EULA again

**Why dual-click (checkbox + button):** Courts enforce clickwrap agreements at ~70% vs ~14% for browsewrap. The dual-action pattern (Feldman v. Google, 2007) establishes that the user affirmatively consented rather than accidentally clicking past a screen.

**Acceptance recording flow:**

1. User checks the checkbox and clicks "Accept and Continue"
2. Frontend calls `POST /api/auth/eula/accept` with the `eula_pending_token`
3. Auth Service validates the pending token (exists, not expired, not already used)
4. Auth Service inserts a new row into `eula_acceptances` capturing:
   - User ID
   - EULA version ID
   - Timestamp (server-side `now()`, not client-provided)
   - Client IP address (from request headers, respecting `X-Forwarded-For` behind nginx)
   - User's current role(s) at time of acceptance
   - Full `User-Agent` header string
   - Username snapshot (in case the user is later renamed or deactivated)
5. Auth Service issues JWT access + refresh tokens (completing the login)
6. Frontend proceeds to the application

**Every acceptance is kept forever.** The `eula_acceptances` table is append-only — rows are never updated or deleted. If a user somehow accepts the same version twice (e.g., concurrent login race condition), both rows are kept. This provides a complete legal audit trail:
- When each user accepted each version
- From what IP address
- What role they held at that time
- What browser they used

This matters because in a dispute, you need to prove that *this specific person* accepted *this specific version* at *this specific time*. A single "most recent acceptance" row doesn't prove the history.

#### EULA Version Lifecycle

```
┌─────────┐    POST /versions     ┌─────────┐    POST /publish    ┌───────────┐
│         │ ──────────────────────▶│         │ ──────────────────▶ │           │
│ (none)  │                       │  DRAFT  │                     │  ACTIVE   │
│         │                       │         │                     │           │
└─────────┘                       └─────────┘                     └───────────┘
                                    │     ▲                          │
                                    │     │ PUT /versions/:id        │ new version
                                    │     │ (edit while draft)       │ published
                                    └─────┘                          │
                                                                     ▼
                                                               ┌───────────┐
                                                               │ ARCHIVED  │
                                                               │ (previous │
                                                               │  version) │
                                                               └───────────┘
```

**States:**
- **Draft**: `published_at IS NULL`. Editable. Not visible to users. Only one draft can exist at a time.
- **Active**: `is_active = true, published_at IS NOT NULL`. The version users must accept. Exactly one active version at all times.
- **Archived**: `is_active = false, published_at IS NOT NULL`. Previous versions. Kept permanently for audit trail (users' acceptance records reference these).

**Publishing a new version (the re-acceptance trigger):**

When an admin calls `POST /api/auth/admin/eula/versions/:id/publish`:

1. Validate the version is currently in draft state (`published_at IS NULL`)
2. In a single transaction:
   - Set the currently active version's `is_active` to `false` (it becomes archived)
   - Set the new version's `is_active` to `true` and `published_at` to `now()`
3. That's it. No sessions are terminated, no notifications sent.
4. On every subsequent login, the acceptance check (step 1 of the gate flow) will find no acceptance row for the new version, and the user will be prompted.

**Effect on existing sessions:** None. Users who are already logged in continue working. They will see the new EULA on their next login. This is deliberate — force-logging out an entire refinery control room because the legal team updated a comma would be operationally dangerous.

**Admin-accepted organizational binding:**

The first admin user to accept a new EULA version also establishes organizational consent. The `eula_acceptances` table records `accepted_as_role` which includes `'Admin'` for this acceptance. This is important because the EULA's Section 2.6 states that the accepting administrator represents they have authority to bind the Licensee (the organization).

**Bypasses:**
- **Service accounts and API keys:** EULA acceptance is not required for service account API key authentication. Service accounts are created by an admin who has already accepted the EULA.
- **Emergency accounts:** Emergency/break-glass accounts bypass the EULA check (same as MFA bypass). Their usage is already heavily audited.

#### EULA Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/eula/current` | None | Get current active EULA version content (public — needed for login page) |
| `POST` | `/api/auth/eula/accept` | EULA pending token | Accept current EULA, record acceptance, complete login |
| `GET` | `/api/auth/eula/status` | JWT | Check if current user has accepted current EULA version |

#### EULA Admin Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/auth/admin/eula/versions` | `system:configure` | List all EULA versions (draft, active, archived) |
| `GET` | `/api/auth/admin/eula/versions/:id` | `system:configure` | Get specific EULA version with content |
| `POST` | `/api/auth/admin/eula/versions` | `system:configure` | Create new EULA version (draft) |
| `PUT` | `/api/auth/admin/eula/versions/:id` | `system:configure` | Update draft EULA version (fails if published) |
| `DELETE` | `/api/auth/admin/eula/versions/:id` | `system:configure` | Delete draft version only (fails if published — published versions are permanent) |
| `POST` | `/api/auth/admin/eula/versions/:id/publish` | `system:configure` | Publish version (makes it active, archives previous, triggers re-acceptance) |
| `GET` | `/api/auth/admin/eula/acceptances` | `system:configure` | List all acceptance records (paginated, filterable by version/user/date) |
| `GET` | `/api/auth/admin/eula/acceptances/export` | `system:configure` | Export all acceptance records as CSV (legal audit export) |
| `GET` | `/api/auth/admin/eula/acceptances/summary` | `system:configure` | Acceptance summary: total users, accepted count, pending count per version |

#### Schema

```sql
CREATE TABLE eula_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL UNIQUE,       -- e.g., '1.0', '1.1', '2.0'
    title VARCHAR(255) NOT NULL DEFAULT 'End User License Agreement',
    content TEXT NOT NULL,                      -- full EULA text in markdown
    content_hash VARCHAR(64) NOT NULL,          -- SHA-256 of content (proves content wasn't altered after acceptance)
    is_active BOOLEAN NOT NULL DEFAULT false,   -- only one active at a time
    published_at TIMESTAMPTZ,                   -- null = draft, non-null = published
    archived_at TIMESTAMPTZ,                    -- when this version was superseded
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id),
    published_by UUID REFERENCES users(id)      -- which admin published this version
);

-- Enforce exactly one active EULA version
CREATE UNIQUE INDEX idx_eula_versions_active ON eula_versions (is_active) WHERE is_active = true;

-- Prevent deleting published versions
CREATE OR REPLACE FUNCTION prevent_eula_version_delete() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.published_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot delete a published EULA version (id: %). Published versions are permanent for legal audit purposes.', OLD.id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_eula_version_delete
    BEFORE DELETE ON eula_versions
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_version_delete();

-- Prevent modifying published version content
CREATE OR REPLACE FUNCTION prevent_eula_version_content_edit() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.published_at IS NOT NULL AND (NEW.content != OLD.content OR NEW.title != OLD.title) THEN
        RAISE EXCEPTION 'Cannot modify the content or title of a published EULA version (id: %). Create a new version instead.', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_eula_version_content_edit
    BEFORE UPDATE ON eula_versions
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_version_content_edit();

CREATE TABLE eula_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    eula_version_id UUID NOT NULL REFERENCES eula_versions(id),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_from_ip INET NOT NULL,
    accepted_as_role TEXT NOT NULL,             -- user's role(s) at time of acceptance, comma-separated
    username_snapshot VARCHAR(50) NOT NULL,     -- username at time of acceptance (immutable record)
    user_agent TEXT NOT NULL,                   -- full browser User-Agent string
    content_hash VARCHAR(64) NOT NULL           -- SHA-256 of the EULA content at acceptance time (proof of what was shown)
);

-- Append-only: no updates, no deletes
CREATE OR REPLACE FUNCTION prevent_eula_acceptance_modify() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'EULA acceptance records are append-only and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_eula_acceptance_update
    BEFORE UPDATE ON eula_acceptances
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_acceptance_modify();

CREATE TRIGGER trg_prevent_eula_acceptance_delete
    BEFORE DELETE ON eula_acceptances
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_acceptance_modify();

-- Index for the login-time acceptance check (hot path)
CREATE INDEX idx_eula_acceptances_user_version
    ON eula_acceptances (user_id, eula_version_id);

-- Index for admin audit queries
CREATE INDEX idx_eula_acceptances_version_date
    ON eula_acceptances (eula_version_id, accepted_at);
```

**Key schema design decisions:**

- **No unique constraint on `(user_id, eula_version_id)`**: Deliberately allows multiple acceptance records per user per version. Every click of "Accept" creates a new row. This means if there's ever a legal question about when a user accepted, you have the complete history — not just the latest.
- **`content_hash` on both tables**: The version table stores the hash when content is saved. The acceptance table copies the hash at acceptance time. This cryptographically proves what text the user was shown when they clicked "Accept," even if someone later claims the content was altered. If `eula_versions.content_hash` matches `eula_acceptances.content_hash`, the content is proven unchanged.
- **`username_snapshot`**: Captures the username at acceptance time. If a user is later renamed, deactivated, or deleted from an IdP, the acceptance record still identifies who accepted.
- **Append-only enforcement via triggers**: Database-level guarantee that acceptance records cannot be tampered with. Even a superadmin running raw SQL against the database will hit the trigger. The only way to remove records is to drop the trigger first, which would be visible in PostgreSQL's audit log.
- **Published versions are permanent**: Cannot be deleted or have their content modified. The trigger prevents it at the database level.
- **No retention policy**: EULA acceptance records are excluded from any data retention or cleanup jobs. They persist for the life of the installation. The storage cost is negligible (a few KB per user per version).

**Initial seeding:** The v1.0 EULA is seeded from `InOps/EULA.md` during installation. The installer computes the SHA-256 hash of the markdown content and stores it in `content_hash`. The version is created in `published` + `active` state so the first user to log in is prompted immediately.

---

## Auth Providers

### Provider Configuration Model

```sql
CREATE TABLE auth_provider_configs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type       VARCHAR(20) NOT NULL,       -- 'oidc', 'saml', 'ldap'
    name                VARCHAR(100) NOT NULL UNIQUE,
    display_name        VARCHAR(200) NOT NULL,      -- shown on login page button
    enabled             BOOLEAN NOT NULL DEFAULT false,
    config              JSONB NOT NULL,             -- provider-specific config (secrets encrypted)
    jit_provisioning    BOOLEAN NOT NULL DEFAULT false,
    default_role_id     UUID REFERENCES roles(id),
    display_order       SMALLINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id)
);
```

Multiple providers can be active simultaneously. Each user is linked to exactly one provider via their `auth_provider` and `auth_provider_config_id` columns.

### 1. Local Authentication (Existing)

The current auth system. Username/password verified against Argon2id hash in the `users` table.

**Changes from current design**:
- `password_hash` becomes **nullable** (external auth users have no local password)
- New columns on `users` table (see Schema Changes section)
- MFA challenge inserted between password verification and JWT issuance

**Flow**: Login → Argon2id verify → MFA challenge (if required) → JWT issue

### 2. OIDC (OpenID Connect)

**Priority**: P0 — primary SSO path. Mature crate, standard protocol, works with all major IdPs.

**Crate**: `openidconnect` v4 (MIT/Apache-2.0) — built on `oauth2` crate already in the stack.

**Configuration** (stored in `auth_provider_configs.config`):

| Field | Description |
|-------|-------------|
| `issuer_url` | OIDC issuer URL (e.g., `https://login.microsoftonline.com/{tenant}/v2.0`) |
| `client_id` | Application client ID from IdP |
| `client_secret` | Application client secret (encrypted at rest) |
| `scopes` | Requested scopes (default: `openid profile email`) |
| `claims_mapping` | Map IdP claims to I/O fields: `{"email": "email", "name": "full_name", "groups": "groups"}` |
| `additional_params` | Extra authorization request parameters (e.g., `{"domain_hint": "corp.com"}`) |
| `allow_signup` | Whether JIT provisioning creates new users (same as `jit_provisioning` on parent table) |

**Authorization Code Flow with PKCE**:

1. User clicks SSO button → `GET /api/auth/oidc/{config_id}/login`
2. I/O generates `state` (CSRF, stored server-side with 5min TTL), `nonce` (replay protection), PKCE `code_verifier` + `code_challenge`
3. Redirect to IdP authorization endpoint with `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `nonce`, `code_challenge`, `code_challenge_method=S256`
4. User authenticates at IdP (IdP handles its own MFA)
5. IdP redirects to `GET /api/auth/oidc/callback` with `code` and `state`
6. I/O verifies `state` matches stored value
7. I/O exchanges `code` + `code_verifier` for tokens at IdP token endpoint
8. I/O validates `id_token`: signature via JWKS, issuer, audience, nonce, expiry
9. I/O extracts claims (`sub`, `email`, `name`, `groups`)
10. I/O looks up user by `(auth_provider='oidc', auth_provider_config_id, auth_provider_user_id=sub)`
11. If not found and JIT provisioning enabled: create user, map groups to roles
12. If not found and JIT disabled: reject with "Account not provisioned"
13. Issue JWT access + refresh tokens

**Discovery**: The `openidconnect` crate natively fetches `.well-known/openid-configuration` to auto-discover authorization, token, JWKS, and userinfo endpoints. Admin only needs to provide `issuer_url`, `client_id`, and `client_secret`.

**Compatible IdPs**: Azure AD/Entra ID, Okta, Google Workspace, PingFederate/PingOne, Auth0, Keycloak, OneLogin, any OIDC-compliant provider.

### 3. SAML 2.0

**Priority**: P1 — needed for ADFS, some PingFederate, and organizations that mandate SAML.

**Crate**: `samael` v0.0.19 (MIT). Pre-1.0, C dependency on `xmlsec1` for XML signature verification. Last upstream commit June 2024 — project is effectively stalled but remains the only published SAML 2.0 SP crate on crates.io. Higher risk than OIDC.

**Future pure-Rust path**: `bergshamra` v0.3.1 (BSD-2-Clause) is a new pure-Rust XML Digital Signature library (no FFI, no unsafe) built on RustCrypto. 99.2% pass rate against the xmlsec interop test suite. It handles XML-DSig (the crypto layer samael delegates to xmlsec1) but not SAML protocol flows. When bergshamra matures, samael's xmlsec1 backend could be replaced — eliminating the C dependency entirely. Monitor for adoption.

**Configuration**:

| Field | Description |
|-------|-------------|
| `entity_id` | I/O's SP entity ID (e.g., `https://io.plant.com/saml/metadata`) |
| `idp_metadata_url` | URL to IdP metadata XML (auto-fetches SSO URL, signing cert) |
| `idp_metadata_xml` | Alternative: paste IdP metadata XML directly |
| `idp_sso_url` | IdP SSO endpoint (auto-populated from metadata) |
| `idp_slo_url` | IdP SLO endpoint (optional) |
| `idp_certificate` | IdP signing certificate (auto-populated from metadata) |
| `sp_signing_key` | SP private key for signing AuthnRequests (encrypted at rest) |
| `sp_signing_cert` | SP certificate (public) |
| `nameid_format` | NameID format (`urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` or `unspecified`) |
| `claims_mapping` | Map SAML attributes to I/O fields |
| `allow_idp_initiated` | Allow unsolicited assertions (default: false, security risk) |

**SP-Initiated Flow** (recommended):

1. User clicks SAML SSO button → `POST /api/auth/saml/{config_id}/login`
2. I/O generates SAML AuthnRequest with unique `RequestID` and `RelayState`
3. Redirect to IdP SSO URL with AuthnRequest (HTTP-Redirect or HTTP-POST binding)
4. User authenticates at IdP
5. IdP POSTs SAML Response to `POST /api/auth/saml/acs` (Assertion Consumer Service)
6. I/O validates: XML signature, `InResponseTo` matches `RequestID`, assertion timestamps, audience restriction
7. Extract NameID and attributes
8. User lookup/JIT provisioning (same as OIDC)
9. Issue JWT tokens

**IdP-Initiated Flow** (optional, off by default):

Same as above but without steps 1-2. No `RequestID` to validate — vulnerable to replay. Admin must explicitly enable.

**SP Metadata Endpoint**: `GET /api/auth/saml/metadata` returns XML with SP entity ID, ACS URL, signing certificate, supported NameID formats. Admins paste this URL into their IdP configuration.

**Build consideration**: The `xmlsec1` C dependency requires `libxmlsec1-dev` on the build system. Document in deployment guide. Consider feature-flagging SAML so deployments that don't need it can skip the dependency.

### 4. LDAP / Active Directory

**Priority**: P0 — many refineries run on-premises AD. Likely the most common enterprise auth for I/O's target market.

**Crate**: `ldap3` v0.11+ (MIT/Apache-2.0) — pure Rust, async Tokio, GSSAPI/NTLM/LDAPS support.

**Configuration**:

| Field | Description |
|-------|-------------|
| `server_url` | LDAP server URL (`ldaps://dc.corp.plant.com:636` or `ldap://dc.corp.plant.com:389`) |
| `tls_mode` | `ldaps` (implicit TLS) / `starttls` / `none` |
| `bind_dn` | Service account DN for searches (e.g., `CN=io-svc,OU=Service Accounts,DC=corp,DC=plant,DC=com`) |
| `bind_password` | Service account password (encrypted at rest) |
| `search_base` | User search base DN (e.g., `OU=Users,DC=corp,DC=plant,DC=com`) |
| `user_filter` | LDAP filter template (default: `(&(sAMAccountName={username})(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`) |
| `group_search_base` | Group search base DN |
| `group_filter` | Group membership filter (default: `(&(member={userDN})(objectClass=group))`) |
| `group_role_mapping` | Map AD groups to I/O roles |
| `username_attribute` | Attribute for username matching (default: `sAMAccountName`) |
| `email_attribute` | Attribute for email (default: `mail`) |
| `display_name_attribute` | Attribute for display name (default: `displayName`) |
| `referral_handling` | Follow LDAP referrals (default: true) |
| `connection_timeout_ms` | Connection timeout (default: 5000) |

**Bind Authentication Flow**:

1. User enters username + password on login page (selects LDAP domain if multiple)
2. I/O connects to LDAP server (LDAPS or STARTTLS)
3. Bind as service account
4. Search for user: `(&(sAMAccountName={username})(objectClass=user))`
5. If not found: reject
6. Attempt bind with user's DN + provided password
7. If bind fails: reject (invalid credentials)
8. Query group membership: read `memberOf` attribute or search groups
9. Map AD groups to I/O roles
10. Create/update local user record
11. MFA challenge (if required by policy)
12. Issue JWT tokens

**Connection management**: Use `deadpool` (MIT) for a pool of service account connections. User bind connections are transient (bind, verify, close).

**Nested groups**: Optional recursive `memberOf` traversal. AD supports the `LDAP_MATCHING_RULE_IN_CHAIN` OID (`1.2.840.113556.1.4.1941`) for efficient recursive group lookup.

### 5. SCIM 2.0 Provisioning

**Priority**: P2 — automated user lifecycle management from IdPs.

**Crate**: `scim_v2` (MIT) for data models. Endpoints built manually on Axum.

SCIM provides a REST API that IdPs call to push user/group changes to I/O. Instead of admins manually creating users, SCIM auto-syncs:

- User created in IdP → SCIM `POST /Users` → I/O creates local user
- User updated → SCIM `PATCH /Users/{id}` → I/O updates local user
- User deactivated → SCIM `PATCH /Users/{id}` `{active: false}` → I/O disables user
- Group membership changed → SCIM `PATCH /Groups/{id}` → I/O updates role assignments

**Endpoints** (served at `/scim/v2/` prefix, separate from `/api/`):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/scim/v2/ServiceProviderConfig` | Advertise SCIM capabilities |
| `GET` | `/scim/v2/ResourceTypes` | Describe User/Group schemas |
| `GET` | `/scim/v2/Schemas` | Full SCIM schema definitions |
| `GET` | `/scim/v2/Users` | List/filter users |
| `GET` | `/scim/v2/Users/:id` | Get user by SCIM ID |
| `POST` | `/scim/v2/Users` | Create user |
| `PUT` | `/scim/v2/Users/:id` | Replace user |
| `PATCH` | `/scim/v2/Users/:id` | Partial update user |
| `DELETE` | `/scim/v2/Users/:id` | Deactivate user |
| `GET` | `/scim/v2/Groups` | List/filter groups |
| `GET` | `/scim/v2/Groups/:id` | Get group |
| `POST` | `/scim/v2/Groups` | Create group |
| `PUT` | `/scim/v2/Groups/:id` | Replace group |
| `PATCH` | `/scim/v2/Groups/:id` | Partial update group |
| `DELETE` | `/scim/v2/Groups/:id` | Delete group |

**Authentication**: Bearer token generated in I/O Settings, configured in the IdP. Token stored hashed in the database.

**Schema mapping**:

| SCIM Field | I/O Column |
|------------|-----------|
| `userName` | `username` |
| `name.givenName` + `name.familyName` | `full_name` |
| `emails[primary].value` | `email` |
| `active` | `enabled` |
| `externalId` | `external_id` |
| `groups` | Role assignments via `group_role_mapping` |

**IdP-specific behavior**:
- **Azure AD/Entra ID**: Polls SCIM endpoint every ~40 minutes. Uses `PATCH` with `op: replace`. Sends `active: false` for deprovisioning (never DELETE). Requires `/ServiceProviderConfig` and `/Schemas`. Sends `externalId` as primary identifier.
- **Okta**: Pushes changes in near-real-time. Supports both `active: false` and DELETE. Full SCIM 2.0 compliance required for OIN listing.

---

## IdP Role Mapping

When users authenticate via SAML, OIDC, or LDAP, their IdP group memberships are mapped to I/O roles. SCIM provides the same mapping via push-based group sync.

### idp_role_mappings Table

Replaces the `auth_provider_configs.group_role_mapping` JSONB field with a dedicated mapping table for queryability, foreign key integrity, auditability, and match type flexibility.

```sql
CREATE TABLE idp_role_mappings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     UUID NOT NULL REFERENCES auth_provider_configs(id) ON DELETE CASCADE,
    idp_group_value TEXT NOT NULL,         -- group name/ID from IdP assertion
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    site_id         UUID REFERENCES sites(id),  -- NULL = global, non-NULL = site-specific
    match_type      VARCHAR(20) NOT NULL DEFAULT 'exact',
                    -- 'exact': idp_group_value must match exactly
                    -- 'prefix': idp_group_value is a prefix (for nested group paths)
                    -- 'regex': idp_group_value is a regex pattern
    priority        SMALLINT NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    UNIQUE (provider_id, idp_group_value, role_id)
);

CREATE INDEX idx_idp_role_mappings_provider ON idp_role_mappings (provider_id) WHERE enabled = true;
```

### Provider-Specific Group Extraction

| Provider | Group Source |
|----------|-------------|
| SAML | Configurable attribute (default: `groups` or `memberOf`). Each group must be a separate `<AttributeValue>` element. Azure AD sends Object IDs by default — configure "Cloud-only group display names" for human-readable values. |
| OIDC | `groups` claim in ID token (must be requested in scope). Azure AD has a 200-group limit in JWT — detect `_claim_names` overage indicator and fall back to Microsoft Graph `GET /me/memberOf`. |
| LDAP | `memberOf` attribute on user object, resolved recursively for nested groups via `LDAP_MATCHING_RULE_IN_CHAIN` OID (`1.2.840.113556.1.4.1941`) or application-side traversal (capped at 5 levels). |
| SCIM | Groups resource — push-based sync from IdP. Azure sends `op: replace` on full members array; I/O diffs against current state. |

### Sync Algorithm

On every OIDC/SAML login, IdP-sourced roles are re-evaluated:

1. User authenticates, IdP provides group list (via claims, attributes, or `memberOf`)
2. System evaluates all active `idp_role_mappings` for this provider
3. Matching rules produce a set of candidate roles
4. Conflict resolution applies 7 deterministic rules (see below)
5. Resulting roles applied to user's session
6. `role_source` column on `user_roles` tracks origin: `'manual'`, `'idp'`, or `'scim'`

**On login sync behavior:**
- IdP-sourced roles are re-evaluated on every login
- Manual roles are never removed by IdP sync
- If IdP removes a group, the corresponding IdP-sourced role is removed on next login
- If no IdP groups match and no `default_role_id` is set, and the user has no manual roles, login is rejected: "No role mapping found for your IdP groups"
- Admins can see role source (`manual` / `idp` / `scim`) in the user management UI

**LDAP background sync:** In addition to on-login sync, a background task syncs LDAP group memberships every 1 hour (configurable, 30min–24hr). On LDAP query failure, existing role assignments are preserved (errors treated as "no change", never as "empty result").

### Conflict Resolution Rules

Seven deterministic rules, applied in order:

| # | Rule | Description |
|---|------|-------------|
| 1 | Explicit deny overrides allow | If a mapping is configured as deny for a group, that role is removed regardless of other mappings |
| 2 | Site-specific rules override global rules | A mapping with `site_id` set takes precedence over a global mapping for the same group |
| 3 | Exact match > prefix match > regex match | More specific match types win over less specific ones |
| 4 | Higher priority number wins within same specificity | `priority` column breaks ties between rules of the same match type |
| 5 | Most recently created rule wins on tie | `created_at` is the final tiebreaker |
| 6 | Additive merge — no implicit revocation | Multiple IdP groups mapping to different roles produce the union of all mapped roles |
| 7 | Manual role assignments preserved | Roles with `role_source = 'manual'` are never removed by IdP sync. Only an I/O admin can remove them. |

---

## Session Management

### Concurrent Session Limits

Each user is limited to **3 concurrent sessions**. A SharedWorker in the browser ensures that multiple tabs share a single session — opening 10 tabs in the same browser counts as 1 session.

When a user exceeds the session limit:
- The oldest session is terminated with a `session_replaced` WebSocket close frame
- The user sees a notification: "Your session was ended because you signed in on another device"

### Idle Timeout

Per-role idle timeout, configurable by admin:

| Role | Default Idle Timeout |
|------|---------------------|
| Admin | 15 minutes |
| Operator | 60 minutes |
| Viewer | 30 minutes |

**Visual lock vs full termination:**
- When idle timeout expires, the session enters a **visual lock** state: a hidden overlay covers the screen, requiring the user to re-enter their password (or complete MFA) to resume
- Visual lock preserves WebSocket connections and in-memory state — the user returns to exactly where they left off
- After an additional configurable period in visual lock (default: 30 minutes), the session is fully terminated and the user must log in again

### Hard Session Timeout

**8-hour hard session timeout** regardless of activity. After 8 hours, the session is terminated and the user must re-authenticate. This limits the blast radius of a stolen session token and aligns with typical industrial shift lengths.

### Kiosk Mode

For shared control room workstations that display process graphics 24/7:
- **No idle timeout** — the session stays active indefinitely
- **Read-only base** — kiosk sessions default to a read-only role (view graphics, dashboards, process displays)
- Kiosk mode is enabled per-session via a flag set at login time by the admin
- The kiosk account is a standard user with `is_kiosk = true` — not a service account (service accounts use API keys, not browser sessions)

---

## Break-Glass Emergency Access

For situations where normal authentication is unavailable (IdP down, MFA service unreachable, all admin accounts locked out).

### Emergency Accounts

- **2 pre-created emergency accounts** with `is_emergency_account = true` flag
- Created during initial system setup (installer generates them)
- Full admin permissions
- **Split password**: Each account's password is split into two halves, stored separately (e.g., in sealed envelopes in two different physical locations, or held by two different people)
- Both halves must be concatenated to form the complete password

### CLI Emergency Access

`io-ctl emergency` — a CLI tool for emergency access when the web UI or normal auth is completely unavailable (e.g., Auth Service crashed, database unreachable for auth queries).

- Runs directly on the I/O server (requires SSH/console access)
- Bypasses the Auth Service — connects directly to PostgreSQL to validate the emergency account
- Starts a temporary local web session on a non-standard port (e.g., `localhost:9999`)
- Emergency sessions: **4-hour maximum duration**, full audit logging, auto-disable the emergency account after use until re-enabled by another admin

### Safeguards

- All emergency account actions are audit-logged with `is_emergency = true` flag for post-incident review
- After an emergency session ends, the account is automatically disabled — a different admin must re-enable it via Settings
- Emergency accounts cannot disable audit logging or modify other emergency accounts
- Flagged for post-v1 procedural review: the exact physical security procedures for split passwords will vary per deployment

---

## Multi-Factor Authentication

### MFA Scope

**Key principle**: SSO IdPs handle their own MFA. I/O handles MFA only for local and LDAP users.

| Auth Provider | MFA Handled By | I/O MFA Applies? |
|---------------|----------------|------------------|
| Local | I/O | Yes |
| LDAP/AD | I/O | Yes |
| OIDC SSO | IdP | No (IdP's MFA policy applies) |
| SAML SSO | IdP | No (IdP's MFA policy applies) |

**Optional override**: Admin can enable "Require I/O MFA for SSO users" for high-security deployments. Off by default.

### MFA Login Flow

1. User completes primary authentication (password or LDAP bind)
2. I/O checks if user has active MFA enrollment AND if their role's MFA policy requires it
3. If MFA required: return `200` with `{ mfa_required: true, mfa_token: "...", allowed_methods: ["totp", "duo"] }`
4. `mfa_token` is a short-lived token (5 minutes) that proves primary auth succeeded
5. Frontend shows MFA prompt appropriate to allowed methods
6. User provides MFA code/response
7. Frontend calls `POST /api/auth/mfa/verify` with `mfa_token` + response
8. I/O validates MFA response
9. If valid: issue JWT access + refresh tokens
10. If invalid: increment failure counter, lock after configurable failures (default: 5)

### MFA Fallback Behavior

If the selected MFA method fails to deliver (e.g., SMS send fails via `io-sms`):

1. **User has other methods enrolled** (e.g., TOTP or Duo): Prompt the user to choose an alternative method. Display: "Unable to send SMS code. Please use an alternative verification method."
2. **User only has email as alternative**: Automatically fall back to email MFA. Display: "SMS unavailable. A verification code has been sent to your email."
3. **No alternative methods enrolled and SMS fails**: MFA fails with a clear error: "Unable to send verification code. Please contact your administrator."

All fallback events are logged to the audit trail for admin visibility (user ID, original method, fallback method or failure, timestamp).

### 1. TOTP (Time-Based One-Time Password)

**Priority**: P0 — default MFA method. Compatible with all major authenticator apps.

**Crate**: `totp-rs` v5.7 (MIT) — RFC 6238 compliant, built-in QR code generation.

**Parameters**: SHA1, 6 digits, 30-second period, ±1 step skew tolerance. (SHA1 is the standard for TOTP compatibility — all authenticator apps expect it.)

**Enrollment flow**:

1. User navigates to Settings > Security > Enable MFA
2. `POST /api/auth/mfa/totp/setup` → generates 160-bit secret (base32), `otpauth://` URI, QR code (base64 PNG)
3. Secret stored encrypted in `user_mfa` with `status = 'pending_verification'`
4. User scans QR with authenticator app
5. User enters 6-digit code from app
6. `POST /api/auth/mfa/totp/verify-setup` validates code against secret
7. If valid: `status = 'active'`, generate 8 recovery codes (stored hashed)
8. Display recovery codes (one-time display, user must save them)

**Verification during login**: User enters 6-digit code. I/O validates against stored secret with ±1 step tolerance (handles clock skew).

### 2. Duo Security

**Priority**: P1 — many enterprises already have Duo.

**Integration**: Duo Web SDK v4 / Universal Prompt via OIDC Auth API. No Rust SDK — direct HTTP calls with `reqwest`.

**Flow**:

1. Primary auth succeeds, MFA required, Duo selected
2. I/O generates JWT signed with Duo client secret containing user info
3. Redirect to `https://api-{host}.duosecurity.com/oauth/v1/authorize`
4. Duo displays Universal Prompt (hosted by Duo — push notification, TOTP, phone call)
5. User completes Duo challenge
6. Duo redirects to I/O callback with authorization code
7. I/O exchanges code for Duo ID token at Duo token endpoint
8. I/O validates Duo response, completes login

**Configuration**:

| Field | Description |
|-------|-------------|
| `api_hostname` | Duo API hostname (e.g., `api-XXXXXXXX.duosecurity.com`) |
| `client_id` | Duo application client ID |
| `client_secret` | Duo application client secret (encrypted at rest) |
| `redirect_uri` | I/O callback URL for Duo |

**Health check**: Before redirecting, I/O calls Duo's health check endpoint. If Duo is down, fall back to TOTP or allow bypass (admin-configurable).

**Note**: Duo's OIDC Auth API is not fully OIDC-compliant (no Discovery, no JWKS, no UserInfo). Handle these deviations explicitly.

### 3. SMS MFA

**Priority**: P2 — admin-disablable fallback for users who refuse authenticator apps.

**Implementation**: Generate random 6-digit code, store hashed with 5-minute TTL, send via the `io-sms` crate compiled directly into the Auth Service. No runtime dependency on the Alert Service for MFA delivery. Same Twilio credentials from environment variables.

**Security warning displayed in admin UI**: "SMS MFA is vulnerable to SIM swapping and SS7 interception attacks. NIST recommends against SMS as a sole authenticator. Use TOTP or Duo as primary MFA methods."

**Admin controls**: Disabled by default. Must be explicitly enabled per-role. Cannot be the sole allowed MFA method — must be alongside TOTP or Duo.

### 4. Email MFA

**Priority**: P2 — same as SMS, admin-disablable fallback.

**Implementation**: Generate random 6-digit code, store hashed with 5-minute TTL, send via Email Service (doc 28).

**Security warning**: "Email MFA is only as secure as the user's email account. If the email account is compromised, MFA is bypassed."

**Admin controls**: Same as SMS — disabled by default, per-role enable, cannot be sole method.

### 5. Recovery Codes

Generated during TOTP enrollment. 8 alphanumeric codes (`XXXX-XXXX-XXXX` format). Each code is single-use. Stored as Argon2id hashes in `mfa_recovery_codes` table.

If a user loses their authenticator device, they enter a recovery code instead of a TOTP code. After using a recovery code, they're prompted to re-enroll TOTP.

Admin can reset a user's MFA enrollment (clears TOTP secret and recovery codes, forces re-enrollment on next login).

### Passkeys / WebAuthn — Not Supported

I/O does not implement native passkey/WebAuthn support. Passkeys are impractical for the target industrial environment:
- **Shared workstations** — passkeys bind to device, not user
- **Gloved operation** — fingerprint/Face ID don't work with PPE
- **No personal device ecosystem** — shared control room workstations don't have personal iCloud/Google accounts for synced passkeys

Organizations wanting passwordless auth should configure it in their IdP (Azure AD, Okta) and SSO into I/O via OIDC/SAML. I/O receives a valid assertion regardless of whether the IdP used password, passkey, or biometric.

---

## MFA Policy Model

### Per-Role Policies

```sql
CREATE TABLE mfa_policies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id             UUID REFERENCES roles(id) UNIQUE,  -- NULL = system default
    mfa_required        BOOLEAN NOT NULL DEFAULT false,
    allowed_methods     TEXT[] NOT NULL DEFAULT '{}',  -- {'totp', 'duo', 'sms', 'email'}
    required_method     TEXT,                           -- NULL = any allowed method
    grace_period_hours  INT NOT NULL DEFAULT 0,
    max_failures        SMALLINT NOT NULL DEFAULT 5,
    lockout_duration_minutes INT NOT NULL DEFAULT 30,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Default Policy Examples

| Role | MFA Required | Allowed Methods | Grace Period |
|------|-------------|-----------------|--------------|
| Admin | Yes | TOTP, Duo | 0 (immediate) |
| Supervisor | Yes | TOTP, Duo, SMS | 72 hours |
| Operator | Configurable | TOTP, Duo, SMS, Email | 168 hours (1 week) |

### Grace Period Enforcement

1. MFA policy applied to user's role (or user first assigned to role with MFA requirement)
2. `mfa_enrollment_deadline` calculated: `now() + grace_period_hours`
3. During grace period: user can log in without MFA, sees persistent banner: "MFA required by {deadline}. Set up now."
4. After deadline: login blocked until MFA is enrolled
5. Admin can extend grace period per-user or reset deadline

### Per-User Overrides

Beyond role-level policy:
- **Force MFA**: Require MFA for specific user regardless of role policy
- **Exempt**: Temporarily exempt specific user from MFA (audit-logged, with expiry)
- **Reset**: Clear user's TOTP secret and recovery codes, force re-enrollment
- **View status**: MFA enrollment status, method, last used timestamp

### Service Accounts

Service accounts (`users.is_service_account = true`) bypass MFA entirely. They authenticate via long-lived API keys:

```sql
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    name            VARCHAR(100) NOT NULL,
    key_hash        VARCHAR(255) NOT NULL,  -- Argon2id hash of the API key
    key_prefix      VARCHAR(10) NOT NULL,   -- First 8 chars for identification (e.g., "io_sk_a3b")
    scopes          TEXT[],                 -- optional permission restrictions
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id)
);
```

API keys are sent via `Authorization: Bearer io_sk_...` header. The `io_sk_` prefix distinguishes API keys from JWT tokens in the auth middleware.

---

## Database Schema Changes

### Users Table Modifications

```sql
-- Make password_hash nullable (external auth users have no local password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add auth provider tracking
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';
  -- CHECK (auth_provider IN ('local', 'oidc', 'saml', 'ldap'))
ALTER TABLE users ADD COLUMN auth_provider_config_id UUID REFERENCES auth_provider_configs(id);
ALTER TABLE users ADD COLUMN auth_provider_user_id TEXT;
  -- OIDC: sub claim, SAML: NameID, LDAP: DN or sAMAccountName
ALTER TABLE users ADD COLUMN external_id TEXT;
  -- SCIM externalId for provisioning
ALTER TABLE users ADD COLUMN is_service_account BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN is_emergency_account BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN is_kiosk BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN mfa_enrollment_deadline TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN max_sessions SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE users ADD COLUMN role_source VARCHAR(20) NOT NULL DEFAULT 'manual';
  -- 'manual', 'idp', 'scim' — tracks how this user's roles are primarily managed

-- Unique constraint: one external identity per provider config
CREATE UNIQUE INDEX idx_users_external_identity
    ON users (auth_provider, auth_provider_config_id, auth_provider_user_id)
    WHERE auth_provider != 'local';
```

### New Tables

```sql
-- Auth provider configurations (see Provider Configuration Model above)
-- CREATE TABLE auth_provider_configs ... (defined above)

-- MFA enrollment per user
CREATE TABLE user_mfa (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    mfa_type    VARCHAR(20) NOT NULL,   -- 'totp', 'duo'
    secret      TEXT,                    -- encrypted TOTP secret (NULL for Duo)
    status      VARCHAR(20) NOT NULL DEFAULT 'pending_verification',
                -- 'pending_verification', 'active', 'disabled'
    verified_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, mfa_type)
);

-- MFA recovery codes
CREATE TABLE mfa_recovery_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    code_hash   VARCHAR(255) NOT NULL,  -- Argon2id hash
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mfa_recovery_codes_user ON mfa_recovery_codes (user_id) WHERE used_at IS NULL;

-- MFA policies (see MFA Policy Model above)
-- CREATE TABLE mfa_policies ... (defined above)

-- API keys for service accounts (see Service Accounts above)
-- CREATE TABLE api_keys ... (defined above)

-- OIDC/SAML state storage (short-lived, for in-flight auth flows)
CREATE TABLE auth_flow_state (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type   VARCHAR(20) NOT NULL,
    state_token     VARCHAR(255) NOT NULL UNIQUE,
    nonce           VARCHAR(255),
    code_verifier   VARCHAR(255),       -- PKCE (OIDC only)
    relay_state     TEXT,               -- SAML RelayState
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_flow_state_token ON auth_flow_state (state_token);
CREATE INDEX idx_auth_flow_state_expiry ON auth_flow_state (expires_at);

-- IdP group-to-role mapping (see IdP Role Mapping section above)
-- CREATE TABLE idp_role_mappings ... (defined above)

-- Session tracking for concurrent session limits
CREATE TABLE active_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    is_kiosk        BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_active_sessions_user ON active_sessions (user_id);
CREATE INDEX idx_active_sessions_expiry ON active_sessions (expires_at);

-- SCIM bearer tokens
CREATE TABLE scim_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    token_hash  VARCHAR(255) NOT NULL,
    token_prefix VARCHAR(10) NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES users(id)
);
```

---

## API Endpoints

### Auth Flow Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/providers` | None | List enabled auth providers (for login page rendering) |
| `POST` | `/api/auth/login` | None | Local auth (username/password) |
| `POST` | `/api/auth/refresh` | Refresh cookie | Refresh access token |
| `POST` | `/api/auth/logout` | JWT | Invalidate refresh token |

### OIDC Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/oidc/:config_id/login` | None | Redirect to OIDC IdP |
| `GET` | `/api/auth/oidc/callback` | None | Handle IdP callback, exchange code |

### SAML Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/saml/:config_id/login` | None | Generate AuthnRequest, redirect to IdP |
| `POST` | `/api/auth/saml/acs` | None | Assertion Consumer Service (receive response) |
| `GET` | `/api/auth/saml/metadata` | None | Serve SP metadata XML |
| `POST` | `/api/auth/saml/slo` | None | Single Logout endpoint |

### MFA Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/mfa/verify` | MFA token | Verify MFA code and complete login |
| `POST` | `/api/auth/mfa/totp/setup` | JWT | Begin TOTP enrollment (returns QR code) |
| `POST` | `/api/auth/mfa/totp/verify-setup` | JWT | Confirm TOTP setup with code |
| `DELETE` | `/api/auth/mfa/totp` | JWT | Disable TOTP (requires current code or admin) |
| `GET` | `/api/auth/mfa/recovery-codes` | JWT | View recovery codes (only during enrollment) |
| `POST` | `/api/auth/mfa/recovery-codes/regenerate` | JWT | Regenerate recovery codes |
| `GET` | `/api/auth/mfa/duo/:config_id/login` | MFA token | Redirect to Duo Universal Prompt |
| `GET` | `/api/auth/mfa/duo/callback` | None | Handle Duo callback |

### Auth Provider Admin Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/auth/admin/providers` | `auth:configure` | List all provider configs |
| `GET` | `/api/auth/admin/providers/:id` | `auth:configure` | Get provider config (secrets masked) |
| `POST` | `/api/auth/admin/providers` | `auth:configure` | Create provider config |
| `PUT` | `/api/auth/admin/providers/:id` | `auth:configure` | Update provider config |
| `DELETE` | `/api/auth/admin/providers/:id` | `auth:configure` | Delete provider config |
| `POST` | `/api/auth/admin/providers/:id/test` | `auth:configure` | Test provider connectivity |

### MFA Policy Admin Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/auth/admin/mfa/policies` | `auth:manage_mfa` | List MFA policies |
| `PUT` | `/api/auth/admin/mfa/policies/:role_id` | `auth:manage_mfa` | Set MFA policy for role |
| `DELETE` | `/api/auth/admin/mfa/policies/:role_id` | `auth:manage_mfa` | Remove role MFA policy |
| `GET` | `/api/auth/admin/mfa/users` | `auth:manage_mfa` | List users' MFA status |
| `POST` | `/api/auth/admin/mfa/users/:id/reset` | `auth:manage_mfa` | Reset user's MFA enrollment |
| `POST` | `/api/auth/admin/mfa/users/:id/exempt` | `auth:manage_mfa` | Temporarily exempt user from MFA |

### API Key Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/auth/api-keys` | `auth:manage_api_keys` | List API keys for service accounts |
| `POST` | `/api/auth/api-keys` | `auth:manage_api_keys` | Create API key (returns key once) |
| `DELETE` | `/api/auth/api-keys/:id` | `auth:manage_api_keys` | Revoke API key |

### SCIM Endpoints

See SCIM 2.0 Provisioning section above. Served at `/scim/v2/` prefix, authenticated via SCIM bearer token.

### SCIM Token Admin Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/auth/admin/scim/tokens` | `auth:configure` | List SCIM tokens |
| `POST` | `/api/auth/admin/scim/tokens` | `auth:configure` | Generate SCIM token (returns token once) |
| `DELETE` | `/api/auth/admin/scim/tokens/:id` | `auth:configure` | Revoke SCIM token |

### WebSocket Ticket Endpoint

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/ws-ticket` | JWT | Generate single-use WebSocket connection ticket |

**Purpose**: WebSocket connections cannot carry JWT headers. Instead, the client obtains a short-lived ticket via this endpoint and passes it as a query parameter on the WebSocket `Upgrade` request.

**Implementation**:
- Auth Service generates a UUID ticket and stores it in an in-memory `DashMap<String, TicketData>` with 30-second TTL
- `TicketData` contains `user_id`, `roles`, `permissions`, `expires_at`
- Returns `{ "ticket": "uuid-string" }`
- Data Broker validates the ticket via an HTTP call to the Auth Service using a shared service secret: `GET /internal/ws-ticket/{ticket}` (internal endpoint, not exposed via API Gateway)
- Ticket is consumed on validation (single-use) — removed from the `DashMap` immediately
- If the Auth Service restarts, all pending tickets are lost — clients simply request a new one (they're already reconnecting since WebSocket connections would have dropped too)

**Periodic cleanup**: A Tokio background task sweeps expired tickets from the `DashMap` every 30 seconds.

---

## RBAC Permissions

| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `auth:configure` | Configure auth providers, SCIM tokens | Admin |
| `auth:manage_mfa` | Manage MFA policies, reset user MFA, view MFA status | Admin |
| `auth:manage_api_keys` | Create/revoke API keys for service accounts | Admin |

Total: **3 new permissions** (bringing system total to 87).

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

Note: User-facing MFA operations (setup, verify) use the user's own JWT — no special permission needed to manage your own MFA. Admin operations (reset another user's MFA, configure policies) require `auth:manage_mfa`.

---

## Background Maintenance Tasks

### Auth Flow State Cleanup

The `auth_flow_state` table stores transient OIDC/SAML state records with a 5-minute TTL. A background task in the Auth Service runs every 5 minutes:

```sql
DELETE FROM auth_flow_state WHERE expires_at < NOW();
```

### WebSocket Ticket Eviction

WebSocket tickets are stored in an in-memory `DashMap` with 30-second TTL. A Tokio background task sweeps expired entries every 30 seconds. No database involvement — tickets are purely in-memory.

### MFA Code Cleanup

SMS and Email MFA codes are stored hashed with a 5-minute TTL. Expired codes are cleaned up by the same background task that cleans auth flow state.

---

## Settings UI

### Authentication Providers Section

Located in **Settings > Authentication > Providers**.

**Provider list**: Table showing name, type (OIDC/SAML/LDAP), enabled status, JIT provisioning flag, user count, last test result. "Add Provider" button.

**Provider wizard**:
1. Select type (OIDC, SAML, LDAP)
2. Form fields adapt to selected type
3. For OIDC: issuer URL → auto-discover endpoints → enter client ID/secret → configure claims mapping
4. For SAML: upload IdP metadata (URL or XML) → auto-populate SSO URL/cert → download SP metadata
5. For LDAP: enter server URL, bind credentials, search bases, test connection
6. **Group → role mapping editor**: Dedicated table UI for `idp_role_mappings` — IdP group value, match type (exact/prefix/regex), I/O role dropdown, optional site scope, priority, enable/disable toggle
7. "Test Mappings" button — enter IdP groups to see resolved roles without logging in
8. "Test Connection" button
9. Save / Enable

### MFA Configuration Section

Located in **Settings > Authentication > MFA**.

**Global MFA settings**:
- Enable/disable each MFA method (TOTP, Duo, SMS, Email)
- Duo configuration (API hostname, client ID, client secret)
- Security warnings for SMS/Email methods

**Per-role MFA policies**: Table of roles with MFA required toggle, allowed methods checkboxes, grace period input.

**User MFA status**: Filterable table showing all users, their MFA enrollment status, active method, last MFA use, enrollment deadline.

### SCIM Configuration Section

Located in **Settings > Authentication > SCIM**.

- Enable/disable SCIM provisioning
- Generate/revoke SCIM bearer tokens
- SCIM endpoint URL display (for copy-paste into IdP)
- Provisioning log: recent SCIM operations (user created, updated, deactivated)

### Session Management Section

Located in **Settings > Authentication > Sessions**.

- **Max concurrent sessions**: Default 3 (configurable per-user override)
- **Per-role idle timeout**: Table of roles with configurable idle timeout (minutes)
- **Visual lock duration**: Time before a locked session is fully terminated (default: 30 minutes)
- **Hard session timeout**: Maximum session duration regardless of activity (default: 8 hours)
- **Kiosk accounts**: List of users with `is_kiosk = true`, toggle to enable/disable
- **Active sessions**: Table showing all active sessions (user, IP, device, last active, created). Admin can terminate individual sessions.

### Emergency Access Section

Located in **Settings > Authentication > Emergency Access**.

- **Emergency accounts**: List of 2 pre-created accounts, enable/disable toggle (re-enable after use)
- **Password reset**: Generate new split passwords (displays both halves once for printing)
- **Emergency session log**: Audit trail of all emergency account usage
- **io-ctl emergency**: Documentation link for CLI emergency access procedure

### Local Auth Settings

Located in **Settings > Authentication > Local**.

- Enable/disable local auth (warning if disabling: ensure SSO is working first)
- Password policy: minimum length, complexity requirements, history
- Account lockout: max failures, lockout duration
- Session settings: access token lifetime, refresh token lifetime

---

## Technology Stack

### New Crates

| Crate | License | Purpose |
|-------|---------|---------|
| `openidconnect` | MIT/Apache-2.0 | OIDC Relying Party implementation |
| `samael` | MIT | SAML 2.0 Service Provider (C dep on xmlsec1, feature-flagged) |
| `totp-rs` | MIT | TOTP generation/verification with QR codes |
| `qrcode` | MIT/Apache-2.0 | QR code generation (PNG/SVG) |
| `scim_v2` | MIT | SCIM 2.0 data models |
| `deadpool` | MIT/Apache-2.0 | Generic async connection pool (for LDAP) |

### Existing Crates (already in I/O stack)

| Crate | Purpose |
|-------|---------|
| `ldap3` | LDAP/AD client (listed under Universal Import connectors) |
| `oauth2` | OAuth2 client (foundation for openidconnect, also used by Email Service) |
| `jsonwebtoken` | JWT signing/verification |
| `argon2` | Password and recovery code hashing |
| `reqwest` | HTTP client (Duo API, OIDC token exchange) |

### Deferred Crate

| Crate | License | Purpose |
|-------|---------|---------|
| ~~`webauthn-rs`~~ | ~~MPL-2.0~~ | ~~Removed — passkeys not supported (impractical for industrial environment; use IdP SSO instead)~~ |

---

## Deployment Considerations

### SAML Build Dependency

The `samael` crate requires `libxmlsec1-dev` (and transitively `libxml2-dev`, `libxslt1-dev`, `libxmlsec1-openssl-dev`, `libclang-dev`, `pkg-config`) on the build system. These are C libraries. The `openssl` crate is also a hard dependency even without the `xmlsec` feature.

**Options**:
1. Install build dependencies on the CI/build server and include in deployment
2. Feature-flag SAML (`--features saml`) so builds without SAML skip the C dependency
3. Document the requirement in the deployment guide

Recommendation: Feature-flag SAML. Most deployments will use OIDC as primary SSO. SAML is a compatibility layer for ADFS-only environments.

**Future**: The `bergshamra` crate (BSD-2-Clause, pure Rust) may eventually replace the xmlsec1 C dependency for XML signature verification. If/when that integration materializes, the SAML feature flag and C build dependencies become unnecessary. See Section 3 (SAML 2.0) for details.

### IdP Registration

When deploying I/O with SSO, the customer's IT team must register I/O in their IdP:

**For OIDC**: Register I/O as a web application in the IdP. Provide redirect URI: `https://{io-host}/api/auth/oidc/callback`. Receive client ID and client secret.

**For SAML**: Register I/O as a SAML SP. Provide I/O's SP metadata URL: `https://{io-host}/api/auth/saml/metadata`. Configure attribute mapping in the IdP.

**For SCIM**: Configure SCIM provisioning in the IdP. Provide SCIM endpoint: `https://{io-host}/scim/v2/`. Generate and provide bearer token from I/O Settings.

### Environment Variables

```env
# Auth Service (standalone, port 3009)
AUTH_LOCAL_ENABLED=true
AUTH_SESSION_ACCESS_TOKEN_LIFETIME_SEC=900
AUTH_SESSION_REFRESH_TOKEN_LIFETIME_SEC=604800
AUTH_MFA_CODE_TTL_SEC=300
AUTH_MFA_MAX_FAILURES=5
AUTH_MFA_LOCKOUT_DURATION_SEC=1800
AUTH_MAX_SESSIONS_PER_USER=3
AUTH_HARD_SESSION_TIMEOUT_SEC=28800
AUTH_VISUAL_LOCK_TIMEOUT_SEC=1800
```

Auth runs as a standalone service (Auth Service, port 3009). The API Gateway routes auth-related requests (`/api/auth/*`, `/scim/*`) to the Auth Service. JWT validation middleware remains in every service via the shared `io-auth` crate — no network hop for token validation. Only auth flows (login, SSO callbacks, MFA, SCIM, API key management, WebSocket ticket issuance) route to the Auth Service.

---

## Change Log

- **v0.9** — Fixed stale crate name `io-auth-middleware`→`io-auth` in Auth Service architecture description. Removed "shared" qualifier from `io-sms` reference (utility crate, not in canonical 11 shared crates).
- **v0.8** — Updated MFA default policy table: replaced "Power User" with "Supervisor" and "User" with "Operator". Added doc 03 cross-reference note under RBAC permission table.
- **v0.7** — Removed passkeys/WebAuthn from deferred list — permanently not supported. Impractical for industrial environment (shared workstations, gloves, no personal device ecosystem). Organizations use passkeys via their IdP and SSO into I/O. Removed `webauthn-rs` crate reference.
- **v0.6** — Hardened EULA acceptance tracking for legal enforceability. `eula_acceptances` is now fully append-only (DB triggers prevent update/delete) — every acceptance is kept forever, no unique constraint, multiple records per user per version allowed. Added `content_hash` (SHA-256) to both `eula_versions` and `eula_acceptances` for cryptographic proof of what text was shown at acceptance time. Added `username_snapshot` to acceptances for identity permanence. Added `archived_at` and `published_by` to versions. DB triggers prevent deletion or content modification of published versions. Version lifecycle: Draft → Active → Archived with state diagram. Expanded admin endpoints: 9 total (added GET by ID, DELETE draft, CSV export, acceptance summary). Added EULA management UI spec to Doc 15.
- **v0.5** — Added EULA acceptance gate in post-auth convergence flow. Dual-click clickwrap (checkbox + button) between authentication and JWT issuance. EULA pending token (5min, single-use, DashMap storage) bridges auth-to-acceptance. Schema: `eula_versions` (single-active, draft/published lifecycle) and `eula_acceptances` (per-user-per-version audit trail with IP, role, user agent). 3 public/auth endpoints + 9 admin endpoints. Service accounts and emergency accounts bypass EULA check. Admin first-acceptance establishes organizational binding. Re-acceptance triggered on new EULA version publish; existing sessions unaffected.
- **v0.1** — Initial document. Multi-provider authentication (Local, OIDC, SAML, LDAP), SCIM 2.0 provisioning, MFA (TOTP, Duo, SMS, Email), per-role MFA policies, service account API keys, JIT provisioning, passkeys deferred to external IdPs. 3 new RBAC permissions, full schema, API spec, Settings UI.
- **v0.2** — Corrected samael license (MIT, not Apache-2.0). Added bergshamra (BSD-2-Clause) as future pure-Rust XML-DSig replacement path. Expanded SAML build dependency list. Added samael project status (stalled since June 2024).
- **v0.4** — Deep dive: IdP role mapping via dedicated `idp_role_mappings` table (replaces `group_role_mapping` JSONB on `auth_provider_configs`), supporting exact/prefix/regex matching with optional site scope and priority ordering. Provider-specific group extraction (SAML attributes, OIDC claims with Azure overage handling, LDAP recursive `memberOf`, SCIM push-based). 7-rule deterministic conflict resolution. Login sync algorithm with `role_source` tracking (`manual`/`idp`/`scim`). LDAP background sync (hourly, configurable). Session management: 3 concurrent sessions per user (SharedWorker tab dedup), per-role idle timeout with visual lock, 8-hour hard session timeout, kiosk mode (no idle timeout, read-only base). Break-glass emergency access: 2 pre-created emergency accounts with split passwords, `io-ctl emergency` CLI tool, 4-hour max emergency sessions with auto-disable. Added `active_sessions` table, `is_emergency_account`/`is_kiosk`/`max_sessions`/`role_source` columns on users. Added Session Management and Emergency Access settings UI sections. Added session environment variables.
- **v0.3** — Auth promoted to standalone service (Auth Service, port 3009). API Gateway routes `/api/auth/*` and `/scim/*` to Auth Service; JWT validation remains in every service via `io-auth-middleware` crate. SMS MFA now uses shared `io-sms` crate (no Alert Service dependency). Added WebSocket ticket endpoint (`POST /api/auth/ws-ticket`) with in-memory `DashMap` storage and 30s TTL. Added MFA fallback behavior (alternative method prompting, email auto-fallback, clear error on total failure). Added Background Maintenance Tasks section (auth flow state cleanup, WebSocket ticket eviction, MFA code cleanup).
