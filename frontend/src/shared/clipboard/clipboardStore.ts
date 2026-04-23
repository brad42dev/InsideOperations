import { create } from "zustand";
import type { IOClipboardPayload } from "./types";
import { isIOClipboardPayload, isLegacyDesignerClipboard } from "./types";
import { migrateLegacyClipboard } from "./migrateLegacyClipboard";

interface ClipboardStoreState {
  current: IOClipboardPayload | null;
  previous: IOClipboardPayload | null;

  writeToClipboard(payload: IOClipboardPayload): Promise<void>;
  readFromSystemClipboard(): Promise<IOClipboardPayload | null>;
  getCurrent(): IOClipboardPayload | null;
  getPrevious(): IOClipboardPayload | null;
  clear(): void;
}

export const useIOClipboardStore = create<ClipboardStoreState>((set, get) => ({
  current: null,
  previous: null,

  async writeToClipboard(payload) {
    set((s) => ({ previous: s.current, current: payload }));
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
    } catch {
      // swallow — in-memory slot still holds the payload
    }
  },

  async readFromSystemClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return null;
      }
      if (isIOClipboardPayload(parsed)) return parsed;
      if (isLegacyDesignerClipboard(parsed)) return migrateLegacyClipboard(parsed);
      return null;
    } catch {
      return get().current;
    }
  },

  getCurrent() {
    return get().current;
  },

  getPrevious() {
    return get().previous;
  },

  clear() {
    set({ current: null, previous: null });
  },
}));
