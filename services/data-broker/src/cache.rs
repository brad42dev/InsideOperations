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

    /// Update the cached value for `point_id`. Returns the **previous**
    /// `CachedValue` if one existed, so callers can perform change-only
    /// detection and deadband filtering before deciding to fan out.
    pub fn update(
        &self,
        point_id: Uuid,
        value: f64,
        quality: String,
        timestamp: DateTime<Utc>,
    ) -> Option<CachedValue> {
        self.inner.insert(
            point_id,
            CachedValue {
                value,
                quality,
                timestamp,
                stale: false,
            },
        )
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

    /// Returns all `(point_id, CachedValue)` pairs for points whose last
    /// update timestamp is before `threshold`. Unlike `find_stale` this
    /// does not filter already-stale points, because the heartbeat should
    /// resend even stale values so clients know the connection is alive.
    pub fn find_silent(&self, threshold: DateTime<Utc>) -> Vec<(Uuid, CachedValue)> {
        self.inner
            .iter()
            .filter_map(|entry| {
                if entry.timestamp < threshold {
                    Some((*entry.key(), entry.clone()))
                } else {
                    None
                }
            })
            .collect()
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

    /// Test-only helper: insert a `CachedValue` directly, bypassing normal
    /// `update` semantics (preserves the `stale` flag as supplied).
    #[cfg(test)]
    pub fn inner_insert_for_test(&self, point_id: Uuid, value: CachedValue) {
        self.inner.insert(point_id, value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn make_cache_with_entry(
        point_id: Uuid,
        age_secs: i64,
        stale: bool,
    ) -> ShadowCache {
        let cache = ShadowCache::new();
        let ts = Utc::now() - Duration::seconds(age_secs);
        cache.inner.insert(
            point_id,
            CachedValue {
                value: 42.0,
                quality: "good".to_string(),
                timestamp: ts,
                stale,
            },
        );
        cache
    }

    // --- find_stale ---

    #[test]
    fn find_stale_returns_point_older_than_threshold() {
        let point_id = Uuid::new_v4();
        // Insert a point with timestamp 120 seconds ago.
        let cache = make_cache_with_entry(point_id, 120, false);
        // Threshold: 60 seconds ago — point is older than that.
        let threshold = Utc::now() - Duration::seconds(60);
        let stale = cache.find_stale(threshold);
        assert_eq!(stale.len(), 1, "Expected one stale point");
        assert_eq!(stale[0].0, point_id);
    }

    #[test]
    fn find_stale_excludes_point_within_threshold() {
        let point_id = Uuid::new_v4();
        // Insert a point with timestamp 10 seconds ago.
        let cache = make_cache_with_entry(point_id, 10, false);
        // Threshold: 60 seconds ago — point is newer.
        let threshold = Utc::now() - Duration::seconds(60);
        let stale = cache.find_stale(threshold);
        assert!(stale.is_empty(), "Fresh point should not be returned");
    }

    #[test]
    fn find_stale_excludes_already_marked_stale_points() {
        let point_id = Uuid::new_v4();
        // Point is old AND already stale — find_stale must skip it to avoid
        // re-broadcasting a PointStale that was already sent.
        let cache = make_cache_with_entry(point_id, 120, true);
        let threshold = Utc::now() - Duration::seconds(60);
        let stale = cache.find_stale(threshold);
        assert!(
            stale.is_empty(),
            "Already-stale point must not be re-returned by find_stale"
        );
    }

    #[test]
    fn find_stale_empty_cache_returns_empty_vec() {
        let cache = ShadowCache::new();
        let threshold = Utc::now();
        let stale = cache.find_stale(threshold);
        assert!(stale.is_empty());
    }

    // --- mark_stale ---

    #[test]
    fn mark_stale_returns_true_on_first_transition() {
        let point_id = Uuid::new_v4();
        let cache = make_cache_with_entry(point_id, 120, false);
        // First call: fresh → stale, must return true.
        assert!(
            cache.mark_stale(&point_id),
            "First mark_stale call should signal a state transition"
        );
    }

    #[test]
    fn mark_stale_returns_false_when_already_stale() {
        let point_id = Uuid::new_v4();
        let cache = make_cache_with_entry(point_id, 120, true);
        // Point is already stale; no new transition.
        assert!(
            !cache.mark_stale(&point_id),
            "mark_stale on an already-stale point must return false"
        );
    }

    #[test]
    fn mark_stale_returns_false_for_unknown_point() {
        let cache = ShadowCache::new();
        let unknown = Uuid::new_v4();
        assert!(!cache.mark_stale(&unknown));
    }

    // --- update clears stale flag ---

    #[test]
    fn update_clears_stale_flag() {
        let point_id = Uuid::new_v4();
        let cache = make_cache_with_entry(point_id, 120, true);
        // A fresh value arriving must reset the stale flag.
        cache.update(point_id, 55.0, "good".to_string(), Utc::now());
        let entry = cache.get(&point_id).expect("entry should exist after update");
        assert!(!entry.stale, "update() must clear the stale flag");
    }

    // --- get ---

    #[test]
    fn get_returns_none_for_unknown_point() {
        let cache = ShadowCache::new();
        assert!(cache.get(&Uuid::new_v4()).is_none());
    }

    #[test]
    fn get_returns_stored_value() {
        let cache = ShadowCache::new();
        let point_id = Uuid::new_v4();
        let ts = Utc::now();
        cache.update(point_id, 3.14, "good".to_string(), ts);
        let entry = cache.get(&point_id).expect("entry must be present");
        assert!((entry.value - 3.14).abs() < f64::EPSILON);
        assert_eq!(entry.quality, "good");
    }
}
