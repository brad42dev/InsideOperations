-- Phase 10: Extend dashboards table and add playlist support

-- Extend dashboards table
ALTER TABLE dashboards
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS thumbnail TEXT;

-- Dashboard playlists
CREATE TABLE IF NOT EXISTS dashboard_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_playlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES dashboard_playlists(id) ON DELETE CASCADE,
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    dwell_seconds INTEGER NOT NULL DEFAULT 30,
    variable_overrides JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON dashboard_playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_system ON dashboards(is_system) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS idx_dashboards_user ON dashboards(user_id);

-- Updated_at trigger for dashboard_playlists
CREATE TRIGGER trg_dashboard_playlists_updated_at
    BEFORE UPDATE ON dashboard_playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Seed: 8 Phase 1 canned (system) dashboards
-- ---------------------------------------------------------------------------

-- 1. Operations Overview
INSERT INTO dashboards (name, description, category, layout, widgets, variables, published, is_system)
VALUES (
    'Operations Overview',
    'High-level view of active alarms, OPC source health, current shift, and area status.',
    'Operations Overview',
    '{"cols":12,"rows":8}'::jsonb,
    '[
      {"id":"w1","type":"alarm-kpi","x":0,"y":0,"w":3,"h":2,"config":{"title":"Active Alarms","metric":"active_count"}},
      {"id":"w2","type":"opc-status","x":3,"y":0,"w":3,"h":2,"config":{"title":"OPC Sources"}},
      {"id":"w3","type":"shift-info","x":6,"y":0,"w":3,"h":2,"config":{"title":"Current Shift"}},
      {"id":"w4","type":"area-status-table","x":0,"y":2,"w":12,"h":6,"config":{"title":"Area Status","variable":"area"}}
    ]'::jsonb,
    '[]'::jsonb,
    true,
    true
);

-- 2. Active Alarms
INSERT INTO dashboards (name, description, category, layout, widgets, variables, published, is_system)
VALUES (
    'Active Alarms',
    'Real-time alarm counts, unacknowledged alarms, alarm rate, and the active alarm list.',
    'Alarm Management',
    '{"cols":12,"rows":8}'::jsonb,
    '[
      {"id":"w1","type":"alarm-count-by-severity","x":0,"y":0,"w":3,"h":2,"config":{"title":"Alarms by Severity"}},
      {"id":"w2","type":"unack-count","x":3,"y":0,"w":3,"h":2,"config":{"title":"Unacknowledged"}},
      {"id":"w3","type":"alarm-rate","x":6,"y":0,"w":3,"h":2,"config":{"title":"Alarm Rate","window_minutes":60}},
      {"id":"w4","type":"alarm-list","x":0,"y":2,"w":12,"h":6,"config":{"title":"Active Alarm List","show_acknowledged":false}}
    ]'::jsonb,
    '[]'::jsonb,
    true,
    true
);

-- 3. Alarm KPI Summary
INSERT INTO dashboards (name, description, category, layout, widgets, variables, published, is_system)
VALUES (
    'Alarm KPI Summary',
    'ISA-18.2 alarm KPIs: rate trend, standing alarms, chattering alarms, shelved alarms, and priority distribution.',
    'Alarm Management',
    '{"cols":12,"rows":8}'::jsonb,
    '[
      {"id":"w1","type":"alarm-rate-trend","x":0,"y":0,"w":6,"h":3,"config":{"title":"Alarm Rate Trend (24h)","window_hours":24}},
      {"id":"w2","type":"standing-count","x":6,"y":0,"w":3,"h":2,"config":{"title":"Standing Alarms","threshold_minutes":24}},
      {"id":"w3","type":"chattering-count","x":9,"y":0,"w":3,"h":2,"config":{"title":"Chattering Alarms","threshold_count":3}},
      {"id":"w4","type":"shelved-count","x":6,"y":2,"w":3,"h":1,"config":{"title":"Shelved Alarms"}},
      {"id":"w5","type":"priority-distribution","x":0,"y":3,"w":12,"h":5,"config":{"title":"Alarm Priority Distribution"}}
    ]'::jsonb,
    '[]'::jsonb,
    false,
    true
);

-- 4. Process Area Overview
INSERT INTO dashboards (name, description, category, layout, widgets, variables, published, is_system)
VALUES (
    'Process Area Overview',
    'Key process KPIs for a selected area or unit: temperature, pressure, flow, level, trend, alarms, and point status.',
    'Process Performance',
    '{"cols":12,"rows":8}'::jsonb,
    '[
      {"id":"w1","type":"kpi-card","x":0,"y":0,"w":3,"h":2,"config":{"title":"Temperature","metric":"avg_temperature","unit":"°C","variable":"area"}},
      {"id":"w2","type":"kpi-card","x":3,"y":0,"w":3,"h":2,"config":{"title":"Pressure","metric":"avg_pressure","unit":"kPa","variable":"area"}},
      {"id":"w3","type":"kpi-card","x":6,"y":0,"w":3,"h":2,"config":{"title":"Flow","metric":"avg_flow","unit":"m³/h","variable":"area"}},
      {"id":"w4","type":"kpi-card","x":9,"y":0,"w":3,"h":2,"config":{"title":"Level","metric":"avg_level","unit":"%","variable":"area"}},
      {"id":"w5","type":"trend-chart","x":0,"y":2,"w":8,"h":4,"config":{"title":"Area Trend","variable":"area","window_hours":8}},
      {"id":"w6","type":"alarm-list","x":8,"y":2,"w":4,"h":4,"config":{"title":"Area Alarms","variable":"area"}},
      {"id":"w7","type":"point-status-table","x":0,"y":6,"w":12,"h":2,"config":{"title":"Point Status","variable":"area"}}
    ]'::jsonb,
    '[{"name":"area","label":"Area / Unit","type":"query","query":"SELECT DISTINCT area FROM points_metadata WHERE area IS NOT NULL ORDER BY area","multi":true,"include_all":true,"default":"$__all"}]'::jsonb,
    false,
    true
);

