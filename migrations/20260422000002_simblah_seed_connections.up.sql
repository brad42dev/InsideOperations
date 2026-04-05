-- Phase 4: SimBLAH integration seed data
-- Creates the access_control_sources row, 6 import_connections, 12 import_definitions,
-- and 12 import_schedules (7 interval + 5 stream_session) required for SimBLAH data ingestion.

-- ============================================================
-- Step 1: Access Control Source
-- ============================================================

INSERT INTO access_control_sources (id, name, adapter_type, enabled, config, poll_interval_s)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'SimBLAH Access Control',
    'generic_db',
    true,
    '{"type": "sse_import", "notes": "Managed by Universal Import SSE connector"}'::jsonb,
    0
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Step 2: Import Connections (6)
-- ============================================================

-- Maintenance REST
INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
SELECT
    'c0000000-0000-0000-0001-000000000001'::uuid,
    'SimBLAH Maintenance REST',
    'generic_rest',
    '{"base_url": "https://maint.simblah.in-ops.com:8444"}'::jsonb,
    'bearer_token',
    '{"bearer_token": ""}'::jsonb,
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- Maintenance SSE
INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
SELECT
    'c0000000-0000-0000-0001-000000000002'::uuid,
    'SimBLAH Maintenance SSE',
    'sse',
    '{"base_url": "https://maint.simblah.in-ops.com:8444"}'::jsonb,
    'bearer_token',
    '{"bearer_token": ""}'::jsonb,
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- Accounting REST
INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
SELECT
    'c0000000-0000-0000-0001-000000000003'::uuid,
    'SimBLAH Accounting REST',
    'generic_rest',
    '{"base_url": "https://acct.simblah.in-ops.com:8445"}'::jsonb,
    'bearer_token',
    '{"bearer_token": ""}'::jsonb,
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- Accounting SSE
INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
SELECT
    'c0000000-0000-0000-0001-000000000004'::uuid,
    'SimBLAH Accounting SSE',
    'sse',
    '{"base_url": "https://acct.simblah.in-ops.com:8445"}'::jsonb,
    'bearer_token',
    '{"bearer_token": ""}'::jsonb,
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- Access Control REST
INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
SELECT
    'c0000000-0000-0000-0001-000000000005'::uuid,
    'SimBLAH Access Control REST',
    'generic_rest',
    '{"base_url": "https://access.simblah.in-ops.com:8446"}'::jsonb,
    'bearer_token',
    '{"bearer_token": ""}'::jsonb,
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- Access Control SSE
INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
SELECT
    'c0000000-0000-0000-0001-000000000006'::uuid,
    'SimBLAH Access Control SSE',
    'sse',
    '{"base_url": "https://access.simblah.in-ops.com:8446"}'::jsonb,
    'bearer_token',
    '{"bearer_token": ""}'::jsonb,
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================================
-- Step 3: Import Definitions (12)
-- ============================================================

