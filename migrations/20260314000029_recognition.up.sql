-- P&ID / DCS symbol recognition corrections

CREATE TABLE recognition_correction (
    correction_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_hash      VARCHAR(64) NOT NULL,
    correction_type VARCHAR(30) NOT NULL,
    original_data   JSONB,
    corrected_data  JSONB NOT NULL,
    model_version   VARCHAR(20) NOT NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_correction_model ON recognition_correction(model_version);
CREATE INDEX idx_correction_created ON recognition_correction(created_at);
