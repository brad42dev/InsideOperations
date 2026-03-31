// SharedWorker WebSocket manager — runs in SharedWorker context (no window, no DOM).
// One instance is shared across all Console tabs. A single WebSocket connection is
// opened per browser origin. All subscriptions and updates flow through MessagePort.
//
// Message protocol (client → worker):
//   { type: 'connect', ticket: string, wsBase: string }  — open the socket (idempotent)
//   { type: 'subscribe', points: string[] }              — subscribe to point IDs
//   { type: 'unsubscribe', points: string[] }            — unsubscribe from point IDs
//   { type: 'status_report', render_fps: number, pending_updates: number, last_batch_process_ms: number }
//   { type: 'client_hint', device_type: 'phone' | 'tablet' | 'desktop' }
//   { type: 'disconnect' }                               — close socket (logout)
//   { type: 'port_close' }                               — tab unloading, remove port
//   { type: 'pause' }                                    — page hidden, stop reconnect scheduling
//   { type: 'resume' }                                   — page visible, reset backoff and reconnect
//
// Message protocol (worker → client):
//   { type: 'state', state: 'connecting' | 'connected' | 'disconnected' | 'error' }
//   { type: 'update', point_id: string, value: number, quality: string, timestamp: string }
//   { type: 'point_stale', point_id: string, last_updated_at: string }
//   { type: 'point_fresh', point_id: string, value: number, quality: string, timestamp: string }
//   { type: 'source_offline', source_id: string, source_name: string }
//   { type: 'source_online', source_id: string, source_name: string }
//   { type: 'export_complete', job_id: string }
//   { type: 'alert_notification', message: string, full_screen_takeover: boolean, alert_id: string }
//   { type: 'need_ticket' }                              — worker lost WS, needs fresh ticket

// The SharedWorker global has `onconnect` but tsconfig uses DOM lib (not WebWorker lib).
// We cast `self` to the SharedWorkerGlobalScope shape we need rather than changing the
// tsconfig lib (which would break React/DOM type checking elsewhere).
interface SharedWorkerGlobalScopeShim {
  onconnect: ((e: MessageEvent) => void) | null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sharedSelf = self as unknown as SharedWorkerGlobalScopeShim;

const ports: MessagePort[] = [];
let ws: WebSocket | null = null;
let wsBase = "";
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let isDestroyed = false;
let isPaused = false;
let connectionState: "connecting" | "connected" | "disconnected" | "error" =
  "disconnected";

// Map from MessagePort → Set<pointId> (per-window subscription tracking)
const windowSubscriptions = new Map<MessagePort, Set<string>>();
// Union of all window sets — the active server subscription
const serverSubscription = new Set<string>();

// Recompute the union of all window subscription sets and diff against the
// current server subscription, sending only the delta to the WebSocket.
function recomputeAndSync(socket: WebSocket | null) {
  const newUnion = new Set<string>();
  for (const pts of windowSubscriptions.values()) {
    for (const p of pts) newUnion.add(p);
  }
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    // Keep serverSubscription in sync so reconnect re-subscribes correctly
    serverSubscription.clear();
    for (const p of newUnion) serverSubscription.add(p);
    return;
  }
  const toAdd = [...newUnion].filter((p) => !serverSubscription.has(p));
  const toRemove = [...serverSubscription].filter((p) => !newUnion.has(p));
  if (toAdd.length > 0)
    socket.send(JSON.stringify({ type: "subscribe", points: toAdd }));
  if (toRemove.length > 0)
    socket.send(JSON.stringify({ type: "unsubscribe", points: toRemove }));
  serverSubscription.clear();
  for (const p of newUnion) serverSubscription.add(p);
}

// ---------------------------------------------------------------------------
// Port management
// ---------------------------------------------------------------------------

