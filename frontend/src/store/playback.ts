/**
 * Playback store — shared Live/Historical mode state (doc 07, 08, 32)
 *
 * Consumed by Console, Process, and Forensics to switch between
 * live WebSocket values and historical values at a scrubbed timestamp.
 */
import { create } from 'zustand'

export type PlaybackMode = 'live' | 'historical'
export type PlaybackSpeed = 1 | 2 | 4 | 8 | 16 | 32

interface PlaybackStore {
  mode: PlaybackMode
  /** Current playback position as epoch ms (only relevant in historical mode) */
  timestamp: number
  /** The scrub window: start and end as epoch ms */
  timeRange: { start: number; end: number }
  isPlaying: boolean
  isReversing: boolean
  speed: PlaybackSpeed
  /** Loop region — null means not set */
  loopStart: number | null
  loopEnd: number | null
  loopEnabled: boolean
  /**
   * Global time range for dashboard time-context mode.
   * When set, widgets that support time context (e.g. LineChart) use this
   * range instead of their per-widget timeRange config.
   * ISO 8601 strings; null means "not set — use per-widget default".
   */
  globalTimeRange: { start: string; end: string } | null

  setMode: (mode: PlaybackMode) => void
  setTimestamp: (ts: number) => void
  setTimeRange: (range: { start: number; end: number }) => void
  setPlaying: (playing: boolean) => void
  setReversing: (reversing: boolean) => void
  setSpeed: (speed: PlaybackSpeed) => void
  setLoopStart: (ts: number | null) => void
  setLoopEnd: (ts: number | null) => void
  setLoopEnabled: (enabled: boolean) => void
  setGlobalTimeRange: (range: { start: string; end: string } | null) => void
}

function defaultRange() {
  const end = Date.now()
  const start = end - 24 * 60 * 60 * 1000 // last 24 hours
  return { start, end }
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  mode: 'live',
  timestamp: Date.now(),
  timeRange: defaultRange(),
  isPlaying: false,
  isReversing: false,
  speed: 1,
  loopStart: null,
  loopEnd: null,
  loopEnabled: false,
  globalTimeRange: null,

  setMode: (mode) =>
    set((s) => ({
      mode,
      // When switching to historical, position at end of range; stop playback
      timestamp: mode === 'historical' ? s.timeRange.end : Date.now(),
      isPlaying: false,
      isReversing: false,
      timeRange: mode === 'historical' ? s.timeRange : defaultRange(),
    })),
  setTimestamp: (timestamp) => set({ timestamp }),
  setTimeRange: (timeRange) => set({ timeRange }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setReversing: (isReversing) => set({ isReversing }),
  setSpeed: (speed) => set({ speed }),
  setLoopStart: (loopStart) => set({ loopStart }),
  setLoopEnd: (loopEnd) => set({ loopEnd }),
  setLoopEnabled: (loopEnabled) => set({ loopEnabled }),
  setGlobalTimeRange: (globalTimeRange) => set({ globalTimeRange }),
}))
