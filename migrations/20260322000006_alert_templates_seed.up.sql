-- Seed the 14 built-in alert templates shipped with the system.
-- These templates are marked built_in = true so they cannot be deleted via the API.
-- Site administrators may edit them but may not remove them.

INSERT INTO alert_templates
    (name, severity, title_template, message_template, channels,
     requires_acknowledgment, auto_resolve_minutes, category, variables, built_in)
VALUES
    (
        'Gas Leak Emergency',
        'emergency',
        'Gas Leak Detected — {{unit}}',
        '{{gas_type}} detected at {{instrument}}. {{action_required}}. Await all-clear from Control Room.',
        ARRAY['websocket','email','sms','radio','pa','browser_push'],
        true, NULL, 'emergency',
        ARRAY['unit','gas_type','instrument','action_required'],
        true
    ),
    (
        'Fire Alarm',
        'emergency',
        'Fire Alarm — {{location}}',
        'Fire alarm activated at {{location}}. Evacuate immediately. Emergency services notified.',
        ARRAY['websocket','email','sms','radio','pa','browser_push'],
        true, NULL, 'emergency',
        ARRAY['location'],
        true
    ),
    (
        'Shelter in Place',
        'emergency',
        'Shelter in Place Order — {{area}}',
        'A shelter-in-place order has been issued for {{area}}. Reason: {{reason}}. Remain indoors and await further instructions.',
        ARRAY['websocket','email','sms','radio','pa','browser_push'],
        true, NULL, 'emergency',
        ARRAY['area','reason'],
        true
    ),
    (
        'Evacuation Order',
        'emergency',
        'Evacuation Order — {{area}}',
        'Immediate evacuation required for {{area}}. Proceed to muster point {{muster_point}}. Do not use elevators.',
        ARRAY['websocket','email','sms','radio','pa','browser_push'],
        true, NULL, 'emergency',
        ARRAY['area','muster_point'],
        true
    ),
    (
        'All Clear',
        'info',
        'All Clear — {{area}}',
        'The {{incident_type}} incident at {{area}} has been resolved. All personnel may resume normal operations.',
        ARRAY['websocket','email','sms','radio','pa','browser_push'],
        false, 60, 'emergency',
        ARRAY['area','incident_type'],
        true
    ),
    (
        'Unit Trip',
        'critical',
        'Unit Trip — {{unit}}',
        '{{unit}} has tripped. Last reading: {{last_reading}}. Cause: {{cause}}. Control Room is investigating.',
        ARRAY['websocket','email','sms'],
        true, NULL, 'process',
        ARRAY['unit','last_reading','cause'],
        true
    ),
    (
        'Equipment Failure',
        'critical',
        'Equipment Failure — {{equipment}}',
        '{{equipment}} in {{location}} has failed. Failure mode: {{failure_mode}}. Maintenance has been notified.',
        ARRAY['websocket','email','sms'],
        true, NULL, 'maintenance',
        ARRAY['equipment','location','failure_mode'],
        true
    ),
    (
        'Safety System Override',
        'critical',
        'Safety System Override — {{system}}',
        '{{system}} safety interlock has been overridden by {{operator}}. Reason: {{reason}}. Duration: {{duration}}.',
        ARRAY['websocket','email','sms'],
        true, NULL, 'safety',
        ARRAY['system','operator','reason','duration'],
        true
    ),
    (
        'High Alarm',
        'warning',
        'High Alarm — {{tag}}',
        '{{tag}} ({{description}}) has exceeded its high alarm setpoint. Current value: {{value}} {{unit}}. Setpoint: {{setpoint}} {{unit}}.',
        ARRAY['websocket','email'],
        false, 30, 'process',
        ARRAY['tag','description','value','unit','setpoint'],
        true
    ),
    (
        'OPC Connection Lost',
        'warning',
        'OPC Connection Lost — {{server}}',
        'Connection to OPC server {{server}} was lost at {{time}}. Affected tags: {{tag_count}}. Attempting reconnection.',
        ARRAY['websocket','email'],
        false, 120, 'system',
        ARRAY['server','time','tag_count'],
        true
    ),
    (
        'Round Overdue',
        'warning',
        'Round Overdue — {{round_name}}',
        'Inspection round "{{round_name}}" assigned to {{assignee}} is overdue by {{minutes}} minutes. Last completed stop: {{last_stop}}.',
        ARRAY['websocket','email'],
        false, 60, 'operations',
        ARRAY['round_name','assignee','minutes','last_stop'],
        true
    ),
    (
        'Report Ready',
        'info',
        'Report Ready — {{report_name}}',
        'Your requested report "{{report_name}}" is ready. Generated at {{generated_at}}. Download link: {{download_url}}.',
        ARRAY['websocket','email'],
        false, 1440, 'system',
        ARRAY['report_name','generated_at','download_url'],
        true
    ),
    (
        'Maintenance Reminder',
        'info',
        'Maintenance Reminder — {{equipment}}',
        'Scheduled maintenance for {{equipment}} is due on {{due_date}}. Work order: {{work_order}}. Assigned to: {{assigned_to}}.',
        ARRAY['websocket','email'],
        false, 10080, 'maintenance',
        ARRAY['equipment','due_date','work_order','assigned_to'],
        true
    ),
    (
        'Custom Alert',
        'info',
        '{{title}}',
        '{{message}}',
        ARRAY['websocket'],
        false, NULL, 'custom',
        ARRAY['title','message'],
        true
    )
ON CONFLICT (name) DO NOTHING;
