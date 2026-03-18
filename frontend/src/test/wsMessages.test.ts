import { describe, it, expect, afterEach } from 'vitest'
import { detectDeviceType } from '../shared/hooks/useWebSocket'

// ---------------------------------------------------------------------------
// detectDeviceType — tests UA-based device type detection
// ---------------------------------------------------------------------------

describe('detectDeviceType', () => {
  const orig = navigator.userAgent

  function setUA(ua: string) {
    Object.defineProperty(navigator, 'userAgent', { get: () => ua, configurable: true })
  }

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { get: () => orig, configurable: true })
  })

  it('returns desktop for a normal desktop browser UA', () => {
    setUA('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120')
    expect(detectDeviceType()).toBe('desktop')
  })

  it('returns phone for iPhone UA', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari/604.1')
    expect(detectDeviceType()).toBe('phone')
  })

  it('returns phone for Android Mobile UA', () => {
    setUA('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit Chrome/120 Mobile Safari/604.1')
    expect(detectDeviceType()).toBe('phone')
  })

  it('returns tablet for iPad UA', () => {
    setUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit Safari/604.1')
    expect(detectDeviceType()).toBe('tablet')
  })

  it('returns tablet for Android tablet UA (no Mobile)', () => {
    setUA('Mozilla/5.0 (Linux; Android 13; SM-T870) AppleWebKit Chrome/120 Safari/604.1')
    expect(detectDeviceType()).toBe('tablet')
  })
})

// ---------------------------------------------------------------------------
// WS message handling — inlined message dispatch logic from WsManager
// Tests the PointValue construction for each message type.
// ---------------------------------------------------------------------------

interface WsServerMessage {
  type: string
  point_id?: string
  value?: number
  quality?: string
  timestamp?: string
  last_updated_at?: string
}

interface PointValue {
  pointId: string
  value: number
  quality: string
  timestamp: string
  stale?: boolean
}

function handleWsUpdate(msg: WsServerMessage): PointValue | null {
  if (msg.type === 'update') {
    if (!msg.point_id) return null
    return {
      pointId: msg.point_id,
      value: msg.value ?? 0,
      quality: msg.quality ?? 'unknown',
      timestamp: msg.timestamp ?? new Date().toISOString(),
      stale: false,
    }
  }
  if (msg.type === 'point_stale') {
    if (!msg.point_id) return null
    return {
      pointId: msg.point_id,
      value: 0,
      quality: 'uncertain',
      timestamp: msg.last_updated_at ?? '',
      stale: true,
    }
  }
  if (msg.type === 'point_fresh') {
    if (!msg.point_id) return null
    return {
      pointId: msg.point_id,
      value: msg.value ?? 0,
      quality: 'good',
      timestamp: msg.timestamp ?? '',
      stale: false,
    }
  }
  return null
}

describe('handleWsUpdate — update message', () => {
  it('maps point_id to pointId', () => {
    const pv = handleWsUpdate({ type: 'update', point_id: 'FIC-101', value: 42.5, quality: 'good', timestamp: '2026-01-01T00:00:00Z' })
    expect(pv?.pointId).toBe('FIC-101')
  })

  it('preserves numeric value', () => {
    const pv = handleWsUpdate({ type: 'update', point_id: 'FIC-101', value: 99.9, quality: 'good', timestamp: '' })
    expect(pv?.value).toBe(99.9)
  })

  it('defaults value to 0 when missing', () => {
    const pv = handleWsUpdate({ type: 'update', point_id: 'FIC-101', quality: 'good', timestamp: '' })
    expect(pv?.value).toBe(0)
  })

  it('defaults quality to unknown when missing', () => {
    const pv = handleWsUpdate({ type: 'update', point_id: 'FIC-101', value: 1 })
    expect(pv?.quality).toBe('unknown')
  })

  it('sets stale=false for normal updates', () => {
    const pv = handleWsUpdate({ type: 'update', point_id: 'FIC-101', value: 1, quality: 'good', timestamp: '' })
    expect(pv?.stale).toBe(false)
  })

  it('returns null when point_id is missing', () => {
    const pv = handleWsUpdate({ type: 'update', value: 42 })
    expect(pv).toBeNull()
  })
})

describe('handleWsUpdate — point_stale message', () => {
  it('creates stale PointValue with quality=uncertain', () => {
    const pv = handleWsUpdate({ type: 'point_stale', point_id: 'FIC-101', last_updated_at: '2026-01-01T00:00:00Z' })
    expect(pv?.quality).toBe('uncertain')
    expect(pv?.stale).toBe(true)
    expect(pv?.value).toBe(0)
  })

  it('uses last_updated_at as timestamp', () => {
    const ts = '2026-01-01T12:00:00Z'
    const pv = handleWsUpdate({ type: 'point_stale', point_id: 'FIC-101', last_updated_at: ts })
    expect(pv?.timestamp).toBe(ts)
  })

  it('returns null when point_id is missing', () => {
    expect(handleWsUpdate({ type: 'point_stale' })).toBeNull()
  })
})

describe('handleWsUpdate — point_fresh message', () => {
  it('creates fresh PointValue with quality=good', () => {
    const pv = handleWsUpdate({ type: 'point_fresh', point_id: 'FIC-101', value: 50, timestamp: '' })
    expect(pv?.quality).toBe('good')
    expect(pv?.stale).toBe(false)
  })
})

describe('handleWsUpdate — unknown message types', () => {
  it('returns null for subscribe_ack', () => {
    expect(handleWsUpdate({ type: 'subscribe_ack' })).toBeNull()
  })

  it('returns null for status_report', () => {
    expect(handleWsUpdate({ type: 'status_report' })).toBeNull()
  })

  it('returns null for alert_notification', () => {
    expect(handleWsUpdate({ type: 'alert_notification', point_id: 'x' })).toBeNull()
  })
})
