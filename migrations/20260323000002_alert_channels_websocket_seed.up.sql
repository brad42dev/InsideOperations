-- Add websocket channel to alert_channels table.
--
-- The WebSocket channel delivers in-browser notifications via the Data Broker
-- and is always available (no external service configuration required).
-- It should be enabled by default so the Alert compose dialog shows it.
--
-- The existing `in_app` channel type is part of the alarm-engine delivery
-- mechanism; `websocket` is the human-initiated notification channel used
-- by the Alerts Module compose dialog.

INSERT INTO alert_channels (channel_type, display_name, enabled, config)
VALUES ('websocket', 'WebSocket (Browser)', true, '{}')
ON CONFLICT (channel_type) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    enabled      = true;
