-- Revert point bindings for test log template segments back to empty arrays.

UPDATE log_segments
SET
    content_config = '{"point_ids": []}'::jsonb,
    updated_at = NOW()
WHERE id = '94af46ac-837a-49d7-b6e7-7672d70ee7a9'
  AND segment_type = 'point_data';

UPDATE log_segments
SET
    content_config = '{"point_ids": []}'::jsonb,
    updated_at = NOW()
WHERE id = '8f364912-f888-4302-ae24-c8182ec4f5ac'
  AND segment_type = 'point_data';
