-- Remove Canned Report Templates Tier 2
DELETE FROM report_templates
WHERE name IN (
    'Production KPI Summary',
    'Energy Consumption Report',
    'Equipment Utilization Report',
    'EPA Emissions Report',
    'OSHA Incident Log',
    'Process Safety Audit',
    'Regulatory Submission Summary',
    'Predictive Maintenance Summary',
    'Valve Leak Detection Report',
    'Pump Performance Degradation',
    'Instrument Calibration Due',
    'Statistical Process Control',
    'Yield Loss Analysis',
    'Quality Deviation Report',
    'Batch Production Summary',
    'Shift Performance Dashboard',
    'Abnormal Operations Log',
    'Startup / Shutdown Report'
);
