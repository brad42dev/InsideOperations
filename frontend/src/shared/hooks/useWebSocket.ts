import { useEffect, useRef, useState } from "react";

export type DeviceType = "phone" | "tablet" | "desktop";

// Detect mobile device type from User Agent for throttle hinting (doc 16 §Mobile Throttling).
// phone → broker applies 10s update interval; tablet → 5s; desktop → no extra throttling.
export function detectDeviceType(): DeviceType {
  const ua = navigator.userAgent;
  if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(ua)) return "phone";
  if (/Tablet|iPad|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  return "desktop";
}

export type WsConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface PointValue {
  pointId: string;
  value: number;
  quality: string;
  timestamp: string;
  stale?: boolean;
  /** True when point is in manual/forced override */
  manual?: boolean;
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null;
  unacknowledged?: boolean;
  /** Client-side receipt timestamp (ms) — set to Date.now() when message arrives */
  lastUpdateMs?: number;
}

type PointUpdateHandler = (update: PointValue) => void;

interface UseWebSocketOptions {
  onStale?: (pointId: string, lastUpdatedAt: string) => void;
  onSourceOffline?: (sourceId: string, sourceName: string) => void;
  onSourceOnline?: (sourceId: string, sourceName: string) => void;
}

// ---------------------------------------------------------------------------
// Re-export the SharedWorker connector as `wsManager`.
// All existing callers (GraphicPane, SceneRenderer, auth store, designer) continue
// to import `wsManager` from this module unchanged — they get the SharedWorker
// connector, not a per-tab WebSocket.
// ---------------------------------------------------------------------------

import { wsWorkerConnector } from "./useWsWorker";

// `wsManager` is the single public facade used across the codebase.
// It points to the SharedWorker connector which ensures one socket per origin.
export const wsManager = wsWorkerConnector;

// ---------------------------------------------------------------------------
// React hook — subscribe to one or more points
// ---------------------------------------------------------------------------

export function useWebSocket(
  pointIds: string[],
  options?: UseWebSocketOptions,
): {
  values: Map<string, PointValue>;
  connectionState: WsConnectionState;
} {
  const [values, setValues] = useState<Map<string, PointValue>>(new Map());
  const [connectionState, setConnectionState] = useState<WsConnectionState>(
    wsManager.getState(),
  );
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Connect + track connection state
  useEffect(() => {
    if (wsManager.getState() === "disconnected") {
      void wsManager.connect();
    }
    return wsManager.onStateChange(setConnectionState);
  }, []);

  // Subscribe to point IDs
  const pointIdsKey = pointIds.join(",");
  useEffect(() => {
    if (pointIds.length === 0) return;

    const handler: PointUpdateHandler = (update) => {
      setValues((prev) => {
        const next = new Map(prev);
        next.set(update.pointId, update);
        return next;
      });
    };

    pointIds.forEach((id) => wsManager.subscribe(id, handler));
    return () => {
      pointIds.forEach((id) => wsManager.unsubscribe(id, handler));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointIdsKey]);

  // Stale handler
  useEffect(() => {
    return wsManager.onStale((id, ts) => {
      optionsRef.current?.onStale?.(id, ts);
    });
  }, []);

  // Source status handler
  useEffect(() => {
    return wsManager.onSource((id, name, online) => {
      if (online) {
        optionsRef.current?.onSourceOnline?.(id, name);
      } else {
        optionsRef.current?.onSourceOffline?.(id, name);
      }
    });
  }, []);

  return { values, connectionState };
}

// ---------------------------------------------------------------------------
// RAF-coalesced hook — same as useWebSocket but batches state updates to
// one per animation frame (~60fps). Use this for high-frequency graphics
// panes where the broker may push 100s of updates/sec (spec §6.2).
// ---------------------------------------------------------------------------

export function useWebSocketRaf(
  pointIds: string[],
  options?: UseWebSocketOptions,
): {
  values: Map<string, PointValue>;
  connectionState: WsConnectionState;
} {
  const [values, setValues] = useState<Map<string, PointValue>>(new Map());
  const [connectionState, setConnectionState] = useState<WsConnectionState>(
    wsManager.getState(),
  );
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Mutable buffer — incoming updates accumulate here without touching React state
  const pendingRef = useRef<Map<string, PointValue>>(new Map());
  const rafPendingRef = useRef(false);

  // Connect + track connection state
  useEffect(() => {
    if (wsManager.getState() === "disconnected") {
      void wsManager.connect();
    }
    return wsManager.onStateChange(setConnectionState);
  }, []);

  // Subscribe to point IDs with RAF coalescing
  const pointIdsKey = pointIds.join(",");
  useEffect(() => {
    if (pointIds.length === 0) return;

    const handler: PointUpdateHandler = (update) => {
      // Write to mutable buffer — no React state update on each message
      pendingRef.current.set(update.pointId, update);
      if (!rafPendingRef.current) {
        rafPendingRef.current = true;
        requestAnimationFrame(() => {
          rafPendingRef.current = false;
          const pending = pendingRef.current;
          if (pending.size === 0) return;
          const batch = new Map(pending);
          pending.clear();
          setValues((prev) => {
            const next = new Map(prev);
            for (const [id, pv] of batch) next.set(id, pv);
            return next;
          });
        });
      }
    };

    pointIds.forEach((id) => wsManager.subscribe(id, handler));
    return () => {
      pointIds.forEach((id) => wsManager.unsubscribe(id, handler));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointIdsKey]);

  // Stale handler
  useEffect(() => {
    return wsManager.onStale((id, ts) => {
      optionsRef.current?.onStale?.(id, ts);
    });
  }, []);

  // Source status handler
  useEffect(() => {
    return wsManager.onSource((id, name, online) => {
      if (online) {
        optionsRef.current?.onSourceOnline?.(id, name);
      } else {
        optionsRef.current?.onSourceOffline?.(id, name);
      }
    });
  }, []);

  return { values, connectionState };
}
