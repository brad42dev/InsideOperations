# Phase 06a — Content Widgets: Text and Header (chart50, chart51)

**Goal:** Implement two simple content widgets — chart50 (Text/Markdown) and chart51 (Header/Divider). Neither has data points.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phase 04 must be complete.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartRenderer.tsx` — Phase 00 left chart50 and chart51 commented.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-definitions.ts` — chart50 and chart51 stubs (`available: false`) from Phase 00.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-defaults.ts` — `makeDefaultChartConfig` already returns sensible defaults for 50 and 51 (Phase 01).
- `/home/io/io-dev/io/frontend/package.json` — check whether `react-markdown` and `rehype-sanitize` are already deps.

## Context

Content widgets render no data — just static text or styling. They live in the chart system because they're placeable in graphics like any widget; reusing `WidgetNode` + `ChartConfig` keeps the architecture consistent. `requiresPoints: false` is set on their `ChartDefinition` so the right panel hides the Points tab (Phase 03).

- **chart50 — Text / Markdown**: renders `extras.text`. `extras.format: "plain" | "markdown"`. Plain mode just renders the text in a styled paragraph. Markdown mode uses `react-markdown` + `rehype-sanitize` (XSS protection — never raw HTML). Configurable `align: "left" | "center" | "right"` and `fontSize?: number`.
- **chart51 — Header / Divider**: renders `extras.text` as an H1/H2/H3 styled header with optional `color` and `align`. Underline below for visual divider effect.

## Changes

### 1. Verify / add dependencies

```bash
cd /home/io/io-dev/io/frontend
grep -E '"react-markdown"|"rehype-sanitize"' package.json
```

If missing, add via pnpm. Both are MIT-licensed (compatible with the project's licensing rule — verify on their npm pages):

```bash
pnpm add react-markdown rehype-sanitize
```

Note: confirm on npm/GitHub that `react-markdown` is MIT and `rehype-sanitize` is MIT before adding. They are at the time of writing.

### 2. Create `frontend/src/shared/components/charts/renderers/chart50-text-markdown.tsx`

```tsx
// ---------------------------------------------------------------------------
// Chart 50 — Text / Markdown
// Static text with optional markdown rendering. No point data.
// ---------------------------------------------------------------------------

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
```

### 3. Create `frontend/src/shared/components/charts/renderers/chart51-header-divider.tsx`

```tsx
// ---------------------------------------------------------------------------
// Chart 51 — Header / Divider
// Section header with configurable level and underline.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import type { ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type Level = 1 | 2 | 3;

export default function Chart51HeaderDivider({ config }: RendererProps) {
  const text = (config.extras?.text as string | undefined) ?? "Section";
  const level = (config.extras?.level as Level | undefined) ?? 2;
  const color = (config.extras?.color as string | undefined) ?? "var(--io-text)";
  const align = (config.extras?.align as "left" | "center" | "right" | undefined) ?? "left";

  const fontSize = level === 1 ? 22 : level === 2 ? 18 : 14;
  const fontWeight = level === 1 ? 700 : level === 2 ? 600 : 600;

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
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: align,
        borderBottom: "1px solid var(--io-border)",
      }}
    >
      <div style={{ fontSize, fontWeight, color }}>{text}</div>
    </div>
  );
}
```

### 4. `frontend/src/shared/components/charts/ChartRenderer.tsx`

Uncomment chart50 and chart51 entries:

```ts
50: lazy(() => import("./renderers/chart50-text-markdown")),
51: lazy(() => import("./renderers/chart51-header-divider")),
```

### 5. `frontend/src/shared/components/charts/chart-definitions.ts`

Set `available: true` on the chart50 and chart51 stubs.

### 6. `frontend/src/shared/components/charts/ChartOptionsForm.tsx`

**For chart50:**

```tsx
if (config.chartType === 50) {
  return (
    <div>
      <Field label="Format">
        <Select
          value={(config.extras?.format as string | undefined) ?? "plain"}
          onChange={(v) =>
            onChange({ ...config, extras: { ...config.extras, format: v as "plain" | "markdown" } })
          }
          options={[
            { value: "plain", label: "Plain Text" },
            { value: "markdown", label: "Markdown" },
          ]}
        />
      </Field>
      <Field label="Text">
        <TextArea
          value={(config.extras?.text as string | undefined) ?? ""}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, text: v } })}
          rows={6}
          placeholder={(config.extras?.format as string | undefined) === "markdown" ? "## Markdown supported" : "Enter text…"}
        />
      </Field>
      <Field label="Alignment">
        <Select
          value={(config.extras?.align as string | undefined) ?? "left"}
          onChange={(v) =>
            onChange({ ...config, extras: { ...config.extras, align: v as "left" | "center" | "right" } })
          }
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
        />
      </Field>
      <Field label="Font Size (px)">
        <NumberInput
          value={(config.extras?.fontSize as number | undefined) ?? 13}
          min={8}
          max={72}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, fontSize: v } })}
        />
      </Field>
    </div>
  );
}
```

**For chart51:**

```tsx
if (config.chartType === 51) {
  return (
    <div>
      <Field label="Text">
        <TextInput
          value={(config.extras?.text as string | undefined) ?? "Section"}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, text: v } })}
        />
      </Field>
      <Field label="Level">
        <Select
          value={String((config.extras?.level as number | undefined) ?? 2)}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, level: Number(v) } })}
          options={[
            { value: "1", label: "Heading 1 (largest)" },
            { value: "2", label: "Heading 2" },
            { value: "3", label: "Heading 3" },
          ]}
        />
      </Field>
      <Field label="Color">
        <ColorInput
          value={(config.extras?.color as string | undefined) ?? "var(--io-text)"}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, color: v } })}
        />
      </Field>
      <Field label="Alignment">
        <Select
          value={(config.extras?.align as string | undefined) ?? "left"}
          onChange={(v) =>
            onChange({ ...config, extras: { ...config.extras, align: v as "left" | "center" | "right" } })
          }
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
        />
      </Field>
    </div>
  );
}
```

`TextArea`, `TextInput`, `ColorInput`, `Select`, `NumberInput`, `Field` should be reused from existing components in the form file. Match the surrounding style.

## Gotchas

- **react-markdown XSS**: always pass `rehypeSanitize` so user-entered markdown can't inject scripts. Not optional.
- **Empty text**: render an empty container, not a noisy placeholder. The user sees an empty box and clicks to configure.
- **Designer pointer-events**: in designer, the wrapper has `pointerEvents: none` (Phase 02). User edits text via the right panel, not by clicking the rendered text. That's fine.
- **Markdown deps licensing**: confirm MIT before merging. If any dep is non-MIT/Apache/BSD, find an alternative.
- **`pnpm test` + `pnpm build`** required.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` clean; `pnpm build` and `pnpm test` clean.
2. **Manual:** Place a Text widget. Right panel hides the Points tab (Phase 03 requirement).
3. Type some text in Options — chart updates after 250ms.
4. Switch to Markdown format and enter `## Hello\n\nThis is **bold**` — renders bold and a heading.
5. Place a Header widget. Set level to 1 — large bold heading. Color picker changes the color.
6. Saved config round-trip works.
7. Palette shows Text and Header tiles in the "Content" category (Phase 04 grouping).

## Phase dependencies

- **Depends on:** Phase 04.
- **Gates:** Nothing critical.
