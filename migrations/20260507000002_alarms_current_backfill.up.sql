-- Backfill alarms_current from the latest OPC alarm event per (point_id, condition_name).
-- This seeds the table for all historically seen conditions so the active alarm view
-- immediately reflects the known state rather than waiting for new events to arrive.

INSERT INTO alarms_current (
    point_id,
    alarm_source,
    condition_name,
    state,
    priority,
    severity,
    limit_state,
    event_id_hex,
    source_id,
    active,
    acked,
    retain,
    suppressed_or_shelved,
    message,
    metadata,
    last_event_at,
    activated_at,
    cleared_at
)
SELECT
    e.point_id,
    'opc'::event_source_enum,
    COALESCE(e.metadata->>'condition_name', '') AS condition_name,
    CASE
        WHEN (e.metadata->>'active')::boolean AND NOT (e.metadata->>'acked')::boolean
            THEN 'active'::alarm_state_enum
        WHEN (e.metadata->>'active')::boolean AND (e.metadata->>'acked')::boolean
            THEN 'acknowledged'::alarm_state_enum
        WHEN NOT (e.metadata->>'active')::boolean AND NOT (e.metadata->>'acked')::boolean
            THEN 'rtn'::alarm_state_enum
        ELSE 'cleared'::alarm_state_enum
    END AS state,
    CASE COALESCE(e.metadata->>'limit_state', '')
        WHEN 'HighHigh' THEN 'urgent'::alarm_priority_enum
        WHEN 'LowLow'   THEN 'urgent'::alarm_priority_enum
        WHEN 'High'     THEN 'high'::alarm_priority_enum
        WHEN 'Low'      THEN 'high'::alarm_priority_enum
        ELSE                 'low'::alarm_priority_enum
    END AS priority,
    CASE
        WHEN (e.metadata->>'active')::boolean THEN
            CASE COALESCE(e.metadata->>'limit_state', '')
                WHEN 'HighHigh' THEN 900
                WHEN 'LowLow'   THEN 900
                WHEN 'High'     THEN 700
                WHEN 'Low'      THEN 700
                ELSE 500
            END::smallint
        ELSE 200::smallint
    END AS severity,
    NULLIF(e.metadata->>'limit_state', '')     AS limit_state,
    e.metadata->>'external_id'                 AS event_id_hex,
    (e.metadata->>'source_id')::uuid           AS source_id,
    COALESCE((e.metadata->>'active')::boolean, false)              AS active,
    COALESCE((e.metadata->>'acked')::boolean, true)                AS acked,
    COALESCE((e.metadata->>'retain')::boolean, false)              AS retain,
    COALESCE((e.metadata->>'suppressed_or_shelved')::boolean, false) AS suppressed_or_shelved,
    e.message,
    e.metadata,
    e.timestamp                                AS last_event_at,
    CASE WHEN (e.metadata->>'active')::boolean THEN e.timestamp ELSE NULL END AS activated_at,
    CASE WHEN NOT (e.metadata->>'active')::boolean THEN e.timestamp ELSE NULL END AS cleared_at
FROM (
    SELECT DISTINCT ON (point_id, metadata->>'condition_name')
        id, point_id, message, metadata, timestamp
    FROM events
    WHERE event_type = 'process_alarm'
      AND source = 'opc'
      AND point_id IS NOT NULL
      AND metadata->>'condition_name' IS NOT NULL
    ORDER BY point_id, metadata->>'condition_name', timestamp DESC
) e
ON CONFLICT (point_id, alarm_source, condition_name) DO NOTHING;