-- 5. Equipment Health
INSERT INTO dashboards (name, description, category, layout, widgets, variables, published, is_system)
VALUES (
    'Equipment Health',
    'OPC data quality overview: quality distribution, stale points, and bad-quality point breakdown by source.',
    'Equipment & Maintenance',
    '{"cols":12,"rows":6}'::jsonb,
    '[
      {"id":"w1","type":"quality-distribution","x":0,"y":0,"w":4,"h":3,"config":{"title":"Quality Distribution"}},
      {"id":"w2","type":"stale-points","x":4,"y":0,"w":4,"h":3,"config":{"title":"Stale Points","threshold_minutes":5}},
      {"id":"w3","type":"bad-quality-by-source","x":8,"y":0,"w":4,"h":3,"config":{"title":"Bad Quality by Source"}},
      {"id":"w4","type":"point-status-table","x":0,"y":3,"w":12,"h":3,"config":{"title":"All Points","filter":"bad_quality"}}
    ]'::jsonb,
    '[]'::jsonb,
    true,
    true
);

-- 6. Environmental Compliance
INSERT INTO dashboards (name, description, category, layout, widgets, variables, published, is_system)
VALUES (
    'Environmental Compliance',
    'Environmental threshold monitoring: exceedance table, compliance trend, and exceedance duration tracking.',
    'Environmental & Compliance',
    '{"cols":12,"rows":8}'::jsonb,
    '[
      {"id":"w1","type":"threshold-exceedance-table","x":0,"y":0,"w":12,"h":4,"config":{"title":"Threshold Exceedances","show_active_only":false}},
      {"id":"w2","type":"compliance-trend","x":0,"y":4,"w":8,"h":4,"config":{"title":"Compliance Trend (30d)","window_days":30}},
      {"id":"w3","type":"exceedance-duration","x":8,"y":4,"w":4,"h":4,"config":{"title":"Exceedance Duration"}}
    ]'::jsonb,
    '[]'::jsonb,
    false,
    true
);

-- 7. System Health
INSERT INTO dashboards (name, description, category, layout, widgets, variables, published, is_system)
VALUES (
    'System Health',
    'Infrastructure health: OPC source status, service health, WebSocket throughput, database size, and API response times.',
    'System Administration',
    '{"cols":12,"rows":8}'::jsonb,
    '[
      {"id":"w1","type":"opc-status","x":0,"y":0,"w":4,"h":2,"config":{"title":"OPC Sources"}},
      {"id":"w2","type":"service-health","x":4,"y":0,"w":4,"h":2,"config":{"title":"Service Health"}},
      {"id":"w3","type":"ws-throughput","x":8,"y":0,"w":4,"h":2,"config":{"title":"WebSocket Throughput"}},
      {"id":"w4","type":"db-size","x":0,"y":2,"w":4,"h":2,"config":{"title":"Database Size"}},
      {"id":"w5","type":"api-response-time","x":4,"y":2,"w":8,"h":2,"config":{"title":"API Response Time (p95)","percentile":95}},
      {"id":"w6","type":"service-health-table","x":0,"y":4,"w":12,"h":4,"config":{"title":"Service Health Details"}}
    ]'::jsonb,
    '[]'::jsonb,
    true,
    true
);

-- 8. Executive Summary
INSERT INTO dashboards (name, description, category, layout, widgets, variables, published, is_system)
VALUES (
    'Executive Summary',
    'Top-level operational overview for management: alarm health, production status, rounds completion, open alerts, and system uptime.',
    'Executive/Management',
    '{"cols":12,"rows":8}'::jsonb,
    '[
      {"id":"w1","type":"alarm-health-kpi","x":0,"y":0,"w":3,"h":2,"config":{"title":"Alarm Health"}},
      {"id":"w2","type":"production-status","x":3,"y":0,"w":3,"h":2,"config":{"title":"Production Status"}},
      {"id":"w3","type":"rounds-completion","x":6,"y":0,"w":3,"h":2,"config":{"title":"Rounds Completion","window_hours":24}},
      {"id":"w4","type":"open-alerts","x":9,"y":0,"w":3,"h":2,"config":{"title":"Open Alerts"}},
      {"id":"w5","type":"system-uptime","x":0,"y":2,"w":4,"h":2,"config":{"title":"System Uptime (30d)","window_days":30}},
      {"id":"w6","type":"alarm-rate-trend","x":4,"y":2,"w":8,"h":2,"config":{"title":"Alarm Rate Trend","window_hours":168}},
      {"id":"w7","type":"area-status-table","x":0,"y":4,"w":12,"h":4,"config":{"title":"Area Status Summary"}}
    ]'::jsonb,
    '[]'::jsonb,
    false,
    true
);
