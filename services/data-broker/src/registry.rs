use dashmap::DashMap;
use std::collections::HashSet;
use uuid::Uuid;

pub type ClientId = Uuid;

pub struct SubscriptionRegistry {
    /// point_id → set of client_ids subscribed to that point
    point_to_clients: DashMap<Uuid, HashSet<ClientId>>,
    /// client_id → set of point_ids the client has subscribed to
    client_to_points: DashMap<ClientId, HashSet<Uuid>>,
}

impl SubscriptionRegistry {
    pub fn new() -> Self {
        Self {
            point_to_clients: DashMap::new(),
            client_to_points: DashMap::new(),
        }
    }

    /// Subscribe `client_id` to the given points, respecting `max_per_client`.
    /// Returns the set of point IDs that were actually subscribed (may be fewer
    /// than requested if the per-client cap would be exceeded).
    pub fn subscribe(
        &self,
        client_id: ClientId,
        points: &[Uuid],
        max_per_client: usize,
    ) -> Vec<Uuid> {
        let mut subscribed = Vec::new();

        let mut client_points = self
            .client_to_points
            .entry(client_id)
            .or_default();

        for &point_id in points {
            if client_points.len() >= max_per_client {
                break;
            }
            if client_points.insert(point_id) {
                // New subscription — register in the reverse map too.
                self.point_to_clients
                    .entry(point_id)
                    .or_default()
                    .insert(client_id);
                subscribed.push(point_id);
            }
        }

        subscribed
    }

    /// Unsubscribe `client_id` from the given points.
    pub fn unsubscribe(&self, client_id: ClientId, points: &[Uuid]) {
        if let Some(mut client_points) = self.client_to_points.get_mut(&client_id) {
            for point_id in points {
                if client_points.remove(point_id) {
                    if let Some(mut clients) = self.point_to_clients.get_mut(point_id) {
                        clients.remove(&client_id);
                    }
                }
            }
        }
    }

    /// Remove all subscriptions for `client_id`.
    /// Returns the set of point IDs the client was subscribed to.
    pub fn remove_client(&self, client_id: ClientId) -> HashSet<Uuid> {
        let points = self
            .client_to_points
            .remove(&client_id)
            .map(|(_, pts)| pts)
            .unwrap_or_default();

        for point_id in &points {
            if let Some(mut clients) = self.point_to_clients.get_mut(point_id) {
                clients.remove(&client_id);
            }
        }

        points
    }

    /// Return all client IDs subscribed to `point_id`.
    pub fn get_clients_for_point(&self, point_id: &Uuid) -> Vec<ClientId> {
        self.point_to_clients
            .get(point_id)
            .map(|set| set.iter().copied().collect())
            .unwrap_or_default()
    }

    /// Return the number of points `client_id` is currently subscribed to.
    #[allow(dead_code)]
    pub fn client_point_count(&self, client_id: &ClientId) -> usize {
        self.client_to_points
            .get(client_id)
            .map(|pts| pts.len())
            .unwrap_or(0)
    }

