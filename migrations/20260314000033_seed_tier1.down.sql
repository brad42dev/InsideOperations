-- Remove seed data (dangerous — only for complete teardown)
DELETE FROM settings WHERE key IN (
    'point_source_stale_threshold_hours', 'point_metadata_refresh_interval_minutes',
    'point_backfill_enabled', 'point_backfill_max_lookback_days',
    'alarm_eval_interval_seconds', 'alarm_shelve_max_duration_hours',
    'alarm_shelve_default_duration_minutes', 'event_retention_days',
    'alarm_chattering_threshold', 'rounds_gps_proximity_meters',
    'rounds_transfer_timeout_seconds', 'rounds_photo_max_size_mb',
    'rounds_video_max_duration_seconds', 'log_auto_create_on_shift_start',
    'forensics_max_correlation_points', 'forensics_max_time_window_days',
    'forensics_result_cache_ttl_seconds', 'tile_auto_regenerate_on_save',
    'tile_max_zoom_level', 'opc.minimum_publish_interval_ms',
    'backup_enabled', 'backup_include_uploads',
    'seed_version_tier1', 'seed_version_tier2'
);
DELETE FROM user_roles WHERE user_id = '00000000-0000-0000-0000-000000000002';
DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000002';
DELETE FROM point_sources WHERE id = '00000000-0000-0000-0000-000000000001';
DELETE FROM alert_channels WHERE channel_type IN ('in_app','email','sms','push','webhook','teams','slack');
DELETE FROM data_categories WHERE is_predefined = true;
-- Note: role_permissions and roles removed via cascade when roles deleted
DELETE FROM roles WHERE is_predefined = true;
DELETE FROM permissions;
