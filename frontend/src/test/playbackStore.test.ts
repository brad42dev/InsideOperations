import { describe, it, expect, beforeEach } from 'vitest'
import { usePlaybackStore } from '../store/playback'

// ---------------------------------------------------------------------------
// playback store — state transitions for Live/Historical mode
// ---------------------------------------------------------------------------

function resetStore() {
  // Reset to initial state between tests
  usePlaybackStore.setState({
    mode: 'live',
    timestamp: Date.now(),
    timeRange: { start: Date.now() - 24 * 3600_000, end: Date.now() },
    isPlaying: false,
    speed: 1,
  })
}

describe('usePlaybackStore — initial state', () => {
  beforeEach(resetStore)

  it('starts in live mode', () => {
    expect(usePlaybackStore.getState().mode).toBe('live')
  })

  it('starts with isPlaying=false', () => {
    expect(usePlaybackStore.getState().isPlaying).toBe(false)
  })

  it('starts with speed=1', () => {
    expect(usePlaybackStore.getState().speed).toBe(1)
  })

  it('starts with a 24-hour default time range', () => {
    const { timeRange } = usePlaybackStore.getState()
    const rangeDuration = timeRange.end - timeRange.start
    // Should be approximately 24 hours (within 1 second tolerance)
    expect(rangeDuration).toBeGreaterThanOrEqual(24 * 3600_000 - 1000)
    expect(rangeDuration).toBeLessThanOrEqual(24 * 3600_000 + 1000)
  })
})

describe('usePlaybackStore — setMode', () => {
  beforeEach(resetStore)

  it('switches from live to historical', () => {
    usePlaybackStore.getState().setMode('historical')
    expect(usePlaybackStore.getState().mode).toBe('historical')
  })

  it('switches from historical back to live', () => {
    usePlaybackStore.getState().setMode('historical')
    usePlaybackStore.getState().setMode('live')
    expect(usePlaybackStore.getState().mode).toBe('live')
  })

  it('stops playback when switching mode', () => {
    usePlaybackStore.setState({ isPlaying: true })
    usePlaybackStore.getState().setMode('historical')
    expect(usePlaybackStore.getState().isPlaying).toBe(false)
  })

  it('positions timestamp at end of range when switching to historical', () => {
    const end = Date.now()
    usePlaybackStore.setState({ timeRange: { start: end - 3600_000, end } })
    usePlaybackStore.getState().setMode('historical')
    expect(usePlaybackStore.getState().timestamp).toBe(end)
  })
})

describe('usePlaybackStore — setTimestamp', () => {
  beforeEach(resetStore)

  it('updates the scrub position', () => {
    const ts = Date.now() - 3600_000
    usePlaybackStore.getState().setTimestamp(ts)
    expect(usePlaybackStore.getState().timestamp).toBe(ts)
  })
})

describe('usePlaybackStore — setTimeRange', () => {
  beforeEach(resetStore)

  it('updates start and end', () => {
    const range = { start: 1000, end: 2000 }
    usePlaybackStore.getState().setTimeRange(range)
    const stored = usePlaybackStore.getState().timeRange
    expect(stored.start).toBe(1000)
    expect(stored.end).toBe(2000)
  })
})

describe('usePlaybackStore — setPlaying / setSpeed', () => {
  beforeEach(resetStore)

  it('sets isPlaying to true', () => {
    usePlaybackStore.getState().setPlaying(true)
    expect(usePlaybackStore.getState().isPlaying).toBe(true)
  })

  it('sets speed', () => {
    usePlaybackStore.getState().setSpeed(10)
    expect(usePlaybackStore.getState().speed).toBe(10)
  })

  it('accepts valid speed values', () => {
    const speeds = [1, 2, 5, 10, 60, 300] as const
    for (const s of speeds) {
      usePlaybackStore.getState().setSpeed(s)
      expect(usePlaybackStore.getState().speed).toBe(s)
    }
  })
})
