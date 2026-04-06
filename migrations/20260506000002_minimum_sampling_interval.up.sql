-- Add minimum_sampling_interval_ms to points_metadata.
-- Populated by the OPC service by reading AttributeId 11 (MinimumSamplingInterval)
-- from each Variable node during browse. Null means unknown (treat as 1000 ms).
--
-- Values from SimBLAH:
--   1000   ms — normal process tags (1 Hz simulator)
--   300000 ms — GC analyzer tags (5-minute analysis cycle)
--   3600000 ms — lab/quality analyzer tags (1-hour cycle)
--
-- Used by the frontend to select step/hold-last-value rendering and to set
-- the staleness window: a tag is considered stale only if no update has
-- arrived within 2 × minimum_sampling_interval_ms.
ALTER TABLE points_metadata
    ADD COLUMN IF NOT EXISTS minimum_sampling_interval_ms DOUBLE PRECISION;
