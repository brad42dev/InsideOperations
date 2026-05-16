-- Fix FK: workspace data lives in design_objects, not workspaces
ALTER TABLE workspace_versions
    DROP CONSTRAINT workspace_versions_workspace_id_fkey;

ALTER TABLE workspace_versions
    ADD CONSTRAINT workspace_versions_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES design_objects(id) ON DELETE CASCADE;
