-- Remove built-in seed templates
DELETE FROM alert_templates WHERE built_in = true;
