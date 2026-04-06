// ---------------------------------------------------------------------------
// Expression Templates
// Pre-built tile arrays for common expression patterns.
// IDs here are stable placeholders; they are replaced with fresh UUIDs when
// a template is loaded into the builder (see ExpressionBuilder RESET_TILES).
// ---------------------------------------------------------------------------

import type { ExpressionTile, ExpressionContext } from "../../types/expression";

export interface ExpressionTemplate {
  id: string;
  name: string;
  description: string;
  category: "Conversion" | "Alarm" | "Statistical" | "Arithmetic";
  contexts: ExpressionContext[];
  tiles: ExpressionTile[];
}

export const EXPRESSION_TEMPLATES: ExpressionTemplate[] = [
  // -------------------------------------------------------------------------
  // Linear Scale: (value − offset) × gain
  // -------------------------------------------------------------------------
  {
    id: "linear-scale",
    name: "Linear Scale",
    description: "(value − offset) × gain",
    category: "Conversion",
    contexts: ["point_config"],
    tiles: [
      {
        id: "ls-group",
        type: "group",
        children: [
          { id: "ls-ref", type: "point_ref" },
          { id: "ls-sub", type: "subtract" },
          { id: "ls-offset", type: "constant", value: 0 },
        ],
      },
      { id: "ls-mul", type: "multiply" },
      { id: "ls-gain", type: "constant", value: 1 },
    ],
  },

  // -------------------------------------------------------------------------
  // Clamp: IF value < min THEN min ELSE IF value > max THEN max ELSE value
  // -------------------------------------------------------------------------
  {
    id: "clamp",
    name: "Clamp to Range",
    description: "Clamp value between min and max",
    category: "Conversion",
    contexts: ["point_config", "widget"],
    tiles: [
      {
        id: "cl-ite",
        type: "if_then_else",
        condition: [
          { id: "cl-ref1", type: "point_ref" },
          { id: "cl-lt", type: "lt" },
          { id: "cl-min", type: "constant", value: 0 },
        ],
        thenBranch: [{ id: "cl-then-min", type: "constant", value: 0 }],
        elseBranch: [
          {
            id: "cl-inner-ite",
            type: "if_then_else",
            condition: [
              { id: "cl-ref2", type: "point_ref" },
              { id: "cl-gt", type: "gt" },
              { id: "cl-max", type: "constant", value: 100 },
            ],
            thenBranch: [{ id: "cl-then-max", type: "constant", value: 100 }],
            elseBranch: [{ id: "cl-else-ref", type: "point_ref" }],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // High Threshold Alarm: value > limit
  // -------------------------------------------------------------------------
  {
    id: "threshold-alarm",
    name: "High Threshold Alarm",
    description: "True when value exceeds limit",
    category: "Alarm",
    contexts: ["alarm_definition"],
    tiles: [
      { id: "ta-ref", type: "point_ref" },
      { id: "ta-gt", type: "gt" },
      { id: "ta-limit", type: "constant", value: 100 },
    ],
  },

  // -------------------------------------------------------------------------
  // Out-of-Range Alarm: (value < low) OR (value > high)
  // -------------------------------------------------------------------------
  {
    id: "range-alarm",
    name: "Out-of-Range Alarm",
    description: "True when value is outside low..high range",
    category: "Alarm",
    contexts: ["alarm_definition"],
    tiles: [
      {
        id: "ra-lo-group",
        type: "group",
        children: [
          { id: "ra-ref1", type: "point_ref" },
          { id: "ra-lt", type: "lt" },
          { id: "ra-low", type: "constant", value: 0 },
        ],
      },
      { id: "ra-or", type: "or" },
      {
        id: "ra-hi-group",
        type: "group",
        children: [
          { id: "ra-ref2", type: "point_ref" },
          { id: "ra-gt", type: "gt" },
          { id: "ra-high", type: "constant", value: 100 },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Deviation Alarm: abs(point_a − point_b) > threshold
  // -------------------------------------------------------------------------
  {
    id: "deviation-alarm",
    name: "Deviation Alarm",
    description: "True when two points differ by more than threshold",
    category: "Alarm",
    contexts: ["alarm_definition"],
    tiles: [
      {
        id: "da-abs",
        type: "abs",
        children: [
          { id: "da-ref-a", type: "point_ref" },
          { id: "da-sub", type: "subtract" },
          { id: "da-ref-b", type: "point_ref" },
        ],
      },
      { id: "da-gt", type: "gt" },
      { id: "da-threshold", type: "constant", value: 10 },
    ],
  },
];
