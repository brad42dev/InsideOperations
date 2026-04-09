import { useState, useEffect, useRef } from "react";

export enum DataQualityState {
  Normal = "Normal",
  Stale = "Stale",
  Uncertain = "Uncertain",
  BadPhase1 = "BadPhase1",
  BadPhase2 = "BadPhase2",
  NotConnected = "NotConnected",
}

export const BAD_ONSET_DEBOUNCE_MS = 3000;
export const BAD_PHASE1_DURATION_MS = 30000;
export const BAD_RECOVERY_DEBOUNCE_MS = 5000;
export const STALE_THRESHOLD_MS = 60000;

const BAD_QUALITIES = new Set([
  "bad",
  "comm_fail",
  "bad_wait_for_init",
  "last_usable_value",
]);
// Uncertain = show last known value with dotted outline, no value degradation.
const UNCERTAIN_QUALITIES = new Set(["uncertain"]);
const NOT_CONNECTED_QUALITIES = new Set([
  "not_connected",
  "notconnected",
  "disconnected",
  "no_config",
  "no_comm",
]);

/**
 * Computes the data quality state for a single point value display element.
 *
 * State precedence: NotConnected > Bad (phase1/2) > Stale > Normal.
 * Bad onset is debounced 3s before entering BadPhase1.
 * BadPhase1 lasts 30s, then transitions to BadPhase2 (value hidden).
 * Recovery from bad quality is debounced 5s before returning to Normal/Stale.
 */
export function useDataQuality(
  lastUpdateMs: number,
  quality: string,
): DataQualityState {
  const [state, setState] = useState<DataQualityState>(DataQualityState.Normal);
  const badOnsetRef = useRef<number | null>(null);
  const phase1StartRef = useRef<number | null>(null);
  const recoveryStartRef = useRef<number | null>(null);
  const stateRef = useRef<DataQualityState>(DataQualityState.Normal);

  useEffect(() => {
    const compute = (): DataQualityState => {
      const now = Date.now();
      const q = quality.toLowerCase();

      if (NOT_CONNECTED_QUALITIES.has(q)) {
        badOnsetRef.current = null;
        phase1StartRef.current = null;
        recoveryStartRef.current = null;
        return DataQualityState.NotConnected;
      }

      // Uncertain: show last known value with dotted outline — no debounce, no phase progression.
      if (UNCERTAIN_QUALITIES.has(q)) {
        badOnsetRef.current = null;
        phase1StartRef.current = null;
        recoveryStartRef.current = null;
        return DataQualityState.Uncertain;
      }

      const isBad = BAD_QUALITIES.has(q);
      const isStale =
        lastUpdateMs > 0 && now - lastUpdateMs > STALE_THRESHOLD_MS;

      if (isBad) {
        recoveryStartRef.current = null;
        if (badOnsetRef.current === null) badOnsetRef.current = now;
        const sinceOnset = now - badOnsetRef.current;
        if (sinceOnset < BAD_ONSET_DEBOUNCE_MS) {
          return isStale ? DataQualityState.Stale : DataQualityState.Normal;
        }
        if (phase1StartRef.current === null) {
          phase1StartRef.current = badOnsetRef.current + BAD_ONSET_DEBOUNCE_MS;
        }
        const sincePhase1 = now - phase1StartRef.current;
        return sincePhase1 < BAD_PHASE1_DURATION_MS
          ? DataQualityState.BadPhase1
          : DataQualityState.BadPhase2;
      }

      // Good quality — clear bad onset tracking
      badOnsetRef.current = null;
      phase1StartRef.current = null;

      const wasBad =
        stateRef.current === DataQualityState.BadPhase1 ||
        stateRef.current === DataQualityState.BadPhase2;
      if (wasBad) {
        if (recoveryStartRef.current === null) recoveryStartRef.current = now;
        if (now - recoveryStartRef.current < BAD_RECOVERY_DEBOUNCE_MS) {
          return stateRef.current; // hold bad display during recovery debounce
        }
      }
      recoveryStartRef.current = null;
      return isStale ? DataQualityState.Stale : DataQualityState.Normal;
    };

    const tick = () => {
      const next = compute();
      stateRef.current = next;
      setState(next);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdateMs, quality]);

  return state;
}
