-- Seed point bindings for test log templates so PointDataSegment rows are visible in UAT.
--
-- Root cause: the two seed point_data segments for "Test Log with Points" and
-- "PointContextMenu Test" were created with content_config = {"point_ids": []}
-- (empty array). This caused every instance of those templates to show
-- "No points configured for this segment." making DD-13-018 (PointContextMenu
-- wiring) impossible to verify in UAT.
--
-- Fix: populate point_ids with real points_metadata UUIDs from the standard
-- seed data (22220000-0000-0000-0000-000000000001..3). These are always present
-- in any environment that has run the Tier 1 seed migration.

UPDATE log_segments
SET
    content_config = jsonb_build_object(
        'point_ids', jsonb_build_array(
            '22220000-0000-0000-0000-000000000001'::text,
            '22220000-0000-0000-0000-000000000002'::text,
            '22220000-0000-0000-0000-000000000003'::text
        )
    ),
    updated_at = NOW()
WHERE id = '94af46ac-837a-49d7-b6e7-7672d70ee7a9'
  AND segment_type = 'point_data';

UPDATE log_segments
SET
    content_config = jsonb_build_object(
        'point_ids', jsonb_build_array(
            '22220000-0000-0000-0000-000000000001'::text,
            '22220000-0000-0000-0000-000000000002'::text,
            '22220000-0000-0000-0000-000000000003'::text
        )
    ),
    updated_at = NOW()
WHERE id = '8f364912-f888-4302-ae24-c8182ec4f5ac'
  AND segment_type = 'point_data';
