-- Change notification_templates.variables from TEXT[] to JSONB with structured variable definitions.
-- Spec DD-31: variables must be {name, label, required, default_value}.

-- Step 1: Rename old column, add new JSONB column
ALTER TABLE notification_templates
    RENAME COLUMN variables TO variables_old;

ALTER TABLE notification_templates
    ADD COLUMN variables JSONB NOT NULL DEFAULT '[]';

-- Step 2: Migrate data — convert TEXT[] to structured JSONB objects
-- For known templates, use human-readable labels and proper required flags.
UPDATE notification_templates SET variables = jsonb_build_array(
    jsonb_build_object('name', 'location', 'label', 'Fire Location', 'required', true, 'default_value', '')
) WHERE name = 'Fire Alarm';

UPDATE notification_templates SET variables = jsonb_build_array(
    jsonb_build_object('name', 'location', 'label', 'Incident Location', 'required', true, 'default_value', '')
) WHERE name = 'Gas Leak';

UPDATE notification_templates SET variables = jsonb_build_array(
    jsonb_build_object('name', 'reason', 'label', 'Reason for Shelter-in-Place', 'required', true, 'default_value', '')
) WHERE name = 'Shelter in Place';

UPDATE notification_templates SET variables = jsonb_build_array(
    jsonb_build_object('name', 'area', 'label', 'Evacuation Area', 'required', true, 'default_value', '')
) WHERE name = 'Evacuation Order';

UPDATE notification_templates SET variables = jsonb_build_array(
    jsonb_build_object('name', 'incident', 'label', 'Incident Type', 'required', true, 'default_value', ''),
    jsonb_build_object('name', 'location', 'label', 'Location', 'required', true, 'default_value', '')
) WHERE name = 'All Clear';

UPDATE notification_templates SET variables = jsonb_build_array(
    jsonb_build_object('name', 'unit_name', 'label', 'Unit Name', 'required', true, 'default_value', ''),
    jsonb_build_object('name', 'time', 'label', 'Trip Time', 'required', false, 'default_value', ''),
    jsonb_build_object('name', 'cause', 'label', 'Cause of Trip', 'required', true, 'default_value', '')
) WHERE name = 'Unit Trip';

UPDATE notification_templates SET variables = jsonb_build_array(
    jsonb_build_object('name', 'shift_name', 'label', 'Shift Name', 'required', true, 'default_value', ''),
    jsonb_build_object('name', 'message', 'label', 'Announcement Message', 'required', true, 'default_value', '')
) WHERE name = 'Shift Announcement';

UPDATE notification_templates SET variables = jsonb_build_array(
    jsonb_build_object('name', 'bulletin_title', 'label', 'Bulletin Title', 'required', true, 'default_value', ''),
    jsonb_build_object('name', 'bulletin_body', 'label', 'Bulletin Body', 'required', true, 'default_value', ''),
    jsonb_build_object('name', 'issued_by', 'label', 'Issued By', 'required', true, 'default_value', '')
) WHERE name = 'Safety Bulletin';

UPDATE notification_templates SET variables = jsonb_build_array(
    jsonb_build_object('name', 'system_name', 'label', 'System Name', 'required', true, 'default_value', ''),
    jsonb_build_object('name', 'date', 'label', 'Outage Date', 'required', true, 'default_value', ''),
    jsonb_build_object('name', 'start_time', 'label', 'Start Time', 'required', true, 'default_value', ''),
    jsonb_build_object('name', 'end_time', 'label', 'End Time', 'required', true, 'default_value', ''),
    jsonb_build_object('name', 'affected_systems', 'label', 'Affected Systems', 'required', false, 'default_value', ''),
    jsonb_build_object('name', 'contact_person', 'label', 'Contact Person', 'required', false, 'default_value', '')
) WHERE name = 'Planned Outage Notice';

UPDATE notification_templates SET variables = jsonb_build_array(
    jsonb_build_object('name', 'title', 'label', 'Title', 'required', true, 'default_value', ''),
    jsonb_build_object('name', 'message', 'label', 'Message', 'required', true, 'default_value', '')
) WHERE name = 'Custom Alert';

-- For any other custom templates created by users, use a generic conversion
UPDATE notification_templates
    SET variables = (
        SELECT jsonb_agg(
            jsonb_build_object(
                'name', var_name,
                'label', initcap(replace(var_name, '_', ' ')),
                'required', false,
                'default_value', ''
            )
        )
        FROM (
            SELECT DISTINCT unnest(variables_old) AS var_name
            WHERE variables_old IS NOT NULL AND array_length(variables_old, 1) > 0
        ) sub
    )
    WHERE variables_old IS NOT NULL AND array_length(variables_old, 1) > 0 AND variables = '[]'::JSONB;

-- Step 3: Drop old column
ALTER TABLE notification_templates
    DROP COLUMN variables_old;
