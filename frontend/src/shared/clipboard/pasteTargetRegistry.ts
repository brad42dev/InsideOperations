import type {
  IOClipboardPayload,
  PasteMode,
  PasteTarget,
  SelectionZoneId,
} from "./types";

const targets = new Map<string, PasteTarget>();

export function registerPasteTarget(target: PasteTarget): () => void {
  targets.set(target.id, target);
  return () => {
    if (targets.get(target.id) === target) targets.delete(target.id);
  };
}

export function findTargetForZone(zoneId: SelectionZoneId): PasteTarget | null {
  let best: PasteTarget | null = null;
  for (const t of targets.values()) {
    if (t.zoneId !== zoneId) continue;
    if (!best || t.priority > best.priority) best = t;
  }
  return best;
}

export function listTargetsForZone(zoneId: SelectionZoneId): PasteTarget[] {
  return Array.from(targets.values())
    .filter((t) => t.zoneId === zoneId)
    .sort((a, b) => b.priority - a.priority);
}

export function resolveModes(
  target: PasteTarget,
  payload: IOClipboardPayload | null,
): PasteMode[] {
  return target.accepts(payload);
}

export function pickDefaultMode(
  target: PasteTarget,
  payload: IOClipboardPayload | null,
): PasteMode | null {
  const modes = target.accepts(payload);
  return modes[0] ?? null;
}
