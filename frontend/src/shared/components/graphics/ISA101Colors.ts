// Equipment state colors (ISA-101 gray-is-normal)
export const ISA101 = {
  NORMAL: '#808080',     // equipment in normal/idle state
  RUNNING: '#4A9EFF',   // in service / running (blue)
  STOPPED: '#808080',   // stopped / idle (same as normal)
  FAULT: '#EF4444',     // fault / failed (red)
  WARNING: '#F59E0B',   // warning / degraded (amber)

  // Alarm priority colors (ISA-18.2)
  ALARM_CRITICAL: '#FF0000',  // critical / safety (red)
  ALARM_HIGH: '#FF8C00',      // high priority (orange)
  ALARM_MEDIUM: '#FFD700',    // medium priority (yellow)
  ALARM_LOW: '#00BFFF',       // low priority (cyan/blue)

  // Pipe service type colors (ASME A13.1-inspired, desaturated)
  PIPE_PROCESS: '#6B8CAE',
  PIPE_GAS: '#B8926A',
  PIPE_STEAM: '#9CA3AF',
  PIPE_WATER: '#5B9EA6',
  PIPE_FUEL_GAS: '#C4A95A',
  PIPE_CHEMICAL: '#9B7CB8',
  PIPE_INSTRUMENT_AIR: '#7A9B7A',
  PIPE_DRAIN: '#8B7355',
} as const
