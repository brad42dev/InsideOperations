-- UAT Seed Data
-- Temporary data for UAT testing. Remove with: psql -f scripts/seed-uat-rollback.sql
-- Authority: migrations > handlers > design-docs

-- Admin user UUID (from seed_tier1): 00000000-0000-0000-0000-000000000002

-- ---------------------------------------------------------------------------
-- 1. OPC UA Point Source (simulated — not backed by a real server)
-- ---------------------------------------------------------------------------

INSERT INTO point_sources (id, name, source_type, status, connection_config, enabled, description)
VALUES (
    '11110000-0000-0000-0000-000000000001',
    'SimBLAH OPC UA',
    'opc_ua',
    'active',
    '{"endpoint_url":"opc.tcp://simblah:4840","security_policy":"None","message_security_mode":"None","session_timeout_ms":30000}'::jsonb,
    true,
    'Simulated OPC UA server for UAT testing'
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Points Metadata (10 simulated process points)
-- ---------------------------------------------------------------------------

INSERT INTO points_metadata (id, tagname, source_id, description, engineering_units, data_type,
    min_value, max_value, aggregation_types, active, criticality, area, first_seen_at, last_seen_at)
VALUES
    ('22220000-0000-0000-0000-000000000001', 'UNIT1.TIC-101.PV',  '11110000-0000-0000-0000-000000000001',
     'Reactor inlet temperature',   '°C',    'float64', 0.0,   250.0, 7, true, 'production',    'Reactor Unit 1', NOW(), NOW()),
    ('22220000-0000-0000-0000-000000000002', 'UNIT1.PIC-201.PV',  '11110000-0000-0000-0000-000000000001',
     'Reactor pressure',             'kPa',   'float64', 0.0,  1500.0, 7, true, 'production',    'Reactor Unit 1', NOW(), NOW()),
    ('22220000-0000-0000-0000-000000000003', 'UNIT1.FIC-301.PV',  '11110000-0000-0000-0000-000000000001',
     'Feed flow rate',               'm³/h',  'float64', 0.0,   200.0, 7, true, 'production',    'Reactor Unit 1', NOW(), NOW()),
    ('22220000-0000-0000-0000-000000000004', 'UNIT1.LIC-401.PV',  '11110000-0000-0000-0000-000000000001',
     'Reactor level',                '%',     'float64', 0.0,   100.0, 7, true, 'production',    'Reactor Unit 1', NOW(), NOW()),
    ('22220000-0000-0000-0000-000000000005', 'UNIT2.TIC-102.PV',  '11110000-0000-0000-0000-000000000001',
     'Distillation tower temperature', '°C',  'float64', 0.0,   350.0, 7, true, 'production',    'Distillation Unit 2', NOW(), NOW()),
    ('22220000-0000-0000-0000-000000000006', 'UNIT2.PIC-202.PV',  '11110000-0000-0000-0000-000000000001',
     'Column overhead pressure',     'kPa',   'float64', 0.0,   800.0, 7, true, 'production',    'Distillation Unit 2', NOW(), NOW()),
    ('22220000-0000-0000-0000-000000000007', 'UTIL.FIC-501.PV',   '11110000-0000-0000-0000-000000000001',
     'Steam supply flow',            'kg/h',  'float64', 0.0,  5000.0, 7, true, 'production',    'Utilities', NOW(), NOW()),
    ('22220000-0000-0000-0000-000000000008', 'UTIL.TIC-502.PV',   '11110000-0000-0000-0000-000000000001',
     'Cooling water return temp',    '°C',    'float64', 10.0,   60.0, 7, true, 'informational', 'Utilities', NOW(), NOW()),
    ('22220000-0000-0000-0000-000000000009', 'FLARE.FIC-601.PV',  '11110000-0000-0000-0000-000000000001',
     'Flare gas flow',               'Nm³/h', 'float64', 0.0,   300.0, 7, true, 'environmental', 'Flare System', NOW(), NOW()),
    ('22220000-0000-0000-0000-000000000010', 'PLANT.STATUS',      '11110000-0000-0000-0000-000000000001',
     'Plant operational status',     '',      'int32',   0.0,     3.0, 0, true, 'safety_critical','Plant Wide',  NOW(), NOW())
ON CONFLICT (tagname, source_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Current Values (fresh readings for each point)
-- ---------------------------------------------------------------------------

INSERT INTO points_current (point_id, value, quality, timestamp)
VALUES
    ('22220000-0000-0000-0000-000000000001', 142.3,  'Good', NOW()),
    ('22220000-0000-0000-0000-000000000002', 892.1,  'Good', NOW()),
    ('22220000-0000-0000-0000-000000000003',  87.4,  'Good', NOW()),
    ('22220000-0000-0000-0000-000000000004',  63.7,  'Good', NOW()),
    ('22220000-0000-0000-0000-000000000005', 198.9,  'Good', NOW()),
    ('22220000-0000-0000-0000-000000000006', 312.5,  'Good', NOW()),
    ('22220000-0000-0000-0000-000000000007', 1840.0, 'Good', NOW()),
    ('22220000-0000-0000-0000-000000000008',  28.6,  'Good', NOW()),
    ('22220000-0000-0000-0000-000000000009',  12.3,  'Good', NOW()),
    ('22220000-0000-0000-0000-000000000010',   1.0,  'Good', NOW())
ON CONFLICT (point_id) DO UPDATE
    SET value = EXCLUDED.value,
        quality = EXCLUDED.quality,
        timestamp = EXCLUDED.timestamp,
        updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 4. Console Workspace (stored in design_objects per actual handler)
-- ---------------------------------------------------------------------------

INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
VALUES (
    '33330000-0000-0000-0000-000000000001',
    'Reactor Overview',
    'console_workspace',
    NULL,
    '{}'::jsonb,
    '{
        "panes": [
            {
                "id": "pane-1",
                "graphic_id": "44440000-0000-0000-0000-000000000001",
                "x": 0, "y": 0, "w": 12, "h": 8
            }
        ],
        "cols": 12,
        "rows": 8
    }'::jsonb,
    NULL,
    '00000000-0000-0000-0000-000000000002'
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Graphic (simple SVG with point bindings)
-- ---------------------------------------------------------------------------

INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
VALUES (
    '44440000-0000-0000-0000-000000000001',
    'Reactor Unit 1 Overview',
    'graphic',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="#1a1a2e"/>
  <!-- Reactor vessel -->
  <rect x="300" y="150" width="200" height="300" rx="10" fill="none" stroke="#4a90d9" stroke-width="2"/>
  <text x="400" y="140" text-anchor="middle" fill="#8899aa" font-size="14" font-family="sans-serif">REACTOR R-101</text>
  <!-- Temperature display -->
  <g id="TIC-101-display" data-binding="UNIT1.TIC-101.PV">
    <rect x="50" y="80" width="160" height="60" rx="4" fill="#0d1b2a" stroke="#4a90d9" stroke-width="1"/>
    <text x="130" y="103" text-anchor="middle" fill="#8899aa" font-size="11" font-family="sans-serif">TIC-101 TEMP</text>
    <text id="TIC-101-value" x="130" y="128" text-anchor="middle" fill="#e0e0e0" font-size="20" font-family="monospace">--.-</text>
  </g>
  <!-- Pressure display -->
  <g id="PIC-201-display" data-binding="UNIT1.PIC-201.PV">
    <rect x="50" y="160" width="160" height="60" rx="4" fill="#0d1b2a" stroke="#4a90d9" stroke-width="1"/>
    <text x="130" y="183" text-anchor="middle" fill="#8899aa" font-size="11" font-family="sans-serif">PIC-201 PRESS</text>
    <text id="PIC-201-value" x="130" y="208" text-anchor="middle" fill="#e0e0e0" font-size="20" font-family="monospace">--.-</text>
  </g>
  <!-- Flow display -->
  <g id="FIC-301-display" data-binding="UNIT1.FIC-301.PV">
    <rect x="50" y="240" width="160" height="60" rx="4" fill="#0d1b2a" stroke="#4a90d9" stroke-width="1"/>
    <text x="130" y="263" text-anchor="middle" fill="#8899aa" font-size="11" font-family="sans-serif">FIC-301 FLOW</text>
    <text id="FIC-301-value" x="130" y="288" text-anchor="middle" fill="#e0e0e0" font-size="20" font-family="monospace">--.-</text>
  </g>
  <!-- Level display -->
  <g id="LIC-401-display" data-binding="UNIT1.LIC-401.PV">
    <rect x="590" y="80" width="160" height="60" rx="4" fill="#0d1b2a" stroke="#4a90d9" stroke-width="1"/>
    <text x="670" y="103" text-anchor="middle" fill="#8899aa" font-size="11" font-family="sans-serif">LIC-401 LEVEL</text>
    <text id="LIC-401-value" x="670" y="128" text-anchor="middle" fill="#e0e0e0" font-size="20" font-family="monospace">--.-</text>
  </g>
</svg>',
    '{
        "version": 1,
        "bindings": [
            {
                "element_id": "TIC-101-display",
                "point_id": "22220000-0000-0000-0000-000000000001",
                "tagname": "UNIT1.TIC-101.PV",
                "property": "value",
                "transform": "identity",
                "value_element_id": "TIC-101-value"
            },
            {
                "element_id": "PIC-201-display",
                "point_id": "22220000-0000-0000-0000-000000000002",
                "tagname": "UNIT1.PIC-201.PV",
                "property": "value",
                "transform": "identity",
                "value_element_id": "PIC-201-value"
            },
            {
                "element_id": "FIC-301-display",
                "point_id": "22220000-0000-0000-0000-000000000003",
                "tagname": "UNIT1.FIC-301.PV",
                "property": "value",
                "transform": "identity",
                "value_element_id": "FIC-301-value"
            },
            {
                "element_id": "LIC-401-display",
                "point_id": "22220000-0000-0000-0000-000000000004",
                "tagname": "UNIT1.LIC-401.PV",
                "property": "value",
                "transform": "identity",
                "value_element_id": "LIC-401-value"
            }
        ]
    }'::jsonb,
    '{"module": "console", "width": 800, "height": 600}'::jsonb,
    NULL,
    '00000000-0000-0000-0000-000000000002'
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. User Dashboard (personal, owned by admin — supplements the 8 system ones)
-- ---------------------------------------------------------------------------

INSERT INTO dashboards (id, name, description, category, layout, widgets, variables, published, is_system, user_id)
VALUES (
    '55550000-0000-0000-0000-000000000001',
    'Reactor Unit 1 KPIs',
    'Live KPI cards for Reactor Unit 1 process points',
    'Process Performance',
    '{"cols":12,"rows":6}'::jsonb,
    '[
        {"id":"w1","type":"kpi-card","x":0,"y":0,"w":3,"h":2,
         "config":{"title":"Reactor Temp","point_id":"22220000-0000-0000-0000-000000000001","unit":"°C","decimals":1}},
        {"id":"w2","type":"kpi-card","x":3,"y":0,"w":3,"h":2,
         "config":{"title":"Reactor Pressure","point_id":"22220000-0000-0000-0000-000000000002","unit":"kPa","decimals":0}},
        {"id":"w3","type":"kpi-card","x":6,"y":0,"w":3,"h":2,
         "config":{"title":"Feed Flow","point_id":"22220000-0000-0000-0000-000000000003","unit":"m³/h","decimals":1}},
        {"id":"w4","type":"kpi-card","x":9,"y":0,"w":3,"h":2,
         "config":{"title":"Reactor Level","point_id":"22220000-0000-0000-0000-000000000004","unit":"%","decimals":1}},
        {"id":"w5","type":"trend-chart","x":0,"y":2,"w":12,"h":4,
         "config":{"title":"Unit 1 Trends","points":["22220000-0000-0000-0000-000000000001","22220000-0000-0000-0000-000000000002","22220000-0000-0000-0000-000000000003","22220000-0000-0000-0000-000000000004"],"window_hours":4}}
    ]'::jsonb,
    '[]'::jsonb,
    true,
    false,
    '00000000-0000-0000-0000-000000000002'
)
ON CONFLICT (id) DO NOTHING;
