-- Phase B: Watermark state support + deduplication index

-- 1. Add unique partial index for upsert-based deduplication in custom_import_data.
--    Enables ON CONFLICT (import_definition_id, source_row_id) DO UPDATE
--    when source_row_id is non-null (configured via id_field).
CREATE UNIQUE INDEX IF NOT EXISTS custom_import_data_dedup_idx
    ON custom_import_data (import_definition_id, source_row_id)
    WHERE source_row_id IS NOT NULL;
