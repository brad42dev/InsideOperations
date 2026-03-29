-- OPC-imported points were created with aggregation_types = 0, blocking avg/sum.
-- All SimBLAH/OPC analog measurements are numeric and safe to average.
-- Set bit 0 (avg) and bit 1 (sum) for every point that has none set.
UPDATE points_metadata
SET aggregation_types = 3
WHERE aggregation_types = 0;
