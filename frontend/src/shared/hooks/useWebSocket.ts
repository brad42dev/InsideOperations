import { useEffect, useRef, useState } from 'react'
import { wsTicketApi } from '../../api/ws-ticket'
import { showToast } from '../components/Toast'
import { reportsApi } from '../../api/reports'

// Derive WS base from the current page location so it works regardless of host.
// In dev, Vite proxies /ws → ws://localhost:3001. In production, nginx proxies /ws.
// VITE_WS_URL can override for non-proxied setups.
const WS_BASE = (import.meta.env.VITE_WS_URL as string | undefined) ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`

export type WsConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface PointValue {
  pointId: string
  value: number
  quality: string
  timestamp: string
  stale?: boolean
}

interface WsServerMessage {
  type: string
  point_id?: string
  value?: number
  quality?: string
  timestamp?: string
  last_updated_at?: string
  source_id?: string
  source_name?: string
  job_id?: string
}

type PointUpdateHandler = (update: PointValue) => void

interface UseWebSocketOptions {
  onStale?: (pointId: string, lastUpdatedAt: string) => void
  onSourceOffline?: (sourceId: string, sourceName: string) => void
  onSourceOnline?: (sourceId: string, sourceName: string) => void
}

// ---------------------------------------------------------------------------
// Singleton WebSocket manager — shared across all hook instances
// ---------------------------------------------------------------------------

class WsManager {
  private ws: WebSocket | null = null
  private subscribers = new Map<string, Set<PointUpdateHandler>>()
  private staleHandlers = new Set<(id: string, ts: string) => void>()
  private sourceHandlers = new Set<(id: string, name: string, online: boolean) => void>()
  private state: WsConnectionState = 'disconnected'
  private stateListeners = new Set<(s: WsConnectionState) => void>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private destroyed = false

  getState() {
    return this.state
  }

  onStateChange(fn: (s: WsConnectionState) => void): () => void {
    this.stateListeners.add(fn)
    return () => { this.stateListeners.delete(fn) }
  }

  private setState(s: WsConnectionState) {
    this.state = s
    this.stateListeners.forEach((fn) => fn(s))
  }

  async connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }
    this.setState('connecting')
    try {
      const result = await wsTicketApi.create()
      if (!result.success) {
        this.setState('error')
        this.scheduleReconnect()
        return
      }
      const { ticket } = result.data
      const url = `${WS_BASE}/ws?ticket=${encodeURIComponent(ticket)}`
      const ws = new WebSocket(url)
      this.ws = ws

      ws.onopen = () => {
        this.reconnectDelay = 1000
        this.setState('connected')
        const allPoints = Array.from(this.subscribers.keys())
        if (allPoints.length > 0) {
          this.sendMsg({ type: 'subscribe', points: allPoints })
        }
      }

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string) as WsServerMessage
          this.handleMessage(msg)
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        if (!this.destroyed) {
          this.setState('disconnected')
          this.scheduleReconnect()
        }
      }

      ws.onerror = () => {
        this.setState('error')
      }
    } catch {
      this.setState('error')
      this.scheduleReconnect()
    }
  }

  private handleMessage(msg: WsServerMessage) {
    switch (msg.type) {
      case 'update': {
        if (!msg.point_id) break
        const handlers = this.subscribers.get(msg.point_id)
        if (handlers) {
          const update: PointValue = {
            pointId: msg.point_id,
            value: msg.value ?? 0,
            quality: msg.quality ?? 'unknown',
            timestamp: msg.timestamp ?? new Date().toISOString(),
            stale: false,
          }
          handlers.forEach((fn) => fn(update))
        }
        break
      }
      case 'point_stale': {
        if (!msg.point_id) break
        this.staleHandlers.forEach((fn) => fn(msg.point_id!, msg.last_updated_at ?? ''))
        const handlers = this.subscribers.get(msg.point_id)
        if (handlers) {
          const update: PointValue = {
            pointId: msg.point_id,
            value: 0,
            quality: 'uncertain',
            timestamp: msg.last_updated_at ?? '',
            stale: true,
          }
          handlers.forEach((fn) => fn(update))
        }
        break
      }
      case 'point_fresh': {
        if (!msg.point_id) break
        const handlers = this.subscribers.get(msg.point_id)
        if (handlers) {
          const update: PointValue = {
            pointId: msg.point_id,
            value: msg.value ?? 0,
            quality: 'good',
            timestamp: msg.timestamp ?? '',
            stale: false,
          }
          handlers.forEach((fn) => fn(update))
        }
        break
      }
      case 'source_offline':
        if (msg.source_id) {
          this.sourceHandlers.forEach((fn) => fn(msg.source_id!, msg.source_name ?? '', false))
        }
        break
      case 'source_online':
        if (msg.source_id) {
          this.sourceHandlers.forEach((fn) => fn(msg.source_id!, msg.source_name ?? '', true))
        }
        break
      case 'export_complete': {
        if (!msg.job_id) break
        const downloadUrl = reportsApi.getDownloadUrl(msg.job_id)
        showToast({
          title: 'Your report is ready',
          description: 'Click Download to save the file.',
          variant: 'success',
          action: {
            label: 'Download',
            onClick: () => {
              window.open(downloadUrl, '_blank')
            },
          },
          duration: 10000,
        })
        break
      }
      case 'ping':
        this.sendMsg({ type: 'pong' })
        break
    }
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
      this.connect()
    }, this.reconnectDelay)
  }

  private sendMsg(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  subscribe(pointId: string, handler: PointUpdateHandler) {
    if (!this.subscribers.has(pointId)) {
      this.subscribers.set(pointId, new Set())
      if (this.state === 'connected') {
        this.sendMsg({ type: 'subscribe', points: [pointId] })
      }
    }
    this.subscribers.get(pointId)!.add(handler)
  }

  unsubscribe(pointId: string, handler: PointUpdateHandler) {
    const handlers = this.subscribers.get(pointId)
    if (!handlers) return
    handlers.delete(handler)
    if (handlers.size === 0) {
      this.subscribers.delete(pointId)
      if (this.state === 'connected') {
        this.sendMsg({ type: 'unsubscribe', points: [pointId] })
      }
    }
  }

  onStale(fn: (id: string, ts: string) => void): () => void {
    this.staleHandlers.add(fn)
    return () => { this.staleHandlers.delete(fn) }
  }

  onSource(fn: (id: string, name: string, online: boolean) => void): () => void {
    this.sourceHandlers.add(fn)
    return () => { this.sourceHandlers.delete(fn) }
  }

  // Call on logout: closes connection and clears all subscriptions
  // without permanently disabling the manager (unlike destroy()).
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.subscribers.clear()
    this.staleHandlers.clear()
    this.sourceHandlers.clear()
    this.reconnectDelay = 1000
    this.setState('disconnected')
  }

  destroy() {
    this.destroyed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.setState('disconnected')
  }
}

const wsManager = new WsManager()
export { wsManager }

// ---------------------------------------------------------------------------
// React hook — subscribe to one or more points
// ---------------------------------------------------------------------------

export function useWebSocket(
  pointIds: string[],
  options?: UseWebSocketOptions,
): {
  values: Map<string, PointValue>
  connectionState: WsConnectionState
} {
  const [values, setValues] = useState<Map<string, PointValue>>(new Map)
  const [connectionState, setConnectionState] = useState<WsConnectionState>(wsManager.getState())
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Connect + track connection state
  useEffect(() => {
    if (wsManager.getState() === 'disconnected') {
      void wsManager.connect()
    }
    return wsManager.onStateChange(setConnectionState)
  }, [])

  // Subscribe to point IDs
  const pointIdsKey = pointIds.join(',')
  useEffect(() => {
    if (pointIds.length === 0) return

    const handler: PointUpdateHandler = (update) => {
      setValues((prev) => {
        const next = new Map(prev)
        next.set(update.pointId, update)
        return next
      })
    }

    pointIds.forEach((id) => wsManager.subscribe(id, handler))
    return () => {
      pointIds.forEach((id) => wsManager.unsubscribe(id, handler))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointIdsKey])

  // Stale handler
  useEffect(() => {
    return wsManager.onStale((id, ts) => {
      optionsRef.current?.onStale?.(id, ts)
    })
  }, [])

  // Source status handler
  useEffect(() => {
    return wsManager.onSource((id, name, online) => {
      if (online) {
        optionsRef.current?.onSourceOnline?.(id, name)
      } else {
        optionsRef.current?.onSourceOffline?.(id, name)
      }
    })
  }, [])

  return { values, connectionState }
}
