-- SMS provider configuration (Twilio + generic webhook)
CREATE TABLE sms_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    provider_type   VARCHAR(20) NOT NULL DEFAULT 'twilio'
                        CHECK (provider_type IN ('twilio', 'webhook')),
    enabled         BOOLEAN NOT NULL DEFAULT false,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    config          JSONB NOT NULL DEFAULT '{}',
    -- For Twilio: config has account_sid, auth_token, from_number
    -- For webhook: config has url, headers (optional)
    last_tested_at  TIMESTAMPTZ,
    last_test_ok    BOOLEAN,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SMS OTP codes for MFA (if not already created by another migration)
CREATE TABLE IF NOT EXISTS sms_mfa_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(30) NOT NULL,
    code_hash   VARCHAR(128) NOT NULL,
    purpose     VARCHAR(20) NOT NULL DEFAULT 'login',
    used        BOOLEAN NOT NULL DEFAULT false,
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_mfa_codes_user ON sms_mfa_codes (user_id, purpose, used, expires_at);

-- Add phone_number column to users if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone_number') THEN
        ALTER TABLE users ADD COLUMN phone_number VARCHAR(30);
    END IF;
END$$;
