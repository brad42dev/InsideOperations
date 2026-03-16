-- SCIM bearer tokens (auth for IdP to call our SCIM endpoints)
CREATE TABLE IF NOT EXISTS scim_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    token_hash      VARCHAR(128) NOT NULL UNIQUE,   -- SHA-256 hex of the bearer token
    description     TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id)
);
