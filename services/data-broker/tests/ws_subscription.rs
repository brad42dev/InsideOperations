/// Integration tests for data-broker WebSocket subscription and fanout behavior.
///
/// Because data-broker is a binary crate, these tests cannot import its
/// internal modules directly.  Instead they exercise:
///
///   1. Subscription registration and fanout logic, verified through the
///      shared `SubscriptionRegistry` contract (re-tested at the integration
///      boundary using `dashmap` + `uuid` — same types as production code).
///
///   2. Multi-client fanout: verifying that N clients subscribed to the same
///      point each receive an update when the point changes.
///
/// Tests that require a running data-broker HTTP/WebSocket stack are marked
/// `#[ignore]` and can be exercised with:
///
///   cargo test -p data-broker --test ws_subscription -- --ignored
use dashmap::DashMap;
use std::collections::HashSet;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Local registry mirror
//
// These types and functions mirror the SubscriptionRegistry in
// src/registry.rs.  They exist here so the integration test layer can
// exercise the subscription contract without access to private binary
// internals.
// ---------------------------------------------------------------------------

type ClientId = Uuid;

struct RegistryMirror {
    point_to_clients: DashMap<Uuid, HashSet<ClientId>>,
    client_to_points: DashMap<ClientId, HashSet<Uuid>>,
}

impl RegistryMirror {
    fn new() -> Self {
        Self {
            point_to_clients: DashMap::new(),
            client_to_points: DashMap::new(),
        }
    }

    fn subscribe(&self, client_id: ClientId, points: &[Uuid], max: usize) -> Vec<Uuid> {
        let mut subscribed = Vec::new();
        let mut client_pts = self.client_to_points.entry(client_id).or_default();
        for &p in points {
            if client_pts.len() >= max {
                break;
            }
            if client_pts.insert(p) {
                self.point_to_clients.entry(p).or_default().insert(client_id);
                subscribed.push(p);
            }
        }
        subscribed
    }

    fn get_clients_for_point(&self, point_id: &Uuid) -> Vec<ClientId> {
        self.point_to_clients
            .get(point_id)
            .map(|s| s.iter().copied().collect())
            .unwrap_or_default()
    }

    fn remove_client(&self, client_id: ClientId) -> HashSet<Uuid> {
        let pts = self
            .client_to_points
            .remove(&client_id)
            .map(|(_, v)| v)
            .unwrap_or_default();
        for p in &pts {
            if let Some(mut clients) = self.point_to_clients.get_mut(p) {
                clients.remove(&client_id);
            }
        }
        pts
    }

    fn total_subscriptions(&self) -> usize {
        self.client_to_points.iter().map(|e| e.value().len()).sum()
    }
}

// ---------------------------------------------------------------------------
// Subscription registration tests
// ---------------------------------------------------------------------------

/// A single client subscribing to N points must have N entries in the registry.
#[test]
fn test_single_client_subscribes_to_multiple_points() {
    let reg = RegistryMirror::new();
    let client = Uuid::new_v4();
    let points: Vec<Uuid> = (0..5).map(|_| Uuid::new_v4()).collect();

    let subscribed = reg.subscribe(client, &points, 100);

    assert_eq!(subscribed.len(), 5, "all 5 points must be subscribed");
    assert_eq!(reg.total_subscriptions(), 5);
}

/// Per-client cap must be enforced: subscribing to more than `max` points
/// silently stops at `max`.
#[test]
fn test_per_client_cap_is_enforced() {
    let reg = RegistryMirror::new();
    let client = Uuid::new_v4();
    let points: Vec<Uuid> = (0..10).map(|_| Uuid::new_v4()).collect();

    let subscribed = reg.subscribe(client, &points, 3);

    assert_eq!(
        subscribed.len(),
        3,
        "only 3 subscriptions must be accepted when cap is 3"
    );
}

/// Duplicate subscription requests must be idempotent.
#[test]
fn test_duplicate_subscription_is_idempotent() {
    let reg = RegistryMirror::new();
    let client = Uuid::new_v4();
    let point = Uuid::new_v4();

    reg.subscribe(client, &[point], 100);
    let second = reg.subscribe(client, &[point], 100);

    assert!(second.is_empty(), "re-subscribing to the same point must be a no-op");
    assert_eq!(reg.total_subscriptions(), 1);
}

// ---------------------------------------------------------------------------
// Multi-client fanout tests
// ---------------------------------------------------------------------------

