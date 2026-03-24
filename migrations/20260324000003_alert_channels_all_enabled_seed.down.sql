-- Reverse: disable sms, pa, radio, push; leave websocket enabled
-- (websocket was already enabled by a prior migration)

UPDATE alert_channels
SET enabled = false
WHERE channel_type IN ('sms', 'pa', 'radio', 'push');