    /// Return the total number of (client, point) subscription pairs across all clients.
    pub fn total_subscription_count(&self) -> usize {
        self.client_to_points
            .iter()
            .map(|entry| entry.value().len())
            .sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- subscribe ---

    #[test]
    fn subscribe_returns_subscribed_point_ids() {
        let reg = SubscriptionRegistry::new();
        let client = Uuid::new_v4();
        let p1 = Uuid::new_v4();
        let p2 = Uuid::new_v4();

        let subscribed = reg.subscribe(client, &[p1, p2], 100);
        assert_eq!(subscribed.len(), 2);
        assert!(subscribed.contains(&p1));
        assert!(subscribed.contains(&p2));
    }

    #[test]
    fn subscribe_enforces_per_client_cap() {
        let reg = SubscriptionRegistry::new();
        let client = Uuid::new_v4();
        let points: Vec<Uuid> = (0..5).map(|_| Uuid::new_v4()).collect();

        // Cap is 3 — only first 3 should be accepted.
        let subscribed = reg.subscribe(client, &points, 3);
        assert_eq!(
            subscribed.len(),
            3,
            "Registry must not accept more subscriptions than the per-client cap"
        );
        assert_eq!(reg.client_point_count(&client), 3);
    }

    #[test]
    fn subscribe_is_idempotent_for_duplicate_points() {
        let reg = SubscriptionRegistry::new();
        let client = Uuid::new_v4();
        let p1 = Uuid::new_v4();

        reg.subscribe(client, &[p1], 100);
        // Subscribing to the same point again must not increase count.
        let second = reg.subscribe(client, &[p1], 100);
        assert!(
            second.is_empty(),
            "Duplicate subscribe must not re-add the point"
        );
        assert_eq!(reg.client_point_count(&client), 1);
    }

    // --- get_clients_for_point ---

    #[test]
    fn get_clients_for_point_returns_all_subscribed_clients() {
        let reg = SubscriptionRegistry::new();
        let point = Uuid::new_v4();
        let c1 = Uuid::new_v4();
        let c2 = Uuid::new_v4();
        let c3 = Uuid::new_v4();

        reg.subscribe(c1, &[point], 100);
        reg.subscribe(c2, &[point], 100);
        reg.subscribe(c3, &[point], 100);

        let clients = reg.get_clients_for_point(&point);
        assert_eq!(clients.len(), 3, "All three subscribers must be returned");
        assert!(clients.contains(&c1));
        assert!(clients.contains(&c2));
        assert!(clients.contains(&c3));
    }

    #[test]
    fn get_clients_for_point_returns_empty_for_unsubscribed_point() {
        let reg = SubscriptionRegistry::new();
        let point = Uuid::new_v4();
        assert!(reg.get_clients_for_point(&point).is_empty());
    }

    // --- unsubscribe ---

    #[test]
    fn unsubscribe_removes_client_from_point_lookup() {
        let reg = SubscriptionRegistry::new();
        let client = Uuid::new_v4();
        let point = Uuid::new_v4();

        reg.subscribe(client, &[point], 100);
        reg.unsubscribe(client, &[point]);

        assert!(
            reg.get_clients_for_point(&point).is_empty(),
            "After unsubscribe, client must not appear in point lookup"
        );
        assert_eq!(reg.client_point_count(&client), 0);
    }

    // --- remove_client ---

    #[test]
    fn remove_client_cleans_up_all_subscriptions() {
        let reg = SubscriptionRegistry::new();
        let client = Uuid::new_v4();
        let p1 = Uuid::new_v4();
        let p2 = Uuid::new_v4();

        reg.subscribe(client, &[p1, p2], 100);
        let removed = reg.remove_client(client);

        assert_eq!(removed.len(), 2, "remove_client must return all subscribed points");
        assert!(reg.get_clients_for_point(&p1).is_empty());
        assert!(reg.get_clients_for_point(&p2).is_empty());
        assert_eq!(reg.client_point_count(&client), 0);
    }

    #[test]
    fn remove_unknown_client_returns_empty_set() {
        let reg = SubscriptionRegistry::new();
        let removed = reg.remove_client(Uuid::new_v4());
        assert!(removed.is_empty());
    }

    // --- total_subscription_count ---

    #[test]
    fn total_subscription_count_tracks_adds_and_removes() {
        let reg = SubscriptionRegistry::new();
        let c1 = Uuid::new_v4();
        let c2 = Uuid::new_v4();
        let p1 = Uuid::new_v4();
        let p2 = Uuid::new_v4();

        assert_eq!(reg.total_subscription_count(), 0);
        reg.subscribe(c1, &[p1, p2], 100);
        assert_eq!(reg.total_subscription_count(), 2);
        reg.subscribe(c2, &[p1], 100);
        assert_eq!(reg.total_subscription_count(), 3);
        reg.remove_client(c1);
        assert_eq!(reg.total_subscription_count(), 1);
    }
}
