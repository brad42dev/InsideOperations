ALTER TABLE workspace_versions
    DROP CONSTRAINT workspace_versions_workspace_id_fkey;

ALTER TABLE workspace_versions
    ADD CONSTRAINT workspace_versions_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
