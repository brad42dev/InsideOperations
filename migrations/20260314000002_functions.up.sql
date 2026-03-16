-- Utility function: auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Audit logging function
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
    v_record_id UUID;
    v_row       JSONB;
BEGIN
    -- Safely extract 'id' field if the table has one; NULL otherwise
    -- (junction tables like role_permissions have no id column)
    IF TG_OP = 'DELETE' THEN
        v_row := row_to_json(OLD)::JSONB;
        v_record_id := CASE WHEN v_row ? 'id' THEN (v_row->>'id')::UUID ELSE NULL END;
        INSERT INTO audit_log (user_id, action, table_name, record_id, changes)
        VALUES (
            nullif(current_setting('app.current_user_id', true), '')::UUID,
            'DELETE',
            TG_TABLE_NAME,
            v_record_id,
            jsonb_build_object('old', v_row)
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        v_row := row_to_json(NEW)::JSONB;
        v_record_id := CASE WHEN v_row ? 'id' THEN (v_row->>'id')::UUID ELSE NULL END;
        INSERT INTO audit_log (user_id, action, table_name, record_id, changes)
        VALUES (
            nullif(current_setting('app.current_user_id', true), '')::UUID,
            'UPDATE',
            TG_TABLE_NAME,
            v_record_id,
            jsonb_build_object('old', row_to_json(OLD)::JSONB, 'new', v_row)
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        v_row := row_to_json(NEW)::JSONB;
        v_record_id := CASE WHEN v_row ? 'id' THEN (v_row->>'id')::UUID ELSE NULL END;
        INSERT INTO audit_log (user_id, action, table_name, record_id, changes)
        VALUES (
            nullif(current_setting('app.current_user_id', true), '')::UUID,
            'INSERT',
            TG_TABLE_NAME,
            v_record_id,
            jsonb_build_object('new', v_row)
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Point deletion prevention
CREATE OR REPLACE FUNCTION prevent_point_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Points cannot be deleted. Set active = false instead. point_id=%, tagname=%',
        OLD.id, OLD.tagname;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Sync point metadata from latest version
CREATE OR REPLACE FUNCTION sync_point_metadata_from_version()
RETURNS TRIGGER AS $$
DECLARE
    max_version INTEGER;
BEGIN
    SELECT MAX(version) INTO max_version
    FROM points_metadata_versions
    WHERE point_id = NEW.point_id;

    IF NEW.version = max_version THEN
        UPDATE points_metadata
        SET description       = NEW.description,
            engineering_units = NEW.engineering_units,
            data_type         = NEW.data_type,
            min_value         = NEW.min_value,
            max_value         = NEW.max_value
        WHERE id = NEW.point_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Track point activation/deactivation timestamps
CREATE OR REPLACE FUNCTION handle_point_activation_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.active = true AND NEW.active = false THEN
        NEW.deactivated_at = NOW();
    ELSIF OLD.active = false AND NEW.active = true THEN
        NEW.reactivated_at = NOW();
        NEW.deactivated_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Idempotent point discovery and metadata versioning
CREATE OR REPLACE FUNCTION upsert_point_from_source(
    p_source_id UUID,
    p_tagname VARCHAR(255),
    p_description TEXT DEFAULT NULL,
    p_engineering_units VARCHAR(50) DEFAULT NULL,
    p_data_type VARCHAR(50) DEFAULT 'Double',
    p_min_value DOUBLE PRECISION DEFAULT NULL,
    p_max_value DOUBLE PRECISION DEFAULT NULL,
    p_source_raw JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_point_id UUID;
    v_current_version INTEGER;
    v_metadata_changed BOOLEAN := false;
BEGIN
    -- Find or create the point
    SELECT id INTO v_point_id
    FROM points_metadata
    WHERE tagname = p_tagname AND source_id = p_source_id;

    IF v_point_id IS NULL THEN
        -- New point: insert with initial metadata
        INSERT INTO points_metadata (
            tagname, source_id, description, engineering_units,
            data_type, min_value, max_value,
            first_seen_at, last_seen_at
        ) VALUES (
            p_tagname, p_source_id, p_description, p_engineering_units,
            p_data_type, p_min_value, p_max_value,
            NOW(), NOW()
        ) RETURNING id INTO v_point_id;

        -- Insert initial version (version 0)
        INSERT INTO points_metadata_versions (
            point_id, version, description, engineering_units,
            data_type, min_value, max_value,
            effective_from, source_raw
        ) VALUES (
            v_point_id, 0, p_description, p_engineering_units,
            p_data_type, p_min_value, p_max_value,
            NOW(), p_source_raw
        );
    ELSE
        -- Existing point: update last_seen_at
        UPDATE points_metadata
        SET last_seen_at = NOW()
        WHERE id = v_point_id;

        -- Check if metadata has changed
        SELECT MAX(version) INTO v_current_version
        FROM points_metadata_versions
        WHERE point_id = v_point_id;

        SELECT (
            COALESCE(description, '') != COALESCE(p_description, '') OR
            COALESCE(engineering_units, '') != COALESCE(p_engineering_units, '') OR
            data_type != p_data_type OR
            COALESCE(min_value, 0) != COALESCE(p_min_value, 0) OR
            COALESCE(max_value, 0) != COALESCE(p_max_value, 0)
        ) INTO v_metadata_changed
        FROM points_metadata_versions
        WHERE point_id = v_point_id AND version = v_current_version;

        IF v_metadata_changed THEN
            INSERT INTO points_metadata_versions (
                point_id, version, description, engineering_units,
                data_type, min_value, max_value,
                effective_from, source_raw
            ) VALUES (
                v_point_id, v_current_version + 1, p_description, p_engineering_units,
                p_data_type, p_min_value, p_max_value,
                NOW(), p_source_raw
            );
        END IF;
    END IF;

    RETURN v_point_id;
END;
$$ LANGUAGE plpgsql;

-- Batch backfill with deduplication
CREATE OR REPLACE FUNCTION backfill_upsert_history(
    p_point_ids UUID[],
    p_values DOUBLE PRECISION[],
    p_qualities VARCHAR(20)[],
    p_timestamps TIMESTAMPTZ[]
) RETURNS INTEGER AS $$
DECLARE
    i INTEGER;
    inserted_count INTEGER := 0;
BEGIN
    FOR i IN 1..array_length(p_point_ids, 1) LOOP
        INSERT INTO points_history_raw (point_id, value, quality, timestamp)
        VALUES (p_point_ids[i], p_values[i], p_qualities[i], p_timestamps[i])
        ON CONFLICT (point_id, timestamp) DO NOTHING;

        IF FOUND THEN
            inserted_count := inserted_count + 1;
        END IF;
    END LOOP;

    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Get metadata effective at a specific time
CREATE OR REPLACE FUNCTION get_effective_point_metadata(
    p_point_id UUID,
    p_at_time TIMESTAMPTZ
) RETURNS TABLE (
    version INTEGER,
    description TEXT,
    engineering_units VARCHAR(50),
    data_type VARCHAR(50),
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    effective_from TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT v.version, v.description, v.engineering_units,
           v.data_type, v.min_value, v.max_value, v.effective_from
    FROM points_metadata_versions v
    WHERE v.point_id = p_point_id
      AND v.effective_from <= p_at_time
    ORDER BY v.version DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get next version number for a point
CREATE OR REPLACE FUNCTION get_next_point_metadata_version(p_point_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_max INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), -1) INTO v_max
    FROM points_metadata_versions
    WHERE point_id = p_point_id;
    RETURN v_max + 1;
END;
$$ LANGUAGE plpgsql;

-- EULA integrity: prevent deleting published versions
CREATE OR REPLACE FUNCTION prevent_eula_version_delete() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.published_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot delete a published EULA version (id: %). Published versions are permanent for legal audit purposes.', OLD.id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- EULA integrity: prevent editing content of published versions
CREATE OR REPLACE FUNCTION prevent_eula_version_content_edit() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.published_at IS NOT NULL AND (NEW.content != OLD.content OR NEW.title != OLD.title) THEN
        RAISE EXCEPTION 'Cannot modify the content or title of a published EULA version (id: %). Create a new version instead.', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- EULA integrity: acceptances are append-only
CREATE OR REPLACE FUNCTION prevent_eula_acceptance_modify() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'EULA acceptance records are append-only and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;
