-- Canned Report Templates Tier 2 (18 additional templates)
-- Covers: Financial/KPI, Compliance, Equipment Lifecycle, Statistical/Advanced, Shift/Operations
-- Idempotent: uses INSERT ... WHERE NOT EXISTS since report_templates has no UNIQUE on name.

-- Financial / KPI (3)
INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Production KPI Summary', 'Key performance indicators — production volumes, efficiency, availability', 'executive', true, '{"layout": "kpi_grid", "sections": ["production_volume", "efficiency", "availability"]}', '{"period": "current_month", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Production KPI Summary');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Energy Consumption Report', 'Energy usage by unit, cost per unit, efficiency trends, carbon footprint', 'executive', true, '{"layout": "time_series_grid", "sections": ["energy_by_unit", "cost_per_unit", "efficiency_trend", "carbon_footprint"]}', '{"period": "current_month", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Energy Consumption Report');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Equipment Utilization Report', 'Equipment runtime, availability percentage, maintenance downtime cost', 'executive', true, '{"layout": "equipment_table", "sections": ["runtime", "availability", "downtime_cost"]}', '{"period": "current_month", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Equipment Utilization Report');

-- Compliance (4)
INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'EPA Emissions Report', 'Air emissions inventory, permit limits vs actuals, exceedance log', 'compliance', true, '{"layout": "compliance_summary", "sections": ["inventory", "permit_limits", "exceedances"], "regulatory_basis": "EPA"}', '{"period": "current_month", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'EPA Emissions Report');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'OSHA Incident Log', 'Safety incident log, near-miss tracking, OSHA 300/300A summary', 'compliance', true, '{"layout": "incident_log", "sections": ["incidents", "near_misses", "osha_summary"], "regulatory_basis": "OSHA"}', '{"period": "current_year", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'OSHA Incident Log');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Process Safety Audit', 'PSM audit findings, action item tracking, completion status', 'compliance', true, '{"layout": "audit_table", "sections": ["findings", "action_items", "completion_status"], "regulatory_basis": "PSM"}', '{"period": "current_quarter", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Process Safety Audit');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Regulatory Submission Summary', 'Permit conditions, monitoring frequency, compliance status per parameter', 'compliance', true, '{"layout": "permit_table", "sections": ["permit_conditions", "monitoring_schedule", "compliance_status"]}', '{"period": "current_month", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Regulatory Submission Summary');

-- Equipment Lifecycle (4)
INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Predictive Maintenance Summary', 'Equipment health scores, predicted failure dates, recommended interventions', 'maintenance', true, '{"layout": "health_dashboard", "sections": ["health_scores", "predicted_failures", "interventions"]}', '{"lookback_days": 30, "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Predictive Maintenance Summary');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Valve Leak Detection Report', 'Valve scan results, leak rates, repair priority ranking', 'maintenance', true, '{"layout": "inspection_table", "sections": ["scan_results", "leak_rates", "priority_ranking"]}', '{"period": "current_month", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Valve Leak Detection Report');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Pump Performance Degradation', 'Pump efficiency curves vs baseline, cavitation indicators, bearing vibration', 'maintenance', true, '{"layout": "performance_curves", "sections": ["efficiency_curves", "cavitation", "vibration_trends"]}', '{"lookback_days": 90, "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Pump Performance Degradation');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Instrument Calibration Due', 'Instruments due for calibration, last calibration date, frequency schedule', 'maintenance', true, '{"layout": "calibration_schedule", "sections": ["due_instruments", "last_calibration", "frequency"]}', '{"lookahead_days": 30, "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Instrument Calibration Due');

-- Statistical / Advanced (4)
INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Statistical Process Control', 'Control charts (X-bar, R, P), process capability indices (Cp, Cpk), out-of-control signals', 'analytics', true, '{"layout": "control_charts", "sections": ["xbar_r_chart", "p_chart", "capability_indices", "ooc_signals"]}', '{"lookback_days": 30, "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Statistical Process Control');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Yield Loss Analysis', 'Unit yield vs targets, loss accounting by cause category, Pareto of loss drivers', 'analytics', true, '{"layout": "pareto_analysis", "sections": ["yield_vs_target", "loss_by_cause", "pareto_chart"]}', '{"period": "current_month", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Yield Loss Analysis');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Quality Deviation Report', 'Off-spec product events, root cause classification, corrective action status', 'analytics', true, '{"layout": "deviation_log", "sections": ["off_spec_events", "root_causes", "corrective_actions"]}', '{"period": "current_month", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Quality Deviation Report');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Batch Production Summary', 'Batch-by-batch comparison — cycle time, yield, quality, energy per batch', 'analytics', true, '{"layout": "batch_comparison", "sections": ["cycle_time", "yield", "quality", "energy_per_batch"]}', '{"lookback_days": 30, "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Batch Production Summary');

-- Shift / Operations (3)
INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Shift Performance Dashboard', 'Per-shift production summary, alarm events, rounds completion, safety observations', 'operations', true, '{"layout": "shift_summary", "sections": ["production", "alarms", "rounds", "safety_observations"]}', '{"shift_date": "today", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Shift Performance Dashboard');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Abnormal Operations Log', 'Deviations from normal procedures, emergency responses, operator notes', 'operations', true, '{"layout": "deviation_log", "sections": ["deviations", "emergency_responses", "operator_notes"]}', '{"period": "current_shift", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Abnormal Operations Log');

INSERT INTO report_templates (name, description, category, is_system_template, template_config, default_params)
SELECT 'Startup / Shutdown Report', 'Unit startup/shutdown sequences, milestone times, deviations from procedure', 'operations', true, '{"layout": "sequence_log", "sections": ["sequence_steps", "milestone_times", "procedure_deviations"]}', '{"event_type": "startup", "format": "pdf"}'
WHERE NOT EXISTS (SELECT 1 FROM report_templates WHERE name = 'Startup / Shutdown Report');
