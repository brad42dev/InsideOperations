-- Revert to the original 4-value constraint.
ALTER TABLE custom_expressions
    DROP CONSTRAINT IF EXISTS custom_expressions_expression_context_check;

ALTER TABLE custom_expressions
    ADD CONSTRAINT custom_expressions_expression_context_check
    CHECK (expression_context IN (
        'conversion',
        'calculated_value',
        'alarm_condition',
        'custom'
    ));
