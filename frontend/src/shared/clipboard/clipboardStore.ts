import { create } from "zustand";
import type { IOClipboardPayload } from "./types";
import { isIOClipboardPayload, isLegacyDesignerClipboard } from "./types";
import { migrateLegacyClipboard } from "./migrateLegacyClipboard";

const PREV_KEY = "io-clipboard-prev";
// Soft cap on what we persist — string char count (UTF-16), not bytes.
// Large graphic payloads are excluded to avoid bloating sessionStorage.
const MAX_PERSIST_CHARS = 512_000;

function loadPrevious(): IOClipboardPayload | null {
  try {
    const raw = sessionStorage.getItem(PREV_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isIOClipboardPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistPrevious(payload: IOClipboardPayload | null): void {
  try {
    if (!payload) {
      sessionStorage.removeItem(PREV_KEY);
      return;
    }
    const serialized = JSON.stringify(payload);
    if (serialized.length <= MAX_PERSIST_CHARS) {
      sessionStorage.setItem(PREV_KEY, serialized);
    }
  } catch {
    // ignore QuotaExceededError and other storage errors
  }
}

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
  previous: loadPrevious(),

  async writeToClipboard(payload) {
    const { current: prev, previous: existingPrev } = get();
    // Preserve the existing previous slot when current is null (e.g. first copy
    // after a session reload where previous was hydrated from sessionStorage but
    // current hasn't been set yet).
    const newPrevious = prev ?? existingPrev;
    set({ previous: newPrevious, current: payload });
    persistPrevious(newPrevious);
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
      if (isLegacyDesignerClipboard(parsed))
        return migrateLegacyClipboard(parsed);
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
    try {
      sessionStorage.removeItem(PREV_KEY);
    } catch {
      // ignore
    }
  },
}));
