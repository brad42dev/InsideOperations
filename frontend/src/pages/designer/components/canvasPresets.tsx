/**
 * Shared canvas sizing presets and UI for the New Graphic dialog and
 * Canvas Properties dialog.
 */

// ---------------------------------------------------------------------------
// Aspect presets
// ---------------------------------------------------------------------------

export interface AspectPreset {
  label: string;
  width: number;
  height: number;
  reportOnly?: boolean;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { label: "720p", width: 1280, height: 720 },
  { label: "1080p", width: 1920, height: 1080 },
  { label: "1440p", width: 2560, height: 1440 },
  { label: "4K", width: 3840, height: 2160 },
  { label: "16:10 M", width: 1920, height: 1200 },
  { label: "16:10 L", width: 2560, height: 1600 },
  { label: "4:3 Std", width: 1024, height: 768 },
  { label: "4:3 Lg", width: 1600, height: 1200 },
  { label: "Ultrawide", width: 3440, height: 1440 },
  { label: "Super-UW", width: 5120, height: 1440 },
  { label: "A4 Portrait", width: 794, height: 1123, reportOnly: true },
  { label: "A4 Landscape", width: 1123, height: 794, reportOnly: true },
  { label: "Letter Portrait", width: 816, height: 1056, reportOnly: true },
  { label: "Letter Landscape", width: 1056, height: 816, reportOnly: true },
];

// ---------------------------------------------------------------------------
// Chain-link SVG icon for proportional lock toggle
// ---------------------------------------------------------------------------

export function ChainLinkIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      {locked ? (
        // Closed chain: two ovals linked
        <>
          <rect
            x="1"
            y="5"
            width="4"
            height="4"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="9"
            y="5"
            width="4"
            height="4"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="5"
            y1="7"
            x2="9"
            y2="7"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </>
      ) : (
        // Open chain: two ovals unlinked with a gap
        <>
          <rect
            x="1"
            y="5"
            width="4"
            height="4"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="9"
            y="5"
            width="4"
            height="4"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="5"
            y1="7"
            x2="6.5"
            y2="7"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="7.5"
            y1="7"
            x2="9"
            y2="7"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </>
      )}
    </svg>
  );
}
