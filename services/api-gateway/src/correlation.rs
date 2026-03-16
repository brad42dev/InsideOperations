//! Statistical correlation engine for the Forensics module.
//!
//! Provides Pearson, Spearman, FFT-based cross-correlation, spike detection,
//! and a variance-based change-point detector.  All heavy loops run in rayon
//! thread-pool workers so they don't block the Tokio executor.

use std::collections::HashMap;

use rayon::prelude::*;
use rustfft::{num_complex::Complex, FftPlanner};

// ---------------------------------------------------------------------------
// Public data structures
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct TimeSeriesPoint {
    /// Unix timestamp in milliseconds.
    pub timestamp: i64,
    pub value: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CorrelationResult {
    pub point_id_a: String,
    pub point_id_b: String,
    pub pearson: f64,
    pub spearman: f64,
    pub max_cross_corr: f64,
    /// Lag in milliseconds at the peak cross-correlation.
    pub lag_ms: i64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ChangePoint {
    pub timestamp: i64,
    pub point_id: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SpikeResult {
    pub point_id: String,
    pub timestamp: i64,
    pub value: f64,
    pub z_score: f64,
}

// ---------------------------------------------------------------------------
// Pearson correlation
// ---------------------------------------------------------------------------

/// Compute the Pearson correlation coefficient between two equal-length slices.
///
/// Returns `f64::NAN` when `n < 3` or if either series has zero variance.
pub fn pearson_correlation(a: &[f64], b: &[f64]) -> f64 {
    let n = a.len().min(b.len());
    if n < 3 {
        return f64::NAN;
    }

    let mean_a = a[..n].iter().sum::<f64>() / n as f64;
    let mean_b = b[..n].iter().sum::<f64>() / n as f64;

    let mut num = 0.0_f64;
    let mut sq_a = 0.0_f64;
    let mut sq_b = 0.0_f64;

    for i in 0..n {
        let da = a[i] - mean_a;
        let db = b[i] - mean_b;
        num += da * db;
        sq_a += da * da;
        sq_b += db * db;
    }

    let denom = (sq_a * sq_b).sqrt();
    if denom == 0.0 {
        return f64::NAN;
    }
    num / denom
}

// ---------------------------------------------------------------------------
// Spearman rank correlation
// ---------------------------------------------------------------------------

/// Rank a slice, handling ties by assigning the average of tied ranks.
fn rank_vec(v: &[f64]) -> Vec<f64> {
    let n = v.len();
    // Build (value, original_index) pairs and sort by value.
    let mut indexed: Vec<(f64, usize)> = v.iter().copied().enumerate().map(|(i, x)| (x, i)).collect();
    indexed.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    let mut ranks = vec![0.0_f64; n];
    let mut i = 0;
    while i < n {
        let mut j = i + 1;
        // Find the extent of tied values.
        while j < n && (indexed[j].0 - indexed[i].0).abs() < f64::EPSILON {
            j += 1;
        }
        // Average rank for tied group (1-based rank = index+1).
        let avg_rank = (i + 1 + j) as f64 / 2.0;
        for k in i..j {
            ranks[indexed[k].1] = avg_rank;
        }
        i = j;
    }
    ranks
}

/// Compute the Spearman rank correlation between two equal-length slices.
pub fn spearman_correlation(a: &[f64], b: &[f64]) -> f64 {
    let n = a.len().min(b.len());
    if n < 3 {
        return f64::NAN;
    }
    let ra = rank_vec(&a[..n]);
    let rb = rank_vec(&b[..n]);
    pearson_correlation(&ra, &rb)
}

// ---------------------------------------------------------------------------
// FFT-based cross-correlation
// ---------------------------------------------------------------------------

/// Zero-pad a slice to the next power of two that is >= `min_len`.
fn next_pow2(n: usize) -> usize {
    let mut p = 1;
    while p < n {
        p <<= 1;
    }
    p
}

/// Compute FFT-based cross-correlation of `a` and `b`.
///
/// Returns `(max_normalized_correlation, lag_samples)`.
/// Positive lag means `b` lags behind `a`.
pub fn cross_correlate(a: &[f64], b: &[f64]) -> (f64, i64) {
    let n = a.len().min(b.len());
    if n < 2 {
        return (f64::NAN, 0);
    }

    let fft_len = next_pow2(2 * n);
    let mut planner = FftPlanner::<f64>::new();
    let fft = planner.plan_fft_forward(fft_len);
    let ifft = planner.plan_fft_inverse(fft_len);

    // Build complex buffers zero-padded to fft_len.
    let mut buf_a: Vec<Complex<f64>> = a[..n]
        .iter()
        .map(|&x| Complex::new(x, 0.0))
        .chain(std::iter::repeat(Complex::new(0.0, 0.0)))
        .take(fft_len)
        .collect();

    let mut buf_b: Vec<Complex<f64>> = b[..n]
        .iter()
        .map(|&x| Complex::new(x, 0.0))
        .chain(std::iter::repeat(Complex::new(0.0, 0.0)))
        .take(fft_len)
        .collect();

    fft.process(&mut buf_a);
    fft.process(&mut buf_b);

    // Cross-power spectrum: A * conj(B).
    let mut cross: Vec<Complex<f64>> = buf_a
        .iter()
        .zip(buf_b.iter())
        .map(|(a, b)| a * b.conj())
        .collect();

    ifft.process(&mut cross);

    // Normalise by fft_len so values are comparable.
    let scale = fft_len as f64;

    // Find the index with the maximum absolute real component.
    let (max_idx, max_val) = cross
        .iter()
        .enumerate()
        .map(|(i, c)| (i, c.re / scale))
        .fold((0usize, f64::NEG_INFINITY), |(mi, mv), (i, v)| {
            if v > mv { (i, v) } else { (mi, mv) }
        });

    // Convert circular index to a signed lag in [-n+1, n-1].
    let lag = if max_idx < n {
        max_idx as i64
    } else {
        max_idx as i64 - fft_len as i64
    };

    // Normalise cross-correlation to [-1, 1] using the zero-lag power.
    let power_a: f64 = a[..n].iter().map(|&x| x * x).sum::<f64>() / n as f64;
    let power_b: f64 = b[..n].iter().map(|&x| x * x).sum::<f64>() / n as f64;
    let normaliser = (power_a * power_b).sqrt();

    let normalised = if normaliser > 0.0 {
        max_val / normaliser
    } else {
        f64::NAN
    };

    (normalised, lag)
}

// ---------------------------------------------------------------------------
// Spike detection (rolling z-score)
// ---------------------------------------------------------------------------

/// Detect spikes in a time series using a rolling-window z-score.
///
/// Window size is 30 samples; `threshold` is the z-score magnitude cutoff.
pub fn detect_spikes(series: &[TimeSeriesPoint], threshold: f64) -> Vec<SpikeResult> {
    const WINDOW: usize = 30;
    let mut spikes = Vec::new();

    for i in 0..series.len() {
        let start = i.saturating_sub(WINDOW);
        let end = i; // exclusive of current point to avoid including it
        let window = &series[start..end];

        if window.len() < 3 {
            continue;
        }

        let mean = window.iter().map(|p| p.value).sum::<f64>() / window.len() as f64;
        let variance = window
            .iter()
            .map(|p| (p.value - mean).powi(2))
            .sum::<f64>()
            / window.len() as f64;
        let std_dev = variance.sqrt();

        if std_dev == 0.0 {
            continue;
        }

        let z = (series[i].value - mean) / std_dev;
        if z.abs() > threshold {
            spikes.push(SpikeResult {
                point_id: String::new(), // caller fills in point_id
                timestamp: series[i].timestamp,
                value: series[i].value,
                z_score: z,
            });
        }
    }

    spikes
}

// ---------------------------------------------------------------------------
// Change-point detection (variance ratio)
// ---------------------------------------------------------------------------

/// Simple variance-based change-point detector.
///
/// Splits the series at its midpoint and flags a change if the variance ratio
/// (larger / smaller) exceeds 3.0.  Returns up to one change point per series.
fn detect_change_points(point_id: &str, series: &[TimeSeriesPoint]) -> Vec<ChangePoint> {
    const RATIO_THRESHOLD: f64 = 3.0;
    const MIN_LEN: usize = 6;

    if series.len() < MIN_LEN {
        return vec![];
    }

    let mid = series.len() / 2;
    let first_half: Vec<f64> = series[..mid].iter().map(|p| p.value).collect();
    let second_half: Vec<f64> = series[mid..].iter().map(|p| p.value).collect();

    let var = |v: &[f64]| -> f64 {
        let mean = v.iter().sum::<f64>() / v.len() as f64;
        v.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / v.len() as f64
    };

    let v1 = var(&first_half);
    let v2 = var(&second_half);

    // Avoid divide-by-zero; treat near-zero variance as no change.
    let ratio = if v1 < 1e-12 && v2 < 1e-12 {
        1.0
    } else if v1 < 1e-12 || v2 < 1e-12 {
        RATIO_THRESHOLD + 1.0
    } else {
        v1.max(v2) / v1.min(v2)
    };

    if ratio > RATIO_THRESHOLD {
        vec![ChangePoint {
            timestamp: series[mid].timestamp,
            point_id: point_id.to_string(),
        }]
    } else {
        vec![]
    }
}

// ---------------------------------------------------------------------------
// Full correlation analysis
// ---------------------------------------------------------------------------

/// Run pairwise correlation analysis across all named time series.
///
/// * Aligns each pair by interpolating values at common timestamps derived from
///   `sample_interval_ms`.
/// * Uses rayon for parallel pair processing.
/// * Returns `(correlations, change_points)`.
pub fn run_correlation_analysis(
    series: &HashMap<String, Vec<TimeSeriesPoint>>,
    sample_interval_ms: i64,
) -> (Vec<CorrelationResult>, Vec<ChangePoint>) {
    let ids: Vec<&String> = series.keys().collect();
    let n = ids.len();

    // Build all unique pairs (i, j) with i < j.
    let pairs: Vec<(usize, usize)> = (0..n)
        .flat_map(|i| (i + 1..n).map(move |j| (i, j)))
        .collect();

    // Process pairs in parallel.
    let correlations: Vec<CorrelationResult> = pairs
        .par_iter()
        .filter_map(|&(i, j)| {
            let id_a = ids[i];
            let id_b = ids[j];
            let ts_a = series.get(id_a)?;
            let ts_b = series.get(id_b)?;

            if ts_a.is_empty() || ts_b.is_empty() {
                return None;
            }

            // Align the two series at a common grid.
            let (vals_a, vals_b) = align_series(ts_a, ts_b, sample_interval_ms);

            if vals_a.len() < 3 {
                return None;
            }

            let pearson = pearson_correlation(&vals_a, &vals_b);
            let spearman = spearman_correlation(&vals_a, &vals_b);
            let (max_cross_corr, lag_samples) = cross_correlate(&vals_a, &vals_b);
            let lag_ms = lag_samples * sample_interval_ms;

            Some(CorrelationResult {
                point_id_a: id_a.clone(),
                point_id_b: id_b.clone(),
                pearson,
                spearman,
                max_cross_corr,
                lag_ms,
            })
        })
        .collect();

    // Change-point detection (serial — each series is independent).
    let change_points: Vec<ChangePoint> = ids
        .iter()
        .flat_map(|id| {
            let ts = series.get(*id).map(|v| v.as_slice()).unwrap_or(&[]);
            detect_change_points(id, ts)
        })
        .collect();

    (correlations, change_points)
}

// ---------------------------------------------------------------------------
// Public re-export of change-point detector for testing
// ---------------------------------------------------------------------------

/// Wrapper exposed only to tests (private function, accessible within module).
#[cfg(test)]
pub(crate) fn variance_ratio_change_points(
    point_id: &str,
    series: &[TimeSeriesPoint],
) -> Vec<ChangePoint> {
    detect_change_points(point_id, series)
}

// ---------------------------------------------------------------------------
// Series alignment helper
// ---------------------------------------------------------------------------

/// Align two time series onto a common regular grid by nearest-neighbour lookup.
///
/// Returns two equal-length `Vec<f64>` containing the aligned values.
fn align_series(
    a: &[TimeSeriesPoint],
    b: &[TimeSeriesPoint],
    interval_ms: i64,
) -> (Vec<f64>, Vec<f64>) {
    if a.is_empty() || b.is_empty() {
        return (vec![], vec![]);
    }

    let start = a[0].timestamp.max(b[0].timestamp);
    let end = a[a.len() - 1].timestamp.min(b[b.len() - 1].timestamp);

    if end <= start || interval_ms <= 0 {
        return (vec![], vec![]);
    }

    let steps = ((end - start) / interval_ms) as usize + 1;
    let mut vals_a = Vec::with_capacity(steps);
    let mut vals_b = Vec::with_capacity(steps);

    let nearest = |ts: i64, series: &[TimeSeriesPoint]| -> Option<f64> {
        let pos = series.partition_point(|p| p.timestamp < ts);
        if pos == 0 {
            series.first().map(|p| p.value)
        } else if pos >= series.len() {
            series.last().map(|p| p.value)
        } else {
            let before = &series[pos - 1];
            let after = &series[pos];
            if (ts - before.timestamp) <= (after.timestamp - ts) {
                Some(before.value)
            } else {
                Some(after.value)
            }
        }
    };

    for step in 0..steps {
        let ts = start + step as i64 * interval_ms;
        if let (Some(va), Some(vb)) = (nearest(ts, a), nearest(ts, b)) {
            vals_a.push(va);
            vals_b.push(vb);
        }
    }

    (vals_a, vals_b)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------
    // Helper builders
    // ------------------------------------------------------------------

    #[allow(dead_code)]
    fn flat_series(value: f64, count: usize, start_ts: i64, interval_ms: i64) -> Vec<TimeSeriesPoint> {
        (0..count)
            .map(|i| TimeSeriesPoint {
                timestamp: start_ts + i as i64 * interval_ms,
                value,
            })
            .collect()
    }

    #[allow(dead_code)]
    fn linear_series(start: f64, step: f64, count: usize) -> Vec<f64> {
        (0..count).map(|i| start + i as f64 * step).collect()
    }

    // ------------------------------------------------------------------
    // pearson_correlation
    // ------------------------------------------------------------------

    #[test]
    fn pearson_of_identical_series_is_1() {
        let a: Vec<f64> = (0..20).map(|i| i as f64).collect();
        let r = pearson_correlation(&a, &a);
        assert!((r - 1.0).abs() < 1e-10, "identical series must correlate at 1.0, got {r}");
    }

    #[test]
    fn pearson_of_perfectly_negatively_correlated_series_is_minus_1() {
        let a: Vec<f64> = (0..20).map(|i| i as f64).collect();
        let b: Vec<f64> = (0..20).map(|i| -(i as f64)).collect();
        let r = pearson_correlation(&a, &b);
        assert!((r - (-1.0)).abs() < 1e-10, "perfectly anti-correlated must be -1.0, got {r}");
    }

    #[test]
    fn pearson_of_all_zeros_vs_nonzero_series_is_nan() {
        let zeros = vec![0.0_f64; 20];
        let nonzero: Vec<f64> = (1..=20).map(|i| i as f64).collect();
        let r = pearson_correlation(&zeros, &nonzero);
        assert!(r.is_nan(), "zero-variance series must yield NaN, got {r}");
    }

    #[test]
    fn pearson_returns_nan_for_fewer_than_3_points() {
        let a = vec![1.0_f64, 2.0];
        let b = vec![3.0_f64, 4.0];
        let r = pearson_correlation(&a, &b);
        assert!(r.is_nan(), "fewer than 3 points must yield NaN");
    }

    #[test]
    fn pearson_hand_calculated_example() {
        // a = [1, 2, 3, 4, 5], b = [2, 4, 5, 4, 5]
        // Mean a = 3.0, Mean b = 4.0
        // Pearson ≈ 0.7746 (known result)
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let b = vec![2.0, 4.0, 5.0, 4.0, 5.0];
        let r = pearson_correlation(&a, &b);
        assert!((r - 0.7746).abs() < 1e-3, "hand-calculated pearson should be ~0.7746, got {r}");
    }

    // ------------------------------------------------------------------
    // detect_spikes
    // ------------------------------------------------------------------

    #[test]
    fn detect_spikes_noisy_series_with_one_outlier_detects_only_that_index() {
        // Build a series with small Gaussian-like noise (alternating ±1 around
        // a mean of 100.0) so the window has non-zero variance.  Then plant a
        // spike at index 40 that is many sigma above the window mean.
        //
        // The detect_spikes window excludes the current point, so the
        // std_dev of the look-back window must be > 0 for a detection to occur.
        let mut series: Vec<TimeSeriesPoint> = (0..50)
            .map(|i| {
                // Small alternating noise gives std_dev ≈ 1.0
                let noise = if i % 2 == 0 { 1.0 } else { -1.0 };
                TimeSeriesPoint {
                    timestamp: i as i64 * 1000,
                    value: 100.0 + noise,
                }
            })
            .collect();
        // Plant a spike at index 40: value is 100 + 500 σ away from 100 ± 1
        series[40].value = 10_000.0;

        let spikes = detect_spikes(&series, 3.0);

        assert_eq!(spikes.len(), 1, "exactly one spike should be detected");
        assert_eq!(
            spikes[0].timestamp,
            series[40].timestamp,
            "spike timestamp must match planted outlier"
        );
    }

    #[test]
    fn detect_spikes_flat_series_without_outlier_returns_empty() {
        let series: Vec<TimeSeriesPoint> = (0..50)
            .map(|i| TimeSeriesPoint { timestamp: i as i64 * 1000, value: 5.0 })
            .collect();
        let spikes = detect_spikes(&series, 3.0);
        assert!(spikes.is_empty(), "flat series must produce no spikes");
    }

    #[test]
    fn detect_spikes_too_short_series_returns_empty() {
        // Window requires at least 3 points before the current index.
        let series: Vec<TimeSeriesPoint> = vec![
            TimeSeriesPoint { timestamp: 0, value: 1.0 },
            TimeSeriesPoint { timestamp: 1000, value: 1.0 },
        ];
        let spikes = detect_spikes(&series, 1.0);
        assert!(spikes.is_empty(), "series too short to form a window must return no spikes");
    }

    // ------------------------------------------------------------------
    // variance_ratio_change_points (wraps detect_change_points)
    // ------------------------------------------------------------------

    #[test]
    fn change_points_detected_when_variance_step_at_midpoint() {
        // First half: constant (zero variance). Second half: high variance.
        let mut series: Vec<TimeSeriesPoint> = Vec::new();
        let n = 20usize;
        // Low variance first half
        for i in 0..n {
            series.push(TimeSeriesPoint { timestamp: i as i64 * 1000, value: 1.0 });
        }
        // High variance second half — alternating ±100
        for i in n..2 * n {
            let v = if i % 2 == 0 { 100.0 } else { -100.0 };
            series.push(TimeSeriesPoint { timestamp: i as i64 * 1000, value: v });
        }

        let cps = variance_ratio_change_points("pt1", &series);
        assert!(!cps.is_empty(), "a clear variance step must produce at least one change point");

        // The change point should be near the midpoint.
        let mid_ts = series[n].timestamp;
        assert_eq!(
            cps[0].timestamp, mid_ts,
            "change point timestamp must equal series[mid].timestamp"
        );
    }

    #[test]
    fn change_points_not_detected_for_uniformly_flat_series() {
        let series: Vec<TimeSeriesPoint> = (0..20)
            .map(|i| TimeSeriesPoint { timestamp: i as i64 * 1000, value: 42.0 })
            .collect();
        let cps = variance_ratio_change_points("pt2", &series);
        assert!(cps.is_empty(), "flat series must not produce change points");
    }

    #[test]
    fn change_points_too_short_series_returns_empty() {
        let series: Vec<TimeSeriesPoint> = (0..5)
            .map(|i| TimeSeriesPoint { timestamp: i as i64, value: i as f64 })
            .collect();
        let cps = variance_ratio_change_points("pt3", &series);
        assert!(cps.is_empty(), "series shorter than MIN_LEN must return no change points");
    }
}
