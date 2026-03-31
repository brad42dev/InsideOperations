/**
 * Shell-level store for pinned PointDetailPanel instances.
 *
 * Pinned panels survive navigation — they are rendered by App.tsx (outside
 * the route outlet) so they are never unmounted when the user navigates away
 * from Console or Process.
 *
 * The store holds at most 3 concurrent pinned panels (spec §7.2).
 */
import { create } from "zustand";

export interface PinnedPanel {
  /** Stable identity key (crypto.randomUUID()) */
  id: string;
  /** OPC / archive point ID */
  pointId: string;
  /** Anchor position used when the panel was opened (for initial placement) */
  anchorPosition?: { x: number; y: number };
}

interface PointDetailState {
  pinnedPanels: PinnedPanel[];

  /** Pin a point detail panel so it survives navigation. */
  pinPanel: (panel: PinnedPanel) => void;

  /** Unpin (remove) a panel by its stable ID. */
  unpinPanel: (id: string) => void;
}

const MAX_PINNED = 3;

export const usePointDetailStore = create<PointDetailState>((set) => ({
  pinnedPanels: restorePinnedFromSession(),

  pinPanel: (panel) =>
    set((state) => {
      // Don't duplicate same pointId
      if (state.pinnedPanels.some((p) => p.pointId === panel.pointId)) {
        return state;
      }
      const next =
        state.pinnedPanels.length >= MAX_PINNED
          ? state.pinnedPanels.slice(1)
          : state.pinnedPanels;
      const updated = [...next, panel];
      savePinnedToSession(updated);
      return { pinnedPanels: updated };
    }),

  unpinPanel: (id) =>
    set((state) => {
      const updated = state.pinnedPanels.filter((p) => p.id !== id);
      savePinnedToSession(updated);
      return { pinnedPanels: updated };
    }),
}));

// ---------------------------------------------------------------------------
// Session persistence helpers for the pinned panel list
// ---------------------------------------------------------------------------

const PINNED_SESSION_KEY = "io-point-detail-pinned";

function savePinnedToSession(panels: PinnedPanel[]): void {
  try {
    sessionStorage.setItem(PINNED_SESSION_KEY, JSON.stringify(panels));
  } catch {
    // sessionStorage may be unavailable (private browsing quota exceeded)
  }
}

function restorePinnedFromSession(): PinnedPanel[] {
  try {
    const raw = sessionStorage.getItem(PINNED_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PinnedPanel =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as PinnedPanel).id === "string" &&
        typeof (p as PinnedPanel).pointId === "string",
    );
  } catch {
    return [];
  }
}