sharedSelf.onconnect = (e: MessageEvent) => {
  const port = e.ports[0];
  ports.push(port);

  // Send current state immediately so the new tab syncs up
  port.postMessage({ type: "state", state: connectionState });

  port.onmessage = (ev: MessageEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const msg = ev.data as Record<string, unknown>;
    handlePortMessage(port, msg);
  };

  port.start();

  port.addEventListener("close", () => {
    // removePort handles windowSubscriptions.delete and recomputeAndSync
    removePort(port);
  });
};

function removePort(port: MessagePort) {
  const idx = ports.indexOf(port);
  if (idx !== -1) ports.splice(idx, 1);
  windowSubscriptions.delete(port);
  recomputeAndSync(ws);
}

// ---------------------------------------------------------------------------
// Message routing from client tabs
// ---------------------------------------------------------------------------

function handlePortMessage(port: MessagePort, msg: Record<string, unknown>) {
  switch (msg.type) {
    case "connect": {
      // Main thread fetches the ticket and passes it along with wsBase
      const ticket = msg.ticket as string | undefined;
      const base = msg.wsBase as string | undefined;
      if (base) wsBase = base;
      if (ticket) {
        openSocket(ticket);
      }
      break;
    }
    case "subscribe": {
      const points = msg.points as string[];
      const set = windowSubscriptions.get(port) ?? new Set<string>();
      for (const p of points) set.add(p);
      windowSubscriptions.set(port, set);
      recomputeAndSync(ws);
      break;
    }
    case "unsubscribe": {
      const points = msg.points as string[];
      const set = windowSubscriptions.get(port);
      if (set) {
        for (const p of points) set.delete(p);
      }
      recomputeAndSync(ws);
      break;
    }
    case "status_report":
    case "client_hint": {
      // Forward directly to broker
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
      break;
    }
    case "disconnect": {
      isDestroyed = false; // allow reconnect later
      closeSocket();
      break;
    }
    case "port_close": {
      removePort(port);
      break;
    }
    case "pause": {
      isPaused = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      break;
    }
    case "resume": {
      isPaused = false;
      reconnectDelay = 1000;
      // Immediate reconnect — ask all connected ports for a fresh ticket
      broadcast({ type: "need_ticket" });
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// WebSocket lifecycle
// ---------------------------------------------------------------------------

function broadcast(msg: unknown) {
  for (const p of ports) {
    try {
      p.postMessage(msg);
    } catch {
      // Port was closed; will be cleaned up on next message
    }
  }
}

function setState(
  state: "connecting" | "connected" | "disconnected" | "error",
) {
  connectionState = state;
  broadcast({ type: "state", state });
}

function openSocket(ticket: string) {
  // Idempotent: don't open if already connecting or open
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  setState("connecting");

  const url = `${wsBase}/ws?ticket=${encodeURIComponent(ticket)}`;
  const socket = new WebSocket(url);
  ws = socket;

  socket.onopen = () => {
    reconnectDelay = 1000;
    setState("connected");

    // Re-subscribe to all known points (full union from per-window map)
    const all = Array.from(serverSubscription);
    if (all.length > 0) {
      socket.send(JSON.stringify({ type: "subscribe", points: all }));
    }
  };

  socket.onmessage = (ev: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(ev.data) as Record<string, unknown>;
      if (msg.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
        return;
      }
      // Broadcast all broker messages to all connected tab ports
      broadcast(msg);
    } catch {
      // Ignore malformed frames
    }
  };

  socket.onclose = () => {
    if (ws === socket) ws = null;
    if (!isDestroyed) {
      setState("disconnected");
      scheduleReconnect();
    }
  };

  socket.onerror = () => {
    setState("error");
  };
}

function closeSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  ws?.close();
  ws = null;
  serverSubscription.clear();
  windowSubscriptions.clear();
  reconnectDelay = 1000;
  setState("disconnected");
}

function scheduleReconnect() {
  if (isDestroyed || isPaused || reconnectTimer) return;
  const jitter = Math.random() * reconnectDelay * 0.3;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    // On reconnect, we need a fresh ticket — ask all connected ports
    broadcast({ type: "need_ticket" });
  }, reconnectDelay + jitter);
}
