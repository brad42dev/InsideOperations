// Alarm priority colors — ISA-18.2, theme-independent (never change)
export const ALARM_COLORS: Record<number, string> = {
  1: "var(--io-alarm-urgent,     #EF4444)", // P1 Urgent
  2: "var(--io-alarm-high,       #F97316)", // P2 High
  3: "var(--io-alarm-low,        #EAB308)", // P3 Low
  4: "var(--io-alarm-diagnostic, #F4F4F5)", // P4 Diagnostic
  5: "var(--io-alarm-custom,     #60A5FA)", // Custom
};

// Analog bar zone colors — muted warm-to-cool ramp, theme-aware for light
export const ZONE_FILLS = {
  hh: "var(--io-zone-hh, #5C3A3A)",
  h: "var(--io-zone-h, #5C4A32)",
  normal: "var(--io-display-zone-normal, #404048)",
  l: "var(--io-zone-l, #32445C)",
  ll: "var(--io-zone-ll, #2E3A5C)",
};

// Surface / text tokens — these vary by theme
export const DE_COLORS = {
  surfaceElevated: "var(--io-surface-elevated, #27272A)",
  textPrimary: "var(--io-text-primary,     #F9FAFB)",
  textSecondary: "var(--io-text-secondary,   #A1A1AA)",
  textMuted: "var(--io-text-muted,        #71717A)",
  border: "var(--io-border,            #3F3F46)",
  borderStrong: "var(--io-border-strong,     #52525B)",
  displayZoneInactive: "var(--io-display-zone-inactive, #3F3F46)",
  accent: "var(--io-accent,            #2DD4BF)",
  equipStroke: "var(--equip-stroke,         #808080)",
  manualBadge: "var(--io-accent,            #06B6D4)",
  textStale: "var(--io-text-stale,        #636363)",
  alarmShelved: "var(--io-alarm-shelved,    #D946EF)",
  alarmDisabled: "var(--io-alarm-disabled,  #52525B)",
};
