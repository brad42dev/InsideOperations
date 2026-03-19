-- EULA v2 — Two-document system: installer (org) + end_user (individual)
-- Adds eula_type, per-type unique-active constraints, enriched acceptance
-- records with chained tamper-evident hashes, and installer EULA admin
-- acceptance tracking in the settings table.

-- ---------------------------------------------------------------------------
-- 1. eula_versions — add eula_type
-- ---------------------------------------------------------------------------

ALTER TABLE eula_versions
    ADD COLUMN eula_type TEXT NOT NULL DEFAULT 'end_user'
        CHECK (eula_type IN ('installer', 'end_user'));

-- Drop old single-version-unique and single-active-unique constraints;
-- replace with per-type variants.
DROP INDEX idx_eula_versions_active;
ALTER TABLE eula_versions DROP CONSTRAINT eula_versions_version_key;

-- One active version per eula_type
CREATE UNIQUE INDEX idx_eula_versions_active_per_type
    ON eula_versions (eula_type) WHERE is_active = true;

-- Unique (eula_type, version) — allows installer-1.0 and end_user-1.0 to coexist
CREATE UNIQUE INDEX idx_eula_versions_type_version
    ON eula_versions (eula_type, version);

-- ---------------------------------------------------------------------------
-- 2. eula_acceptances — enriched integrity + context fields
-- ---------------------------------------------------------------------------

ALTER TABLE eula_acceptances
    -- Issued to the user as a receipt reference; also useful for email receipts
    ADD COLUMN receipt_token UUID NOT NULL DEFAULT gen_random_uuid(),

    -- Where in the flow this acceptance was recorded
    ADD COLUMN acceptance_context TEXT NOT NULL DEFAULT 'login'
        CHECK (acceptance_context IN (
            'installer',        -- CLI acceptance during package installation
            'installer_admin',  -- First admin web-UI acceptance post-install
            'login',            -- Regular user first login / re-acceptance
            'version_update'    -- Subsequent acceptance after new version published
        )),

    -- Denormalised copies so records remain readable if user account is later
    -- renamed, deleted, or email changes — legal audit trail requirement
    ADD COLUMN user_email_snapshot TEXT NOT NULL DEFAULT '',
    ADD COLUMN user_display_name_snapshot TEXT NOT NULL DEFAULT '',

    -- Tamper-evident chained hash (NIST SP 800-92 pattern)
    -- previous_hash: row_hash of the preceding acceptance record (NULL for first)
    ADD COLUMN previous_hash VARCHAR(64),
    -- row_hash: SHA-256 of all key fields of THIS row (computed in application)
    ADD COLUMN row_hash VARCHAR(64);

CREATE UNIQUE INDEX idx_eula_acceptances_receipt
    ON eula_acceptances (receipt_token);

-- ---------------------------------------------------------------------------
-- 3. Track which installer EULA version an admin has accepted post-install
-- ---------------------------------------------------------------------------
-- Stored as a JSON string: ""  = no admin has accepted the current installer EULA
--                           "1.0" = admin accepted installer v1.0

INSERT INTO settings (key, value, description, is_public)
VALUES (
    'installer_eula_admin_accepted_version',
    '""',
    'Version of the installer EULA last accepted by a system administrator '
    'via the post-install login screen. Reset to empty string whenever a new '
    'installer EULA version is published.',
    false
)
ON CONFLICT (key) DO NOTHING;
