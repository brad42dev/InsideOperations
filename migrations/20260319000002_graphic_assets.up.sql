-- Stores binary image assets (PNG, SVG, JPEG) extracted from .iographic packages
-- or uploaded directly via the Image Tool in Designer.
-- Content-addressed by SHA-256 hash for deduplication (per spec §4.3).
-- Table named 'graphic_assets' to avoid conflict with any future 'image_assets'
-- from the base schema; uses 'content_hash' / 'content' column names.

CREATE TABLE IF NOT EXISTS graphic_assets (
    content_hash TEXT        NOT NULL PRIMARY KEY,  -- hex-encoded SHA-256 of content
    mime_type    TEXT        NOT NULL DEFAULT 'image/png',
    content      BYTEA       NOT NULL,
    width        INTEGER,
    height       INTEGER,
    created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT graphic_assets_hash_len CHECK (length(content_hash) = 64)
);

COMMENT ON TABLE graphic_assets IS 'Content-addressed image assets for Designer graphics (spec §4.3)';
