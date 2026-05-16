ALTER TABLE saved_chart_versions ADD CONSTRAINT fk_scv_created_by FOREIGN KEY (created_by) REFERENCES users(id);
