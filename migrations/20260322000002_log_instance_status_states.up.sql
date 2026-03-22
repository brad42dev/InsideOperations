-- Align log_instances.status with spec lifecycle:
--   draft → in_progress → submitted → reviewed
-- Replaces old values: pending → draft, completed → submitted

-- Step 1: Rename existing data values before altering the constraint
UPDATE log_instances SET status = 'draft'     WHERE status = 'pending';
UPDATE log_instances SET status = 'submitted' WHERE status = 'completed';

-- Step 2: Drop old CHECK constraint
ALTER TABLE log_instances DROP CONSTRAINT IF EXISTS log_instances_status_check;

-- Step 3: Add new CHECK constraint with correct values
ALTER TABLE log_instances
    ADD CONSTRAINT log_instances_status_check
    CHECK (status IN ('draft', 'in_progress', 'submitted', 'reviewed'));

-- Step 4: Update default to 'draft'
ALTER TABLE log_instances ALTER COLUMN status SET DEFAULT 'draft';
