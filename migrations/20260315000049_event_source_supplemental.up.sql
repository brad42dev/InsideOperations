-- Add 'supplemental' to event_source_enum for events coming from DCS supplemental
-- REST connectors (PI Web API, Experion EPDOC, Siemens SPH, WinCC OA, ABB IM, etc.).
-- Previously these were incorrectly written with source = 'opc'.
ALTER TYPE event_source_enum ADD VALUE IF NOT EXISTS 'supplemental';
