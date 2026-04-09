/**
 * Shared SVG defs for the I/O graphics canvas.
 *
 * SharedSvgDefs must be rendered once per canvas, inside the root <svg>
 * element, before any display elements. Display elements that reference
 * patterns or filters defined here use the exported URL constants.
 */

/** fill="url(#bad-phase1-hatch)" — 45° diagonal hatch for BadPhase1 data quality overlay */
export const BAD_PHASE1_HATCH_URL = "url(#bad-phase1-hatch)";

/**
 * Renders the shared <defs> block for the I/O canvas.
 * Place this once as the first child of the root <svg>.
 */
export function SharedSvgDefs() {
  return (
    <defs>
      {/* BadPhase1 data quality overlay — 45° diagonal hatch, 4×4px, #808080 @ 40% */}
      <pattern
        id="bad-phase1-hatch"
        patternUnits="userSpaceOnUse"
        width={4}
        height={4}
      >
        <path
          d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2"
          stroke="#808080"
          strokeWidth={0.75}
          strokeOpacity={0.4}
        />
      </pattern>
    </defs>
  );
}
