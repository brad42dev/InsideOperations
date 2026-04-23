import * as ContextMenu from "@radix-ui/react-context-menu";
import { useEffect, useState } from "react";
import { useIOClipboardStore } from "./clipboardStore";
import { findTargetForZone } from "./pasteTargetRegistry";
import { usePasteEngine } from "./usePasteEngine";
import type { IOClipboardPayload, PasteMode, SelectionZoneId } from "./types";

interface Props {
  zoneId: SelectionZoneId;
  onCopy: () => void;
  onCut?: () => void;
  children?: React.ReactNode;
}

const PASTE_AS_ORDER: { mode: PasteMode; label: string }[] = [
  { mode: "points", label: "Points" },
  { mode: "shapes", label: "Shapes" },
  { mode: "style", label: "Style" },
  { mode: "style+layout", label: "Style + Layout" },
  { mode: "table", label: "Table" },
  { mode: "text", label: "Text" },
  { mode: "new-graphic", label: "New Graphic" },
  { mode: "temporary-graphic", label: "Temporary Graphic" },
  { mode: "most-recent-alarms", label: "Most Recent Alarm(s)" },
];

export function ClipboardContextMenu({ zoneId, onCopy, onCut, children }: Props) {
  const [currentPayload, setCurrentPayload] = useState<IOClipboardPayload | null>(null);
  const previous = useIOClipboardStore((s) => s.previous);
  const { pasteDefault, pastePrevious, pasteAs } = usePasteEngine();

  useEffect(() => {
    void useIOClipboardStore
      .getState()
      .readFromSystemClipboard()
      .then(setCurrentPayload);
  }, []);

  const target = findTargetForZone(zoneId);
  const currentModes = target && currentPayload ? target.accepts(currentPayload) : [];
  const previousModes = target && previous ? target.accepts(previous) : [];

  const pasteDisabled = !target || !currentPayload || currentModes.length === 0;
  const pastePrevDisabled = !target || !previous || previousModes.length === 0;

  return (
    <ContextMenu.Content className="io-context-menu">
      <ContextMenu.Item onSelect={() => onCut?.()} disabled={!onCut}>
        Cut <span className="shortcut">Ctrl+X</span>
      </ContextMenu.Item>
      <ContextMenu.Item onSelect={onCopy}>
        Copy <span className="shortcut">Ctrl+C</span>
      </ContextMenu.Item>
      <ContextMenu.Item
        onSelect={() => void pasteDefault()}
        disabled={pasteDisabled}
        title={pasteDisabled ? rejectionText(target, currentPayload) : undefined}
      >
        Paste <span className="shortcut">Ctrl+V</span>
      </ContextMenu.Item>
      <ContextMenu.Item
        onSelect={() => void pastePrevious()}
        disabled={pastePrevDisabled}
        title={pastePrevDisabled ? rejectionText(target, previous) : undefined}
      >
        Paste Previous <span className="shortcut">Ctrl+Alt+V</span>
      </ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger>Paste as…</ContextMenu.SubTrigger>
        <ContextMenu.SubContent>
          {PASTE_AS_ORDER.map(({ mode, label }) => {
            const available = currentModes.includes(mode);
            return (
              <ContextMenu.Item
                key={mode}
                disabled={!available}
                onSelect={() => void pasteAs(mode, "current")}
                title={
                  !available
                    ? `Clipboard has no ${label.toLowerCase()} data`
                    : undefined
                }
              >
                {label}
              </ContextMenu.Item>
            );
          })}
        </ContextMenu.SubContent>
      </ContextMenu.Sub>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger disabled={!previous}>
          Paste Previous as…
        </ContextMenu.SubTrigger>
        <ContextMenu.SubContent>
          {PASTE_AS_ORDER.map(({ mode, label }) => {
            const available = previousModes.includes(mode);
            return (
              <ContextMenu.Item
                key={mode}
                disabled={!available}
                onSelect={() => void pasteAs(mode, "previous")}
              >
                {label}
              </ContextMenu.Item>
            );
          })}
        </ContextMenu.SubContent>
      </ContextMenu.Sub>
      {children ? (
        <>
          <ContextMenu.Separator />
          {children}
        </>
      ) : null}
    </ContextMenu.Content>
  );
}

function rejectionText(
  target: ReturnType<typeof findTargetForZone>,
  payload: IOClipboardPayload | null,
): string {
  if (!payload) return "Clipboard is empty";
  if (!target) return "Nothing here accepts a paste";
  const custom = target.describeRejection?.(payload);
  return custom ?? "Clipboard contains no usable data for this target";
}
