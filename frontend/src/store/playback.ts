/**
 * Playback store — shared Live/Historical mode state (doc 07, 08, 32)
 *
 * Consumed by Console, Process, and Forensics to switch between
 * live WebSocket values and historical values at a scrubbed timestamp.
 */
import { create } from 'zustand'

export type PlaybackMode = 'live' | 'historical'
export type PlaybackSpeed = 1 | 2 | 5 | 10 | 60 | 300

interface PlaybackStore {
  mode: PlaybackMode
  /** Current playback position as epoch ms (only relevant in historical mode) */
  timestamp: number
  /** The scrub window: start and end as epoch ms */
  timeRange: { start: number; end: number }
  isPlaying: boolean
  speed: PlaybackSpeed

  setMode: (mode: PlaybackMode) => void
  setTimestamp: (ts: number) => void
  setTimeRange: (range: { start: number; end: number }) => void
  setPlaying: (playing: boolean) => void
  setSpeed: (speed: PlaybackSpeed) => void
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
  speed: 1,

  setMode: (mode) =>
    set((s) => ({
      mode,
      // When switching to historical, position at end of range; stop playback
      timestamp: mode === 'historical' ? s.timeRange.end : Date.now(),
      isPlaying: false,
      timeRange: mode === 'historical' ? s.timeRange : defaultRange(),
    })),
  setTimestamp: (timestamp) => set({ timestamp }),
  setTimeRange: (timeRange) => set({ timeRange }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setSpeed: (speed) => set({ speed }),
}))
