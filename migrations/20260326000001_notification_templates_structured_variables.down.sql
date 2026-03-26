-- Revert notification_templates.variables from JSONB back to TEXT[].

-- Step 1: Rename new column, add old TEXT[] column
ALTER TABLE notification_templates
    RENAME COLUMN variables TO variables_new;

ALTER TABLE notification_templates
    ADD COLUMN variables TEXT[] NOT NULL DEFAULT '{}';

-- Step 2: Migrate data back — extract names from JSONB objects back to TEXT[] array
UPDATE notification_templates
    SET variables = (
        SELECT array_agg(var->>'name')
        FROM jsonb_array_elements(variables_new) AS var
        WHERE var->>'name' IS NOT NULL
    )
    WHERE variables_new IS NOT NULL AND jsonb_array_length(variables_new) > 0;

-- Step 3: Drop new column
ALTER TABLE notification_templates
    DROP COLUMN variables_new;
