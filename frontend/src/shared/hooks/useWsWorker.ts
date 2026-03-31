// Client-side connector for the wsWorker SharedWorker.
// This module owns the SharedWorker instance (one per browser origin) and
// exposes the same subscribe/unsubscribe/onStateChange API as the old WsManager
// so existing callers (useWebSocket.ts) can delegate to it without rewriting.

import { wsTicketApi } from "../../api/ws-ticket";
import { useRealtimeStore } from "../../store/realtimeStore";

// Local copy of detectDeviceType — cannot import from useWebSocket.ts as that
// module imports wsWorkerConnector from this file (would create a circular dep).
function detectDeviceType(): "phone" | "tablet" | "desktop" {
  const ua = navigator.userAgent;
  if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(ua)) return "phone";
  if (/Tablet|iPad|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  return "desktop";
}

const WS_BASE =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

export type WsConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";
export type PointUpdateHandler = (update: PointValue) => void;

export interface PointValue {
  pointId: string;
  value: number;
  quality: string;
  timestamp: string;
  stale?: boolean;
}

// ---------------------------------------------------------------------------
// Shared worker singleton — one per browser origin
// ---------------------------------------------------------------------------

let worker: SharedWorker | null = null;
let port: MessagePort | null = null;

// Handlers registered by React hooks / components on the main thread
const stateListeners = new Set<(s: WsConnectionState) => void>();
const subscribers = new Map<string, Set<PointUpdateHandler>>();
const staleHandlers = new Set<(id: string, ts: string) => void>();
const sourceHandlers = new Set<
  (id: string, name: string, online: boolean) => void
>();
const sessionLockHandlers = new Set<(sessionId: string) => void>();
const sessionUnlockHandlers = new Set<(sessionId: string) => void>();

// Presence and muster real-time event handlers
export interface PresenceHeadcount {
  on_site: number;
  on_shift: number;
}
export interface PresenceBadgeEvent {
  person_name: string;
  event_type: string;
  area: string;
  time: string;
}
export interface MusterStatus {
  muster_event_id: string;
  accounted: number;
  unaccounted: number;
  total: number;
  status?: string;
}
export interface MusterPersonAccounted {
  person_name: string;
  muster_point: string;
  method: string;
}

const presenceHeadcountHandlers = new Set<(data: PresenceHeadcount) => void>();
const presenceBadgeEventHandlers = new Set<
  (data: PresenceBadgeEvent) => void
>();
const musterStatusHandlers = new Set<(data: MusterStatus) => void>();
const musterPersonAccountedHandlers = new Set<
  (data: MusterPersonAccounted) => void
>();

// Notification delivery status events (from Alert Service)
export interface NotificationStatusChanged {
  message_id: string;
  status: string;
  channel?: string;
  recipient_count?: number;
}
const notificationStatusHandlers = new Set<
  (data: NotificationStatusChanged) => void
>();

// Alarm state events — published by the Data Broker when any alarm transitions state.
// Source-agnostic: covers OPC A&C, threshold evaluator, universal import, and future sources.
export interface AlarmStateUpdate {
  point_id: string;
  /** 1=Critical, 2=High, 3=Medium, 4=Advisory, 0=Cleared/Normal */
  priority: number;
  active: boolean;
  unacknowledged: boolean;
  suppressed: boolean;
  message?: string;
  timestamp: string;
}
const alarmStateHandlers = new Set<(data: AlarmStateUpdate) => void>();

// Alarm count events — published by the Data Broker when alarms are created or acknowledged
export interface AlarmCountUpdate {
  /** The new total unacknowledged alarm count (absolute, from broker) */
  unacknowledged: number;
}
export interface AlarmCreatedEvent {
  alarm_id: string;
  unacknowledged_count?: number;
}
export interface AlarmAcknowledgedEvent {
  alarm_id: string;
  unacknowledged_count?: number;
}
const alarmCountUpdateHandlers = new Set<(data: AlarmCountUpdate) => void>();
const alarmCreatedHandlers = new Set<(data: AlarmCreatedEvent) => void>();
const alarmAcknowledgedHandlers = new Set<
  (data: AlarmAcknowledgedEvent) => void
>();

let currentState: WsConnectionState = "disconnected";

// ---------------------------------------------------------------------------
// Page Visibility — pause reconnects when backgrounded, resume on foreground
// ---------------------------------------------------------------------------

