/// Per-client throttle levels, ordered from least to most aggressive.
///
/// The broker escalates a client through these levels when it reports
/// rising `pending_updates` or dropping `render_fps` via `StatusReport`
/// messages, and de-escalates automatically as the client recovers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default)]
pub enum ThrottleLevel {
    /// Send all updates as they arrive in batches (default).
    #[default]
    Normal,
    /// Increase batch window (250 ms → 500 ms) to reduce update frequency.
    Batch,
    /// Only send the latest value per point per batch (drop intermediates).
    Deduplicate,
    /// Increase batch window further (500 ms → 1 s).
    ReduceFrequency,
    /// Points on minimised / hidden panes get updates at lowest frequency.
    OffScreen,
}

/// Compute the new throttle level for a client based on its reported metrics.
///
/// Escalation: if `render_fps < fps_low_threshold` OR
///             `pending_updates > pending_high_threshold` → escalate one level.
/// De-escalation: if `render_fps > fps_high_threshold` AND
///                `pending_updates < pending_low_threshold` → de-escalate one level.
/// Otherwise: keep the current level.
pub fn compute_throttle(
    current: ThrottleLevel,
    render_fps: f64,
    pending_updates: u32,
    fps_low_threshold: f64,
    fps_high_threshold: f64,
    pending_low_threshold: u32,
    pending_high_threshold: u32,
) -> ThrottleLevel {
    let should_escalate =
        render_fps < fps_low_threshold || pending_updates > pending_high_threshold;
    let should_deescalate =
        render_fps > fps_high_threshold && pending_updates < pending_low_threshold;

    if should_escalate {
        match current {
            ThrottleLevel::Normal => ThrottleLevel::Batch,
            ThrottleLevel::Batch => ThrottleLevel::Deduplicate,
            ThrottleLevel::Deduplicate => ThrottleLevel::ReduceFrequency,
            ThrottleLevel::ReduceFrequency => ThrottleLevel::OffScreen,
            ThrottleLevel::OffScreen => ThrottleLevel::OffScreen, // already at max
        }
    } else if should_deescalate {
        match current {
            ThrottleLevel::Normal => ThrottleLevel::Normal, // already at min
            ThrottleLevel::Batch => ThrottleLevel::Normal,
            ThrottleLevel::Deduplicate => ThrottleLevel::Batch,
            ThrottleLevel::ReduceFrequency => ThrottleLevel::Deduplicate,
            ThrottleLevel::OffScreen => ThrottleLevel::ReduceFrequency,
        }
    } else {
        current
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn compute(current: ThrottleLevel, fps: f64, pending: u32) -> ThrottleLevel {
        // Use spec defaults: fps_low=30, fps_high=55, pending_low=5, pending_high=50
        compute_throttle(current, fps, pending, 30.0, 55.0, 5, 50)
    }

    #[test]
    fn normal_escalates_on_low_fps() {
        assert_eq!(
            compute(ThrottleLevel::Normal, 25.0, 0),
            ThrottleLevel::Batch
        );
    }

    #[test]
    fn normal_escalates_on_high_pending() {
        assert_eq!(
            compute(ThrottleLevel::Normal, 60.0, 60),
            ThrottleLevel::Batch
        );
    }

    #[test]
    fn batch_escalates_to_deduplicate() {
        assert_eq!(
            compute(ThrottleLevel::Batch, 20.0, 0),
            ThrottleLevel::Deduplicate
        );
    }

    #[test]
    fn offscreen_stays_at_max() {
        assert_eq!(
            compute(ThrottleLevel::OffScreen, 5.0, 100),
            ThrottleLevel::OffScreen
        );
    }

    #[test]
    fn deescalates_on_recovery() {
        assert_eq!(
            compute(ThrottleLevel::Batch, 60.0, 2),
            ThrottleLevel::Normal
        );
    }

    #[test]
    fn normal_stays_normal_on_recovery() {
        assert_eq!(
            compute(ThrottleLevel::Normal, 60.0, 2),
            ThrottleLevel::Normal
        );
    }

    #[test]
    fn stays_current_in_neutral_zone() {
        // FPS in range [30, 55], pending in range [5, 50] — hold level.
        assert_eq!(
            compute(ThrottleLevel::Deduplicate, 40.0, 20),
            ThrottleLevel::Deduplicate
        );
    }
}
