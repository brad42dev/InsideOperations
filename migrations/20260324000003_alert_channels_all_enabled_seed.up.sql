-- Seed all alert channels required by the Alerts Module composer as enabled.
--
-- The composer at /alerts (Send Alert tab) must show: websocket, sms, pa,
-- radio, and push channels as toggleable checkboxes. These channels are
-- referenced by notification templates (e.g. "Custom Alert" template has
-- sms/radio/push channels). They must exist and be enabled in the
-- alert_channels table so GET /api/notifications/channels/enabled returns them.
--
-- Channels that require external service configuration (email, webhook, teams,
-- slack) remain disabled by default; they are enabled at setup time.

INSERT INTO alert_channels (channel_type, display_name, enabled, config)
VALUES
    ('websocket', 'WebSocket (Browser)',     true, '{}'),
    ('sms',       'SMS',                     true, '{}'),
    ('pa',        'Public Address (PA)',      true, '{}'),
    ('radio',     'Radio',                   true, '{}'),
    ('push',      'Push Notification',        true, '{}')
ON CONFLICT (channel_type) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    enabled      = true;
