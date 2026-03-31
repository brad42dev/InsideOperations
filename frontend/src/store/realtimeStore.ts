/**
 * RealtimeStore — Console module real-time point value buffer and subscription registry.
 *
 * Spec: console-implementation-spec.md §1.4
 * - No React state for point values — those live in a mutable Map ref (pointValueBuffer).
 * - Zustand state only for connectionStatus and subscribedPointCount (used by status bar).
 * - No temporal middleware.
 */

import { create } from "zustand";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/**
 * Mutable point value buffer.
 * Lives outside React state — mutated directly by the WebSocket/SharedWorker data path.
 * Never triggers re-renders. Read via ref in the RAF loop.
 */
export const pointValueBuffer: Map<
  string,
  { value: unknown; quality: string; timestamp: number }
> = new Map();

export interface RealtimeState {
  /** Current WebSocket connection status (drives the status-bar dot). */
  connectionStatus: ConnectionStatus;
  /** Count of actively subscribed point IDs (drives the status-bar counter). */
  subscribedPointCount: number;

  // Actions
  setConnectionStatus: (status: ConnectionStatus) => void;
  setSubscribedPointCount: (count: number) => void;
  incrementSubscribedPointCount: (delta: number) => void;

  /**
   * Update a point value in the mutable buffer.
   * Does NOT call set() — no React re-render triggered.
   */
  updatePointValue: (
    pointId: string,
    value: unknown,
    quality: string,
    timestamp: number,
  ) => void;
}

export const useRealtimeStore = create<RealtimeState>()((set) => ({
  connectionStatus: "disconnected",
  subscribedPointCount: 0,

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  setSubscribedPointCount: (subscribedPointCount) =>
    set({ subscribedPointCount }),

  incrementSubscribedPointCount: (delta) =>
    set((s) => ({
      subscribedPointCount: Math.max(0, s.subscribedPointCount + delta),
    })),

  updatePointValue: (pointId, value, quality, timestamp) => {
    // Mutate the buffer directly — no setState, no re-render
    pointValueBuffer.set(pointId, { value, quality, timestamp });
  },
}));