-- 001: SimBLAH Tickets (REST → tickets)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000001'::uuid,
    'c0000000-0000-0000-0001-000000000001'::uuid,
    'SimBLAH Tickets',
    '{"endpoint": "/api/tickets", "pagination_type": "offset_limit", "page_size": 100, "source_system": "simblah_maint", "id_field": "id"}'::jsonb,
    '[{"source": "id", "target": "external_id"}, {"source": "subject", "target": "title"}, {"source": "description", "target": "description"}, {"source": "status", "target": "status"}, {"source": "priority", "target": "priority"}, {"source": "assigned_to_name", "target": "assigned_to"}, {"source": "date_closed", "target": "closed_at"}]'::jsonb,
    '[]'::jsonb,
    'tickets',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- 002: SimBLAH Work Orders (REST → work_orders)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000002'::uuid,
    'c0000000-0000-0000-0001-000000000001'::uuid,
    'SimBLAH Work Orders',
    '{"endpoint": "/api/workorders", "pagination_type": "offset_limit", "page_size": 100, "source_system": "simblah_maint", "id_field": "id"}'::jsonb,
    '[{"source": "id", "target": "external_id"}, {"source": "subject", "target": "title"}, {"source": "description", "target": "description"}, {"source": "status", "target": "status"}, {"source": "assigned_to_name", "target": "assigned_to"}, {"source": "date_opened", "target": "scheduled_start"}, {"source": "due_date", "target": "scheduled_end"}, {"source": "date_completed", "target": "actual_end"}]'::jsonb,
    '[]'::jsonb,
    'work_orders',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- 003: SimBLAH Tickets SSE (SSE → tickets)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000003'::uuid,
    'c0000000-0000-0000-0001-000000000002'::uuid,
    'SimBLAH Tickets SSE',
    '{"endpoint": "/api/events/stream", "event_kind_filter": "ticket", "source_system": "simblah_maint", "id_field": "id"}'::jsonb,
    '[{"source": "id", "target": "external_id"}, {"source": "subject", "target": "title"}, {"source": "description", "target": "description"}, {"source": "status", "target": "status"}, {"source": "priority", "target": "priority"}, {"source": "assigned_to_name", "target": "assigned_to"}, {"source": "date_closed", "target": "closed_at"}]'::jsonb,
    '[]'::jsonb,
    'tickets',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- 004: SimBLAH Work Orders SSE (SSE → work_orders)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000004'::uuid,
    'c0000000-0000-0000-0001-000000000002'::uuid,
    'SimBLAH Work Orders SSE',
    '{"endpoint": "/api/events/stream", "event_kind_filter": "work_order", "source_system": "simblah_maint", "id_field": "id"}'::jsonb,
    '[{"source": "id", "target": "external_id"}, {"source": "subject", "target": "title"}, {"source": "description", "target": "description"}, {"source": "status", "target": "status"}, {"source": "assigned_to_name", "target": "assigned_to"}, {"source": "date_opened", "target": "scheduled_start"}, {"source": "due_date", "target": "scheduled_end"}, {"source": "date_completed", "target": "actual_end"}]'::jsonb,
    '[]'::jsonb,
    'work_orders',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- 005: SimBLAH Purchase Orders (REST → purchase_orders)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000005'::uuid,
    'c0000000-0000-0000-0001-000000000003'::uuid,
    'SimBLAH Purchase Orders',
    '{"endpoint": "/api/purchase-orders", "pagination_type": "offset_limit", "page_size": 100, "source_system": "simblah_acct", "id_field": "id"}'::jsonb,
    '[{"source": "id", "target": "external_id"}, {"source": "id", "target": "po_number"}, {"source": "vendor_name", "target": "vendor_name"}, {"source": "status", "target": "status"}, {"source": "date_opened", "target": "order_date"}, {"source": "total_cost", "target": "total_amount"}]'::jsonb,
    '[{"op": "value_map", "field": "status", "map": {"open": "approved", "fulfilled": "received", "cancelled": "cancelled"}, "default": "approved"}]'::jsonb,
    'purchase_orders',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- 006: SimBLAH Inventory (REST → inventory_items)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000006'::uuid,
    'c0000000-0000-0000-0001-000000000003'::uuid,
    'SimBLAH Inventory',
    '{"endpoint": "/api/inventory", "pagination_type": "offset_limit", "page_size": 100, "source_system": "simblah_acct", "id_field": "id"}'::jsonb,
    '[{"source": "id", "target": "external_id"}, {"source": "part_number", "target": "part_number"}, {"source": "description", "target": "description"}, {"source": "total_stock", "target": "quantity_on_hand"}]'::jsonb,
    '[]'::jsonb,
    'inventory_items',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- 007: SimBLAH Vendors (REST → vendor_master)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000007'::uuid,
    'c0000000-0000-0000-0001-000000000003'::uuid,
    'SimBLAH Vendors',
    '{"endpoint": "/api/vendors", "pagination_type": "none", "source_system": "simblah_acct", "id_field": "id"}'::jsonb,
    '[{"source": "id", "target": "external_id"}, {"source": "name", "target": "name"}, {"source": "name", "target": "vendor_code"}]'::jsonb,
    '[]'::jsonb,
    'vendor_master',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- 008: SimBLAH PO Updates SSE (SSE → purchase_orders)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000008'::uuid,
    'c0000000-0000-0000-0001-000000000004'::uuid,
    'SimBLAH PO Updates SSE',
    '{"endpoint": "/api/events/stream", "event_kind_filter": "purchase_order", "source_system": "simblah_acct", "id_field": "id"}'::jsonb,
    '[{"source": "id", "target": "external_id"}, {"source": "id", "target": "po_number"}, {"source": "vendor_name", "target": "vendor_name"}, {"source": "status", "target": "status"}, {"source": "date_opened", "target": "order_date"}, {"source": "total_cost", "target": "total_amount"}]'::jsonb,
    '[{"op": "value_map", "field": "status", "map": {"open": "approved", "fulfilled": "received", "cancelled": "cancelled"}, "default": "approved"}]'::jsonb,
    'purchase_orders',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- 009: SimBLAH Stock Updates SSE (SSE → inventory_items, stock_movement event shape)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000009'::uuid,
    'c0000000-0000-0000-0001-000000000004'::uuid,
    'SimBLAH Stock Updates SSE',
    '{"endpoint": "/api/events/stream", "event_kind_filter": "stock_movement", "source_system": "simblah_acct", "id_field": "id"}'::jsonb,
    '[{"source": "part_number", "target": "part_number"}, {"source": "description", "target": "description"}, {"source": "quantity_after", "target": "quantity_on_hand"}]'::jsonb,
    '[]'::jsonb,
    'inventory_items',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- 010: SimBLAH Employees (REST → custom_import_data, no field mappings needed)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000010'::uuid,
    'c0000000-0000-0000-0001-000000000005'::uuid,
    'SimBLAH Employees',
    '{"endpoint": "/api/employees", "pagination_type": "offset_limit", "page_size": 100, "source_system": "simblah_access", "id_field": "id"}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'custom_import_data',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- 011: SimBLAH Badge Events (REST → badge_events)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000011'::uuid,
    'c0000000-0000-0000-0001-000000000005'::uuid,
    'SimBLAH Badge Events',
    '{"endpoint": "/api/events", "pagination_type": "offset_limit", "page_size": 100, "source_system": "simblah_access", "id_field": "id", "source_id": "a0000000-0000-0000-0000-000000000001"}'::jsonb,
    '[{"source": "event_type", "target": "event_type"}, {"source": "employee_id", "target": "employee_id"}, {"source": "reader_id", "target": "door_id"}, {"source": "event_time", "target": "event_time"}]'::jsonb,
    '[]'::jsonb,
    'badge_events',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- 012: SimBLAH Badge Events SSE (SSE → badge_events)
