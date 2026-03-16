-- Reverse Phase 10 dashboard extensions

DROP TABLE IF EXISTS dashboard_playlist_items;
DROP TABLE IF EXISTS dashboard_playlists;

ALTER TABLE dashboards DROP COLUMN IF EXISTS thumbnail;
ALTER TABLE dashboards DROP COLUMN IF EXISTS is_system;
ALTER TABLE dashboards DROP COLUMN IF EXISTS variables;
ALTER TABLE dashboards DROP COLUMN IF EXISTS category;
ALTER TABLE dashboards DROP COLUMN IF EXISTS description;
