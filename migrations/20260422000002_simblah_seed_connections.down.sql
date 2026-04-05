-- Rollback: remove all SimBLAH seed data.
-- import_schedules cascade-delete via import_definitions ON DELETE CASCADE.

DELETE FROM import_definitions WHERE name LIKE 'SimBLAH%';
DELETE FROM import_connections WHERE name LIKE 'SimBLAH%';
DELETE FROM access_control_sources WHERE name = 'SimBLAH Access Control';
