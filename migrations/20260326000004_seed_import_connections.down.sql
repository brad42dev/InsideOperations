-- Reverse seed: remove sample import connections and definition
DELETE FROM import_definitions  WHERE id = '00000000-0000-0000-0002-000000000001';
DELETE FROM import_connections  WHERE id IN (
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0001-000000000002'
);
