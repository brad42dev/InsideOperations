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
