-- Email OTP codes for MFA
CREATE TABLE email_mfa_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   VARCHAR(128) NOT NULL,    -- SHA-256 of the 6-digit code
    purpose     VARCHAR(20) NOT NULL DEFAULT 'login'
                    CHECK (purpose IN ('login', 'enroll', 'recovery')),
    used        BOOLEAN NOT NULL DEFAULT false,
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_mfa_codes_user ON email_mfa_codes (user_id, purpose, used, expires_at);
