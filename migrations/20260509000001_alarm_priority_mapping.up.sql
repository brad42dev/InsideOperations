-- Add configurable alarm priority mapping to OPC UA sources.
-- Stores a JSONB config that overrides the default ISA-18.2 severity→priority
-- range mapping. Null = use built-in defaults (backward-compatible).
--
-- Supported modes (validated in Rust at write time):
--   range           — numeric ranges mapping OPC severity to priority
--   discrete        — exact severity values mapped to priority strings
--   custom_property — read priority from a named OPC alarm event property

ALTER TABLE point_sources
    ADD COLUMN IF NOT EXISTS alarm_priority_mapping JSONB;