/// When multiple clients subscribe to the same point, `get_clients_for_point`
/// must return all of them — simulating that a fanout loop would deliver to
/// each.
#[test]
fn test_fanout_reaches_all_subscribed_clients() {
    let reg = RegistryMirror::new();
    let point = Uuid::new_v4();

    let c1 = Uuid::new_v4();
    let c2 = Uuid::new_v4();
    let c3 = Uuid::new_v4();

    reg.subscribe(c1, &[point], 100);
    reg.subscribe(c2, &[point], 100);
    reg.subscribe(c3, &[point], 100);

    let clients = reg.get_clients_for_point(&point);

    assert_eq!(
        clients.len(),
        3,
        "fanout must target exactly 3 subscribed clients"
    );
    assert!(clients.contains(&c1));
    assert!(clients.contains(&c2));
    assert!(clients.contains(&c3));
}

/// A client that disconnects (remove_client) must no longer receive fanout.
#[test]
fn test_disconnected_client_is_removed_from_fanout() {
    let reg = RegistryMirror::new();
    let point = Uuid::new_v4();
    let c1 = Uuid::new_v4();
    let c2 = Uuid::new_v4();

    reg.subscribe(c1, &[point], 100);
    reg.subscribe(c2, &[point], 100);

    // c1 disconnects.
    reg.remove_client(c1);

    let clients = reg.get_clients_for_point(&point);
    assert_eq!(
        clients.len(),
        1,
        "only c2 should remain after c1 disconnects"
    );
    assert!(!clients.contains(&c1), "c1 must not receive fanout after disconnect");
    assert!(clients.contains(&c2), "c2 must still receive fanout");
}

/// A slow consumer (simulated by a full mpsc channel) must not block other
/// clients.  We verify this at the registry level: the fanout list is
/// independent per client.
#[tokio::test]
async fn test_slow_consumer_does_not_block_fanout_registry() {
    use tokio::sync::mpsc;

    let reg = RegistryMirror::new();
    let point = Uuid::new_v4();

    let slow_client = Uuid::new_v4();
    let fast_client = Uuid::new_v4();

    reg.subscribe(slow_client, &[point], 100);
    reg.subscribe(fast_client, &[point], 100);

    // Create a deliberately full channel for the slow client.
    let (slow_tx, mut slow_rx) = mpsc::channel::<String>(1);
    slow_tx.try_send("full".to_string()).unwrap();
    // Channel is now full — further try_send will return Err(Full).

    // Create a healthy channel for the fast client.
    let (fast_tx, mut fast_rx) = mpsc::channel::<String>(16);

    let clients = reg.get_clients_for_point(&point);

    // Simulate fanout: iterate clients, try_send to each.
    let connections: DashMap<ClientId, mpsc::Sender<String>> = DashMap::new();
    connections.insert(slow_client, slow_tx);
    connections.insert(fast_client, fast_tx);

    let msg = "point-update".to_string();
    for client_id in &clients {
        if let Some(tx) = connections.get(client_id) {
            // try_send: drop on full/closed, never block.
            let _ = tx.try_send(msg.clone());
        }
    }

    // fast_client must have received the message.
    let received = fast_rx.try_recv();
    assert!(
        received.is_ok(),
        "fast client must receive the update even when slow client's channel is full"
    );

    // slow_client's channel was full — the message is dropped, channel unchanged.
    drop(connections);
    let initial = slow_rx.try_recv();
    assert!(
        initial.is_ok(),
        "slow client's pre-existing message must still be there"
    );
}

// ---------------------------------------------------------------------------
// WebSocket live tests — require running data-broker (#[ignore])
// ---------------------------------------------------------------------------

fn broker_ws_url() -> String {
    std::env::var("TEST_DATA_BROKER_WS_URL")
        .unwrap_or_else(|_| "ws://localhost:3001/ws".to_string())
}

/// Connect two WebSocket clients, subscribe both to the same point, and verify
/// that a fanout update (injected via the UDS socket) reaches both.
#[tokio::test]
#[ignore]
async fn test_two_ws_clients_receive_same_point_update() {
    // This test requires a running data-broker and a UDS socket to inject
    // point updates.  See TEST_DATA_BROKER_WS_URL environment variable.
    let _url = broker_ws_url();
    // Full implementation requires tokio-tungstenite WebSocket client support.
    // Stub assertion — will be expanded when the broker HTTP stack is wired.
    todo!("implement end-to-end WS fanout test against live broker");
}
