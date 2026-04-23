import type { IOClipboardContents } from "@/shared/clipboard";

const _store = new Map<string, IOClipboardContents>();

export function registerTemporaryContents(
  paneId: string,
  contents: IOClipboardContents,
): void {
  _store.set(paneId, contents);
}

export function getTemporaryContents(
  paneId: string,
): IOClipboardContents | undefined {
  return _store.get(paneId);
}

export function clearTemporaryContents(paneId: string): void {
  _store.delete(paneId);
}
