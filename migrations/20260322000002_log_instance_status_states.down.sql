-- Revert log_instances.status back to old values: pending/completed

-- Step 1: Revert data values
UPDATE log_instances SET status = 'pending'   WHERE status = 'draft';
UPDATE log_instances SET status = 'completed' WHERE status = 'submitted';
-- 'reviewed' has no old equivalent — map back to completed
UPDATE log_instances SET status = 'completed' WHERE status = 'reviewed';

-- Step 2: Drop new CHECK constraint
ALTER TABLE log_instances DROP CONSTRAINT IF EXISTS log_instances_status_check;

-- Step 3: Re-add old CHECK constraint
ALTER TABLE log_instances
    ADD CONSTRAINT log_instances_status_check
    CHECK (status IN ('pending', 'in_progress', 'completed'));

-- Step 4: Restore old default
ALTER TABLE log_instances ALTER COLUMN status SET DEFAULT 'pending';