let pendingReconnect = false;

function handleVisibilityChange() {
  if (document.visibilityState === "hidden") {
    // App is backgrounded — tell worker to stop reconnecting
    port?.postMessage({ type: "pause" });
  } else if (document.visibilityState === "visible" && pendingReconnect) {
    // Foregrounded with a pending reconnect — reconnect now, reset backoff
    pendingReconnect = false;
    port?.postMessage({ type: "resume" });
    void issueTicket();
  }
}

document.addEventListener("visibilitychange", handleVisibilityChange);

function getPort(): MessagePort {
  if (port) return port;

  worker = new SharedWorker(
    new URL("../../workers/wsWorker.ts", import.meta.url),
    {
      type: "module",
      name: "io-ws-worker",
    },
  );
  port = worker.port;
  port.start();

  port.onmessage = (ev: MessageEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const msg = ev.data as Record<string, unknown>;
    handleWorkerMessage(msg);
  };

  return port;
}

// ---------------------------------------------------------------------------
// Worker message routing
// ---------------------------------------------------------------------------

function handleWorkerMessage(msg: Record<string, unknown>) {
  switch (msg.type) {
    case "state": {
      const state = msg.state as WsConnectionState;
      currentState = state;
      if (state === "disconnected" && document.visibilityState === "hidden") {
        pendingReconnect = true; // will reconnect when visible
      }
      stateListeners.forEach((fn) => fn(state));
      useRealtimeStore.getState().setConnectionStatus(state);
      break;
    }
    case "update": {
      // Broker sends: { type: "update", payload: { points: [{id, v, q, t}, ...] } }
      const payload = msg.payload as
        | { points?: Array<{ id: string; v: number; q: string; t: number }> }
        | undefined;
      const points = payload?.points ?? [];
      for (const pt of points) {
        const handlers = subscribers.get(pt.id);
        if (handlers) {
          const update: PointValue = {
            pointId: pt.id,
            value: pt.v ?? 0,
            quality: pt.q ?? "unknown",
            timestamp: pt.t
              ? new Date(pt.t).toISOString()
              : new Date().toISOString(),
            stale: false,
          };
          handlers.forEach((fn) => fn(update));
        }
      }
      break;
    }
    case "point_stale": {
      const point_id = msg.point_id as string | undefined;
      if (!point_id) break;
      const last_updated_at = (msg.last_updated_at as string | undefined) ?? "";
      staleHandlers.forEach((fn) => fn(point_id, last_updated_at));
      const handlers = subscribers.get(point_id);
      if (handlers) {
        const update: PointValue = {
          pointId: point_id,
          value: 0,
          quality: "uncertain",
          timestamp: last_updated_at,
          stale: true,
        };
        handlers.forEach((fn) => fn(update));
      }
      break;
    }
    case "point_fresh": {
      const point_id = msg.point_id as string | undefined;
      if (!point_id) break;
      const handlers = subscribers.get(point_id);
      if (handlers) {
        const update: PointValue = {
          pointId: point_id,
          value: (msg.value as number | undefined) ?? 0,
          quality: "good",
          timestamp: (msg.timestamp as string | undefined) ?? "",
          stale: false,
        };
        handlers.forEach((fn) => fn(update));
      }
      break;
    }
    case "source_offline": {
      const source_id = msg.source_id as string | undefined;
      if (!source_id) break;
      sourceHandlers.forEach((fn) =>
        fn(source_id, (msg.source_name as string | undefined) ?? "", false),
      );
      break;
    }
    case "source_online": {
      const source_id = msg.source_id as string | undefined;
      if (!source_id) break;
      sourceHandlers.forEach((fn) =>
        fn(source_id, (msg.source_name as string | undefined) ?? "", true),
      );
      break;
    }
    case "export_complete": {
      const payload = msg.payload as Record<string, unknown> | undefined;
      const job_id = (payload?.job_id ?? msg.job_id) as string | undefined;
      if (!job_id) break;
      // Dynamically import to avoid pulling in Toast at module load time
      import("../components/Toast").then(({ showToast }) => {
        import("../../api/reports").then(({ reportsApi }) => {
          const downloadUrl = reportsApi.getDownloadUrl(job_id);
          showToast({
            title: "Your report is ready",
            description: "Click Download to save the file.",
            variant: "success",
            action: {
              label: "Download",
              onClick: () => {
                window.open(downloadUrl, "_blank");
              },
            },
            duration: 10000,
          });
        });
      });
      break;
    }
    case "alert_notification": {
      if (msg.full_screen_takeover && msg.message) {
        import("../../store/ui").then((mod) => {
          mod.useUiStore.getState().showEmergencyAlert(msg.message as string);
        });
      }
      break;
    }
    case "session_locked": {
      // Server notified that this session was locked.
      // Retrieve the session_id from the payload envelope.
      const payload = msg.payload as Record<string, unknown> | undefined;
      const sessionId = (payload?.session_id ?? "") as string;
      // Update the ui store so the lock overlay activates on next interaction.
      import("../../store/ui").then((mod) => {
        mod.useUiStore.getState().lock();
      });
      sessionLockHandlers.forEach((fn) => fn(sessionId));
      break;
    }
    case "session_unlocked": {
      // Server notified that this session was unlocked.
      const payload = msg.payload as Record<string, unknown> | undefined;
      const sessionId = (payload?.session_id ?? "") as string;
      // Clear the lock overlay if it is showing.
      import("../../store/ui").then((mod) => {
        mod.useUiStore.getState().unlock();
      });
      sessionUnlockHandlers.forEach((fn) => fn(sessionId));
      break;
    }
    case "need_ticket": {
      // Worker lost connection and needs a fresh ticket to reconnect
      void issueTicket();
      break;
    }
    case "presence_headcount": {
      const data: PresenceHeadcount = {
        on_site: (msg.on_site as number | undefined) ?? 0,
        on_shift: (msg.on_shift as number | undefined) ?? 0,
      };
      presenceHeadcountHandlers.forEach((fn) => fn(data));
      break;
    }
    case "presence_badge_event": {
      const data: PresenceBadgeEvent = {
        person_name: (msg.person_name as string | undefined) ?? "",
        event_type: (msg.event_type as string | undefined) ?? "",
        area: (msg.area as string | undefined) ?? "",
        time: (msg.time as string | undefined) ?? "",
      };
      presenceBadgeEventHandlers.forEach((fn) => fn(data));
      break;
    }
    case "muster_status": {
      const payload =
        (msg.payload as Record<string, unknown> | undefined) ?? msg;
      const data: MusterStatus = {
        muster_event_id: (payload.muster_event_id as string | undefined) ?? "",
        accounted: (payload.accounted as number | undefined) ?? 0,
        unaccounted: (payload.unaccounted as number | undefined) ?? 0,
        total: (payload.total as number | undefined) ?? 0,
        status: payload.status as string | undefined,
      };
      musterStatusHandlers.forEach((fn) => fn(data));
      break;
    }
    case "muster_person_accounted": {
      const payload =
        (msg.payload as Record<string, unknown> | undefined) ?? msg;
      const data: MusterPersonAccounted = {
        person_name: (payload.person_name as string | undefined) ?? "",
        muster_point: (payload.muster_point as string | undefined) ?? "",
        method: (payload.method as string | undefined) ?? "",
      };
      musterPersonAccountedHandlers.forEach((fn) => fn(data));
      break;
    }
    case "notification_status_changed": {
      const payload =
        (msg.payload as Record<string, unknown> | undefined) ?? msg;
      const data: NotificationStatusChanged = {
        message_id: (payload.message_id as string | undefined) ?? "",
        status: (payload.status as string | undefined) ?? "",
        channel: payload.channel as string | undefined,
        recipient_count: payload.recipient_count as number | undefined,
      };
      notificationStatusHandlers.forEach((fn) => fn(data));
      break;
    }
    case "alarm_state_changed": {
      // Broker broadcasts alarm state transitions to all connected clients.
      // The payload matches WsServerMessage::AlarmStateChanged from io-bus.
      const payload =
        (msg.payload as Record<string, unknown> | undefined) ?? msg;
      const data: AlarmStateUpdate = {
        point_id: (payload.point_id as string | undefined) ?? "",
        priority: (payload.priority as number | undefined) ?? 0,
        active: (payload.active as boolean | undefined) ?? false,
        unacknowledged:
          (payload.unacknowledged as boolean | undefined) ?? false,
        suppressed: (payload.suppressed as boolean | undefined) ?? false,
        message: payload.message as string | undefined,
        timestamp:
          (payload.timestamp as string | undefined) ?? new Date().toISOString(),
      };
      alarmStateHandlers.forEach((fn) => fn(data));
      // Also update the alarm store buffer so SceneRenderer picks it up synchronously
      import("../../store/alarmStore").then(({ useAlarmStore }) => {
        useAlarmStore.getState().updateAlarmState(data);
      });
      break;
    }
    case "alarm_count_update": {
      // Broker publishes an absolute unacknowledged count (preferred)
      const payload =
        (msg.payload as Record<string, unknown> | undefined) ?? msg;
      const unacknowledged =
        (payload.unacknowledged as number | undefined) ??
        (msg.unacknowledged as number | undefined) ??
        0;
      alarmCountUpdateHandlers.forEach((fn) => fn({ unacknowledged }));
      break;
    }
    case "alarm_created": {
      // Broker publishes individual alarm creation events
      const payload =
        (msg.payload as Record<string, unknown> | undefined) ?? msg;
      const data: AlarmCreatedEvent = {
        alarm_id: (payload.alarm_id as string | undefined) ?? "",
        unacknowledged_count: payload.unacknowledged_count as
          | number
          | undefined,
      };
      alarmCreatedHandlers.forEach((fn) => fn(data));
      // If the broker includes an absolute count, forward to count handlers too
      if (typeof data.unacknowledged_count === "number") {
        alarmCountUpdateHandlers.forEach((fn) =>
          fn({ unacknowledged: data.unacknowledged_count! }),
        );
      }
      break;
    }
    case "alarm_acknowledged": {
      // Broker publishes acknowledgement events
      const payload =
        (msg.payload as Record<string, unknown> | undefined) ?? msg;
      const data: AlarmAcknowledgedEvent = {
        alarm_id: (payload.alarm_id as string | undefined) ?? "",
        unacknowledged_count: payload.unacknowledged_count as
          | number
          | undefined,
      };
      alarmAcknowledgedHandlers.forEach((fn) => fn(data));
      // If the broker includes an absolute count, forward to count handlers too
      if (typeof data.unacknowledged_count === "number") {
        alarmCountUpdateHandlers.forEach((fn) =>
          fn({ unacknowledged: data.unacknowledged_count! }),
        );
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

async function issueTicket() {
  try {
    const result = await wsTicketApi.create();
    if (!result.success) {
      currentState = "error";
      stateListeners.forEach((fn) => fn("error"));
      return;
    }
    const p = getPort();
    const deviceType = detectDeviceType();
    p.postMessage({
      type: "connect",
      ticket: result.data.ticket,
      wsBase: WS_BASE,
    });
    p.postMessage({ type: "client_hint", device_type: deviceType });
  } catch {
    currentState = "error";
    stateListeners.forEach((fn) => fn("error"));
  }
}

// ---------------------------------------------------------------------------
// Public API — mirrors old WsManager interface
// ---------------------------------------------------------------------------

export const wsWorkerConnector = {
  getState(): WsConnectionState {
    return currentState;
  },

  onStateChange(fn: (s: WsConnectionState) => void): () => void {
    stateListeners.add(fn);
    return () => {
      stateListeners.delete(fn);
    };
  },

  async connect() {
    if (currentState === "connecting" || currentState === "connected") return;
    // Ensure the worker/port is initialised
    getPort();
    await issueTicket();
  },

  subscribe(pointId: string, handler: PointUpdateHandler) {
    const p = getPort();
    if (!subscribers.has(pointId)) {
      subscribers.set(pointId, new Set());
      p.postMessage({ type: "subscribe", points: [pointId] });
    }
    subscribers.get(pointId)!.add(handler);
  },

  unsubscribe(pointId: string, handler: PointUpdateHandler) {
    const handlers = subscribers.get(pointId);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      subscribers.delete(pointId);
      const p = getPort();
      p.postMessage({ type: "unsubscribe", points: [pointId] });
    }
  },

  onStale(fn: (id: string, ts: string) => void): () => void {
    staleHandlers.add(fn);
    return () => {
      staleHandlers.delete(fn);
    };
  },

  onSource(
    fn: (id: string, name: string, online: boolean) => void,
  ): () => void {
    sourceHandlers.add(fn);
    return () => {
      sourceHandlers.delete(fn);
    };
  },

  /** Register a callback invoked when the server reports this session was locked. */
  onSessionLock(fn: (sessionId: string) => void): () => void {
    sessionLockHandlers.add(fn);
    return () => {
      sessionLockHandlers.delete(fn);
    };
  },

  /** Register a callback invoked when the server reports this session was unlocked. */
  onSessionUnlock(fn: (sessionId: string) => void): () => void {
    sessionUnlockHandlers.add(fn);
    return () => {
      sessionUnlockHandlers.delete(fn);
    };
  },

  /** Subscribe to presence headcount updates (published after each badge swipe). */
  onPresenceHeadcount(fn: (data: PresenceHeadcount) => void): () => void {
    presenceHeadcountHandlers.add(fn);
    return () => {
      presenceHeadcountHandlers.delete(fn);
    };
  },

  /** Subscribe to individual badge event notifications. */
  onPresenceBadgeEvent(fn: (data: PresenceBadgeEvent) => void): () => void {
    presenceBadgeEventHandlers.add(fn);
    return () => {
      presenceBadgeEventHandlers.delete(fn);
    };
  },

  /** Subscribe to muster status updates (published after declare/account/resolve). */
  onMusterStatus(fn: (data: MusterStatus) => void): () => void {
    musterStatusHandlers.add(fn);
    return () => {
      musterStatusHandlers.delete(fn);
    };
  },

  /** Subscribe to individual muster person-accounted events. */
  onMusterPersonAccounted(
    fn: (data: MusterPersonAccounted) => void,
  ): () => void {
    musterPersonAccountedHandlers.add(fn);
    return () => {
      musterPersonAccountedHandlers.delete(fn);
    };
  },

  /** Subscribe to notification delivery status change events (Alert Service). */
  onNotificationStatusChanged(
    fn: (data: NotificationStatusChanged) => void,
  ): () => void {
    notificationStatusHandlers.add(fn);
    return () => {
      notificationStatusHandlers.delete(fn);
    };
  },

  /** Subscribe to absolute alarm count updates published by the broker. */
  onAlarmCountUpdate(fn: (data: AlarmCountUpdate) => void): () => void {
    alarmCountUpdateHandlers.add(fn);
    return () => {
      alarmCountUpdateHandlers.delete(fn);
    };
  },

  /** Subscribe to individual alarm_created events. */
  onAlarmCreated(fn: (data: AlarmCreatedEvent) => void): () => void {
    alarmCreatedHandlers.add(fn);
    return () => {
      alarmCreatedHandlers.delete(fn);
    };
  },

  /** Subscribe to individual alarm_acknowledged events. */
  onAlarmAcknowledged(fn: (data: AlarmAcknowledgedEvent) => void): () => void {
    alarmAcknowledgedHandlers.add(fn);
    return () => {
      alarmAcknowledgedHandlers.delete(fn);
    };
  },

  /** Subscribe to alarm state transitions (source-agnostic: OPC A&C, threshold, import). */
  onAlarmStateChange(fn: (data: AlarmStateUpdate) => void): () => void {
    alarmStateHandlers.add(fn);
    return () => {
      alarmStateHandlers.delete(fn);
    };
  },

  sendStatusReport(
    renderFps: number,
    pendingUpdates: number,
    lastBatchProcessMs: number,
  ) {
    const p = getPort();
    p.postMessage({
      type: "status_report",
      render_fps: renderFps,
      pending_updates: pendingUpdates,
      last_batch_process_ms: lastBatchProcessMs,
    });
  },

  disconnect() {
    port?.postMessage({ type: "disconnect" });
    subscribers.clear();
    staleHandlers.clear();
    sourceHandlers.clear();
    sessionLockHandlers.clear();
    sessionUnlockHandlers.clear();
    presenceHeadcountHandlers.clear();
    presenceBadgeEventHandlers.clear();
    musterStatusHandlers.clear();
    musterPersonAccountedHandlers.clear();
    notificationStatusHandlers.clear();
    alarmCountUpdateHandlers.clear();
    alarmCreatedHandlers.clear();
    alarmAcknowledgedHandlers.clear();
    alarmStateHandlers.clear();
    currentState = "disconnected";
    stateListeners.forEach((fn) => fn("disconnected"));
  },
};
