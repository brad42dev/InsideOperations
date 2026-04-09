/**
 * PointNameLabel — tag name / label display element.
 *
 * Two styles:
 *   hierarchy — "AREA.UNIT.TAG" with each level at a different muted color
 *   uniform   — plain string, all at --io-text-muted (#71717A)
 *
 * Not affected by alarm state. Updates only when point metadata changes.
 */

interface PointNameLabelConfig {
  /** Display style */
  style: "hierarchy" | "uniform";
  /** Override text — if not set, falls back to tagname prop */
  staticText?: string;
}

interface Props {
  config: PointNameLabelConfig;
  /** Tag name string, e.g. "AREA.UNIT.PT_TAG" */
  tagname?: string;
  x?: number;
  y?: number;
}

// ISA hierarchy level colors (most-muted → most-prominent)
const AREA_COLOR = "#52525B"; // system / area level
const UNIT_COLOR = "#71717A"; // unit level
const TAG_COLOR = "#A1A1AA"; // tag (most prominent)
const SEP_COLOR = "#3F3F46"; // dot separator

export function PointNameLabel({ config, tagname, x = 0, y = 0 }: Props) {
  const text = config.staticText ?? tagname ?? "";

  if (config.style === "hierarchy" && text.includes(".")) {
    const parts = text.split(".");
    const last = parts.length - 1;
    const secondLast = parts.length - 2;

    const spans: JSX.Element[] = [];
    parts.forEach((part, i) => {
      if (i > 0) {
        spans.push(
          <tspan key={`sep-${i}`} fill={SEP_COLOR}>
            .
          </tspan>,
        );
      }
      const color =
        i === last ? TAG_COLOR : i === secondLast ? UNIT_COLOR : AREA_COLOR;
      spans.push(
        <tspan key={`part-${i}`} fill={color}>
          {part}
        </tspan>,
      );
    });

    return (
      <g
        className="io-display-element"
        data-type="point_name_label"
        transform={`translate(${x},${y})`}
      >
        <text
          x={0}
          y={0}
          fontFamily="Inter"
          fontSize={9}
          dominantBaseline="hanging"
        >
          {spans}
        </text>
      </g>
    );
  }

  // Uniform style — single muted string
  return (
    <g
      className="io-display-element"
      data-type="point_name_label"
      transform={`translate(${x},${y})`}
    >
      <text
        x={0}
        y={0}
        fontFamily="Inter"
        fontSize={9}
        fill={UNIT_COLOR}
        dominantBaseline="hanging"
      >
        {text}
      </text>
    </g>
  );
}
