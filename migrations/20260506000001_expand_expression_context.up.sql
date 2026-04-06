-- Expand the expression_context CHECK constraint to include all frontend context values.
-- The original constraint only allowed 4 legacy values; the expression builder UI uses
-- point_config, alarm_definition, rounds_checkpoint, log_segment, widget, and forensics.
ALTER TABLE custom_expressions
    DROP CONSTRAINT IF EXISTS custom_expressions_expression_context_check;

ALTER TABLE custom_expressions
    ADD CONSTRAINT custom_expressions_expression_context_check
    CHECK (expression_context IN (
        'conversion',
        'calculated_value',
        'alarm_condition',
        'custom',
        'point_config',
        'alarm_definition',
        'rounds_checkpoint',
        'log_segment',
        'widget',
        'forensics'
    ));