INSERT INTO import_definitions (id, connection_id, name, source_config, field_mappings, transforms, target_table, enabled, created_by)
SELECT
    'd0000000-0000-0000-0001-000000000012'::uuid,
    'c0000000-0000-0000-0001-000000000006'::uuid,
    'SimBLAH Badge Events SSE',
    '{"endpoint": "/api/events/stream", "source_system": "simblah_access", "id_field": "id", "source_id": "a0000000-0000-0000-0000-000000000001"}'::jsonb,
    '[{"source": "event_type", "target": "event_type"}, {"source": "employee_id", "target": "employee_id"}, {"source": "reader_id", "target": "door_id"}, {"source": "reader_string_id", "target": "door_name"}, {"source": "reader_description", "target": "area"}, {"source": "event_time", "target": "event_time"}]'::jsonb,
    '[]'::jsonb,
    'badge_events',
    true,
    id
FROM users WHERE username = 'admin' LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================================
-- Step 4: Import Schedules (12)
-- 7 interval (REST defs: 001, 002, 005, 006, 007, 010, 011)
-- 5 stream_session (SSE defs: 003, 004, 008, 009, 012)
-- ============================================================

-- Interval schedules (300 seconds / 5 minutes)
INSERT INTO import_schedules (id, definition_id, schedule_type, interval_seconds, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000001'::uuid, 'd0000000-0000-0000-0001-000000000001'::uuid, 'interval', 300, '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO import_schedules (id, definition_id, schedule_type, interval_seconds, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000002'::uuid, 'd0000000-0000-0000-0001-000000000002'::uuid, 'interval', 300, '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO import_schedules (id, definition_id, schedule_type, interval_seconds, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000005'::uuid, 'd0000000-0000-0000-0001-000000000005'::uuid, 'interval', 300, '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO import_schedules (id, definition_id, schedule_type, interval_seconds, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000006'::uuid, 'd0000000-0000-0000-0001-000000000006'::uuid, 'interval', 300, '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO import_schedules (id, definition_id, schedule_type, interval_seconds, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000007'::uuid, 'd0000000-0000-0000-0001-000000000007'::uuid, 'interval', 300, '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO import_schedules (id, definition_id, schedule_type, interval_seconds, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000010'::uuid, 'd0000000-0000-0000-0001-000000000010'::uuid, 'interval', 300, '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO import_schedules (id, definition_id, schedule_type, interval_seconds, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000011'::uuid, 'd0000000-0000-0000-0001-000000000011'::uuid, 'interval', 300, '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- Stream session schedules (supervisor manages lifecycle)
INSERT INTO import_schedules (id, definition_id, schedule_type, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000003'::uuid, 'd0000000-0000-0000-0001-000000000003'::uuid, 'stream_session', '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO import_schedules (id, definition_id, schedule_type, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000004'::uuid, 'd0000000-0000-0000-0001-000000000004'::uuid, 'stream_session', '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO import_schedules (id, definition_id, schedule_type, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000008'::uuid, 'd0000000-0000-0000-0001-000000000008'::uuid, 'stream_session', '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO import_schedules (id, definition_id, schedule_type, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000009'::uuid, 'd0000000-0000-0000-0001-000000000009'::uuid, 'stream_session', '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO import_schedules (id, definition_id, schedule_type, schedule_config, enabled)
VALUES ('e0000000-0000-0000-0001-000000000012'::uuid, 'd0000000-0000-0000-0001-000000000012'::uuid, 'stream_session', '{}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;
