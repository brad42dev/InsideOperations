use chrono::{DateTime, Utc};
use dashmap::DashMap;
use uuid::Uuid;

#[derive(Clone, Debug)]
pub struct CachedValue {
    pub value: f64,
    pub quality: String,
    pub timestamp: DateTime<Utc>,
    pub stale: bool,
}

pub struct ShadowCache {
    inner: DashMap<Uuid, CachedValue>,
}

impl ShadowCache {
    pub fn new() -> Self {
        Self {
            inner: DashMap::new(),
        }
    }

    pub fn update(
        &self,
        point_id: Uuid,
        value: f64,
        quality: String,
        timestamp: DateTime<Utc>,
    ) {
        self.inner.insert(
            point_id,
            CachedValue {
                value,
                quality,
                timestamp,
                stale: false,
            },
        );
    }

    pub fn get(&self, point_id: &Uuid) -> Option<CachedValue> {
        self.inner.get(point_id).map(|v| v.clone())
    }

    /// Mark a point as stale. Returns `true` if it was previously non-stale
    /// (i.e., a state transition occurred and callers should broadcast).
    pub fn mark_stale(&self, point_id: &Uuid) -> bool {
        if let Some(mut entry) = self.inner.get_mut(point_id) {
            if !entry.stale {
                entry.stale = true;
                return true;
            }
        }
        false
    }

    #[allow(dead_code)]
    pub fn mark_fresh(&self, point_id: &Uuid) {
        if let Some(mut entry) = self.inner.get_mut(point_id) {
            entry.stale = false;
        }
    }

    /// Returns all (point_id, last_timestamp) pairs where the last update was
    /// before `threshold` and the point is not already marked stale.
    pub fn find_stale(&self, threshold: DateTime<Utc>) -> Vec<(Uuid, DateTime<Utc>)> {
        self.inner
            .iter()
            .filter_map(|entry| {
                if !entry.stale && entry.timestamp < threshold {
                    Some((*entry.key(), entry.timestamp))
                } else {
                    None
                }
            })
            .collect()
    }

    /// Warm the cache from persisted data (called on startup).
    pub fn warm(&self, entries: Vec<(Uuid, CachedValue)>) {
        for (point_id, value) in entries {
            self.inner.insert(point_id, value);
        }
    }
}
