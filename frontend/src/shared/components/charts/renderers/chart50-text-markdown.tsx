import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import type { ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type TextFormat = "plain" | "markdown";
type TextAlign = "left" | "center" | "right";

export default function Chart50TextMarkdown({ config }: RendererProps) {
  const text = (config.extras?.text as string | undefined) ?? "";
  const format = (config.extras?.format as TextFormat | undefined) ?? "plain";
  const align = (config.extras?.align as TextAlign | undefined) ?? "left";
  const fontSize = (config.extras?.fontSize as number | undefined) ?? 13;

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      wrapperRef.current?.setAttribute("data-chart-ready", "true");
    });
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        flex: 1,
        padding: 8,
        fontSize,
        color: "var(--io-text)",
        textAlign: align,
        overflow: "auto",
        lineHeight: 1.45,
      }}
    >
      {format === "markdown" ? (
        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{text}</ReactMarkdown>
      ) : (
        text.split("\n").map((line, i) => (
          <p key={i} style={{ margin: 0 }}>
            {line}
          </p>
        ))
      )}
    </div>
  );
}
