-- Drop alert service tables in reverse dependency order
DROP TABLE IF EXISTS alert_deliveries;
DROP TABLE IF EXISTS alert_instances;
DROP TABLE IF EXISTS escalation_tiers;
DROP TABLE IF EXISTS escalation_policies;
