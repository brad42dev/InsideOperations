-- Seed data: sample import connections for UAT/dev — enables right-click context
-- menu testing on /settings/import (Connections tab).
-- Two connections:
--   1. "Sample REST Endpoint" — no definitions — Delete is enabled in context menu
--   2. "Sample Database Source" — has one definition — Delete is grayed in context menu
-- Both use connection_type and auth_type values that pass schema CHECK constraints.

INSERT INTO import_connections (
    id, name, connection_type, config, auth_type, auth_config,
    enabled, last_tested_at, last_test_status, last_test_message,
    created_by
)
VALUES
    (
        '00000000-0000-0000-0001-000000000001',
        'Sample REST Endpoint',
        'rest_api',
        '{"base_url": "https://example.io/api/v1", "timeout_seconds": 30}',
        'api_key',
        '{}',
        true,
        NOW() - INTERVAL '1 hour',
        'ok',
        'Connected successfully (sample seed data)',
        '00000000-0000-0000-0000-000000000002'
    ),
    (
        '00000000-0000-0000-0001-000000000002',
        'Sample Database Source',
        'postgres',
        '{"host": "db.example.io", "port": 5432, "database": "operations", "schema": "public"}',
        'password',
        '{}',
        true,
        NULL,
        NULL,
        NULL,
        '00000000-0000-0000-0000-000000000002'
    )
ON CONFLICT (id) DO NOTHING;

-- Add a definition referencing the database connection so that
-- Delete is grayed for "Sample Database Source" in the context menu.
INSERT INTO import_definitions (
    id, connection_id, name, description,
    source_config, field_mappings, transforms,
    target_table, error_strategy, batch_size,
    enabled, created_by
)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0001-000000000002',
    'Sample Equipment Import',
    'Sample definition — references Sample Database Source to demonstrate delete-graying',
    '{"query": "SELECT * FROM equipment WHERE updated_at > :last_run"}',
    '[]',
    '[]',
    'equipment',
    'quarantine',
    1000,
    true,
    '00000000-0000-0000-0000-000000000002'
)
ON CONFLICT (id) DO NOTHING;
