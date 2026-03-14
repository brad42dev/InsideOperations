-- Export and bulk update: jobs, snapshots, snapshot rows

CREATE TABLE export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(30) NOT NULL
        CHECK (job_type IN ('data_export', 'bulk_update_template', 'bulk_update_apply')),
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    module VARCHAR(50) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    format VARCHAR(20)
        CHECK (format IN ('csv', 'xlsx', 'pdf', 'json', 'parquet', 'html')),
    filters JSONB DEFAULT '{}',
    columns TEXT[],
    sort_field VARCHAR(100),
    sort_order VARCHAR(4) DEFAULT 'asc'
        CHECK (sort_order IN ('asc', 'desc')),
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    original_filename VARCHAR(255),
    rows_total INTEGER,
    rows_processed INTEGER DEFAULT 0,
    error_message TEXT,
    notify_email BOOLEAN NOT NULL DEFAULT false,
    email_address VARCHAR(255),
    snapshot_id UUID,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE change_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    snapshot_type VARCHAR(20) NOT NULL
        CHECK (snapshot_type IN ('automatic', 'manual')),
    description TEXT,
    row_count INTEGER NOT NULL DEFAULT 0,
    filter_criteria JSONB,
    related_job_id UUID REFERENCES export_jobs(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE change_snapshot_rows (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id UUID NOT NULL REFERENCES change_snapshots(id) ON DELETE CASCADE,
    record_id UUID NOT NULL,
    row_data JSONB NOT NULL
);

-- Add FK from export_jobs.snapshot_id to change_snapshots
ALTER TABLE export_jobs
    ADD CONSTRAINT fk_export_jobs_snapshot
    FOREIGN KEY (snapshot_id) REFERENCES change_snapshots(id) ON DELETE SET NULL;

CREATE TRIGGER trg_export_jobs_updated_at
    BEFORE UPDATE ON export_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
