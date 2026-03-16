-- Reverse Phase 15: drop all Shifts / Access Control tables and columns

DROP TABLE IF EXISTS muster_accounting;
DROP TABLE IF EXISTS muster_events;
DROP TABLE IF EXISTS muster_points;
DROP TABLE IF EXISTS shift_assignments;
DROP TABLE IF EXISTS shifts;
DROP TABLE IF EXISTS shift_crew_members;
DROP TABLE IF EXISTS shift_crews;
DROP TABLE IF EXISTS shift_patterns;
DROP TABLE IF EXISTS presence_status;
DROP TABLE IF EXISTS badge_events;
DROP TABLE IF EXISTS access_control_sources;

ALTER TABLE users DROP COLUMN IF EXISTS employee_id;
