/**
 * HistoricalPlaybackBar — shared Live/Historical mode toggle + scrub controls (doc 07, 08, 32)
 *
 * Used by Console, Process, and Forensics modules. Reads/writes `usePlaybackStore`.
 *
 * Controls:
 *  - Live / Historical toggle
 *  - Date/time range picker (start + end)
 *  - Scrub slider (position within range)
 *  - Step-back / step-forward buttons
 *  - Play / Pause with selectable speed (1×, 2×, 5×, 10×, 60×, 300×)
 *  - Current timestamp display (RFC 3339)
 */

import { useEffect, useRef } from 'react'
import { usePlaybackStore, type PlaybackSpeed } from '../../store/playback'

const SPEEDS: PlaybackSpeed[] = [1, 2, 5, 10, 60, 300]

function speedLabel(s: PlaybackSpeed): string {
  if (s < 60) return `${s}×`
  return `${s / 60}m/s`
}

function fmtTimestamp(epochMs: number): string {
  return new Date(epochMs).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

function fmtDatetimeLocal(epochMs: number): string {
  // Format suitable for <input type="datetime-local">
  const d = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function HistoricalPlaybackBar() {
  const {
    mode,
    timestamp,
    timeRange,
    isPlaying,
    speed,
    setMode,
    setTimestamp,
    setTimeRange,
    setPlaying,
    setSpeed,
  } = usePlaybackStore()

  // Advance playback timer when playing
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastRealRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!isPlaying || mode !== 'historical') {
      if (rafRef.current !== null) {
        clearInterval(rafRef.current)
        rafRef.current = null
      }
      return
    }

    lastRealRef.current = Date.now()

    rafRef.current = setInterval(() => {
      const now = Date.now()
      const realElapsed = now - lastRealRef.current
      lastRealRef.current = now
      const simElapsed = realElapsed * speed

      usePlaybackStore.setState((s) => {
        const next = s.timestamp + simElapsed
        if (next >= s.timeRange.end) {
          return { timestamp: s.timeRange.end, isPlaying: false }
        }
        return { timestamp: next }
      })
    }, 100)

    return () => {
      if (rafRef.current !== null) clearInterval(rafRef.current)
    }
  }, [isPlaying, mode, speed])

  if (mode === 'live') {
    return (
      <div style={barStyle}>
        <button
          onClick={() => setMode('historical')}
          style={liveButtonStyle}
          title="Switch to historical playback mode"
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block', marginRight: 6 }} />
          LIVE
        </button>
        <span style={{ color: 'var(--io-text-muted)', fontSize: 11, marginLeft: 8 }}>
          Click to enter historical playback
        </span>
      </div>
    )
  }

  const rangeMs = timeRange.end - timeRange.start
  const progress = rangeMs > 0 ? (timestamp - timeRange.start) / rangeMs : 0
  const sliderValue = Math.round(progress * 1000)

  const stepMs = Math.max(60_000, rangeMs / 1000) // step ~0.1% of range, min 1 min

  return (
    <div style={barStyle}>
      {/* Back to live */}
      <button onClick={() => setMode('live')} style={backLiveStyle} title="Return to live mode">
        ◉ Live
      </button>

      {/* Range selectors */}
      <label style={labelStyle}>From</label>
      <input
        type="datetime-local"
        value={fmtDatetimeLocal(timeRange.start)}
        onChange={(e) => {
          const v = new Date(e.target.value).getTime()
          if (!isNaN(v) && v < timeRange.end) {
            setTimeRange({ start: v, end: timeRange.end })
            if (timestamp < v) setTimestamp(v)
          }
        }}
        style={inputStyle}
      />
      <label style={labelStyle}>To</label>
      <input
        type="datetime-local"
        value={fmtDatetimeLocal(timeRange.end)}
        onChange={(e) => {
          const v = new Date(e.target.value).getTime()
          if (!isNaN(v) && v > timeRange.start) {
            setTimeRange({ start: timeRange.start, end: v })
            if (timestamp > v) setTimestamp(v)
          }
        }}
        style={inputStyle}
      />

      {/* Step back */}
      <button
        onClick={() => setTimestamp(Math.max(timeRange.start, timestamp - stepMs))}
        style={iconBtnStyle}
        title="Step back"
      >
        ⏮
      </button>

      {/* Play / Pause */}
      <button
        onClick={() => setPlaying(!isPlaying)}
        style={{ ...iconBtnStyle, minWidth: 32 }}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Step forward */}
      <button
        onClick={() => setTimestamp(Math.min(timeRange.end, timestamp + stepMs))}
        style={iconBtnStyle}
        title="Step forward"
      >
        ⏭
      </button>

      {/* Scrub slider */}
      <input
        type="range"
        min={0}
        max={1000}
        value={sliderValue}
        onChange={(e) => {
          const pct = Number(e.target.value) / 1000
          setTimestamp(timeRange.start + pct * rangeMs)
        }}
        style={{ flex: 1, minWidth: 80, maxWidth: 300, cursor: 'pointer' }}
      />

      {/* Timestamp display */}
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--io-font-mono, monospace)',
          color: 'var(--io-accent)',
          whiteSpace: 'nowrap',
          minWidth: 170,
        }}
      >
        {fmtTimestamp(timestamp)}
      </span>

      {/* Speed selector */}
      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value) as PlaybackSpeed)}
        style={inputStyle}
        title="Playback speed"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {speedLabel(s)}
          </option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 10px',
  height: 40,
  flexShrink: 0,
  background: 'var(--io-surface)',
  borderTop: '1px solid var(--io-border)',
  overflow: 'hidden',
}

const liveButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'var(--io-surface-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 6,
  padding: '3px 10px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
  color: '#22C55E',
  letterSpacing: '0.05em',
}

const backLiveStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--io-accent)',
  borderRadius: 5,
  padding: '2px 8px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--io-accent)',
  whiteSpace: 'nowrap',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--io-text-muted)',
  whiteSpace: 'nowrap',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--io-surface-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 11,
  color: 'var(--io-text-primary)',
  cursor: 'pointer',
}

const iconBtnStyle: React.CSSProperties = {
  background: 'var(--io-surface-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 4,
  padding: '3px 7px',
  cursor: 'pointer',
  fontSize: 13,
  color: 'var(--io-text-primary)',
  lineHeight: 1,
}
