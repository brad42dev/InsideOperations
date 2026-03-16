-- =============================================================================
-- Migration DOWN: notifications (Phase 14 — Alerts Module)
-- Drop notification_* tables in reverse dependency order.
-- =============================================================================

DROP TABLE IF EXISTS notification_muster_marks;
DROP TABLE IF EXISTS notification_messages;
DROP TABLE IF EXISTS notification_group_members;
DROP TABLE IF EXISTS notification_groups;
DROP TABLE IF EXISTS notification_templates;

DROP FUNCTION IF EXISTS update_notification_updated_at();
