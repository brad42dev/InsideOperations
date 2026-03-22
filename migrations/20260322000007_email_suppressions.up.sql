-- Email bounce suppression list
-- Hard bounces (5xx SMTP, permanent Graph/SES errors) auto-add recipients here.
-- Queue worker checks this table before every send attempt.

CREATE TABLE email_suppressions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_address          VARCHAR(254) NOT NULL UNIQUE,
    reason                 TEXT NOT NULL,
    suppressed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_delivery_id UUID REFERENCES email_delivery_log(id)
);

CREATE INDEX idx_email_suppressions_address ON email_suppressions (email_address);
