-- 1a. Add point_category to points_metadata
ALTER TABLE points_metadata
  ADD COLUMN point_category VARCHAR(20) NOT NULL DEFAULT 'analog'
    CHECK (point_category IN ('analog', 'boolean', 'discrete_enum'));

-- Backfill from existing data_type values written by OPC service
UPDATE points_metadata SET point_category = 'boolean'
  WHERE data_type = 'Boolean';
UPDATE points_metadata SET point_category = 'discrete_enum'
  WHERE data_type = 'String';

-- 1b. Enum label lookup table
CREATE TABLE point_enum_labels (
  point_id   UUID NOT NULL REFERENCES points_metadata(id) ON DELETE CASCADE,
  idx        SMALLINT NOT NULL,
  label      TEXT NOT NULL,
  PRIMARY KEY (point_id, idx)
);

CREATE INDEX idx_point_enum_labels_point_id ON point_enum_labels(point_id);

-- 1c. Also add to points_metadata_versions for historical correctness
ALTER TABLE points_metadata_versions
  ADD COLUMN point_category VARCHAR(20);
