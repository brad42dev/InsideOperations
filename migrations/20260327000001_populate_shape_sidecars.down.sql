-- Reverse: remove sidecar from shapes that were updated by the up migration.
-- (Only removes sidecar from shapes that previously had none, not from the pre-existing ones.)
UPDATE design_objects
SET metadata = metadata - 'sidecar'
WHERE type IN ('shape', 'shape_part')
  AND metadata->>'source' = 'library'
  AND metadata->>'shape_id' IN (
    'agitator-anchor','agitator-helical','agitator-paddle','agitator-propeller','agitator-turbine',
    'alarm-annunciator','alarm-annunciator-opt2',
    'column-distillation','column-distillation-narrow','column-distillation-packed',
    'column-distillation-trayed-10','column-distillation-trayed','column-distillation-wide',
    'filter','filter-vacuum',
    'air-cooler','heater-fired-opt1','hx-plate-opt1','hx-shell-tube-opt1',
    'interlock','interlock-opt2','interlock-sis',
    'instrument-behind-panel','instrument-field','instrument-panel',
    'mixer','mixer-inline','mixer-motor',
    'motor-opt1','motor-opt2',
    'pump-centrifugal-opt1','pump-centrifugal-opt2','pump-positive-displacement-opt1','pump-positive-displacement-opt2',
    'reactor','reactor-closed','reactor-flat-top','reactor-trayed',
    'tank-storage-capsule','tank-storage-cone-roof','tank-storage-dome-roof',
    'tank-storage-floating-roof','tank-storage-open-top','tank-storage-sphere',
    'valve-ball','valve-butterfly','valve-control','valve-gate','valve-globe','valve-relief',
    'vessel-horizontal','vessel-horizontal-flanged','vessel-horizontal-flanged-left','vessel-horizontal-flanged-right',
    'vessel-vertical','vessel-vertical-flanged','vessel-vertical-flanged-bottom','vessel-vertical-flanged-top',
    'column-distillation-narrow-trayed','column-distillation-wide-trayed',
    'compressor-opt1','compressor-opt2','fan-blower-opt1','fan-blower-opt2',
    'hx-plate','hx-shell-tube'
  );
