ALTER TABLE design_objects
    ADD COLUMN published BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_design_objects_published
    ON design_objects(published) WHERE published = true;
