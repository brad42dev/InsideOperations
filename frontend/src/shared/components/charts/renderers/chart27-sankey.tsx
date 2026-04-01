// ---------------------------------------------------------------------------
// Chart 27 — Sankey Diagram
// Uses extras.nodes and extras.links for manual definition.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "../EChart";
import { type ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

interface SankeyNode {
  name: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

export default function SankeyChart({ config }: RendererProps) {
  const rawNodes = config.extras?.nodes;
  const rawLinks = config.extras?.links;

  const nodes: SankeyNode[] = Array.isArray(rawNodes)
    ? (rawNodes as SankeyNode[])
    : [];
  const links: SankeyLink[] = Array.isArray(rawLinks)
    ? (rawLinks as SankeyLink[])
    : [];

  const hasData = nodes.length > 0 && links.length > 0;

  const option: EChartsOption = useMemo(() => {
    const textMuted = resolveToken("--io-text-muted");

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove",
      },
      series: [
        {
          type: "sankey",
          data: nodes,
          links,
          emphasis: { focus: "adjacency" },
          lineStyle: { color: "gradient", curveness: 0.5 },
          label: {
            color: textMuted,
            fontSize: 11,
          },
          nodeAlign:
            (config.extras?.nodeAlign as "justify" | "left" | "right") ??
            "justify",
          layoutIterations: 32,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links]);

  if (!hasData) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 13,
          gap: 6,
          padding: 16,
          textAlign: "center",
        }}
      >
        <span>Define nodes and links in the Options panel.</span>
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          extras.nodes: [{`{name: "A"}, {name: "B"}`}]<br />
          extras.links: [{`{source: "A", target: "B", value: 10}`}]
        </span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%" }}>
      <EChart option={option} />
    </div>
  );
}
