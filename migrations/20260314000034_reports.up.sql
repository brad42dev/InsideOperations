-- Report templates (created via Designer, browsed/run from Reports module)
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    is_system_template BOOLEAN NOT NULL DEFAULT false,
    -- Template config: widget layout, column definitions, parameter schema
    template_config JSONB NOT NULL DEFAULT '{}',
    -- Default parameters (pre-filled values)
    default_params JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Generated report job tracking
CREATE TABLE IF NOT EXISTS report_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES report_templates(id),
    requested_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    format VARCHAR(10) NOT NULL DEFAULT 'pdf',     -- pdf, csv, xlsx, html, json
    params JSONB NOT NULL DEFAULT '{}',
    file_path TEXT,           -- set when completed
    file_size_bytes BIGINT,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,   -- auto-cleanup after 24h
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_jobs_user ON report_jobs(requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_jobs_status ON report_jobs(status);

-- Scheduled report runs
CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES report_templates(id),
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL, -- standard cron: "0 6 * * 1" = Mon 6am
    format VARCHAR(10) NOT NULL DEFAULT 'pdf',
    params JSONB NOT NULL DEFAULT '{}',
    recipient_user_ids UUID[] NOT NULL DEFAULT '{}',
    recipient_emails TEXT[] NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Export presets (saved parameter combinations)
CREATE TABLE IF NOT EXISTS export_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES report_templates(id),
    name VARCHAR(255) NOT NULL,
    params JSONB NOT NULL DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
