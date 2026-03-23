-- Remove the websocket alert channel entry added by the up migration.
DELETE FROM alert_channels WHERE channel_type = 'websocket';
