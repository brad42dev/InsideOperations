// Alarm state buffer — live alarm state for every point currently in alarm.
//
// Updated in real-time from `alarm_state_changed` WS messages (source-agnostic:
// OPC A&C, threshold evaluator, universal import, and any future alarm source).
//
// SceneRenderer reads from this store on each render cycle to inject alarm priority
// and unacknowledged state into display element bindings without additional subscriptions.

import { create } from 'zustand'

export interface AlarmState {
  /** 1=Critical, 2=High, 3=Medium, 4=Advisory, 0=Cleared/Normal */
  priority: number
  active: boolean
  unacknowledged: boolean
  suppressed: boolean
  message?: string
  timestamp: string
}

interface AlarmStoreState {
  /** Map from point UUID string → current alarm state. Entry absent means Normal/no alarm. */
  buffer: Map<string, AlarmState>
  updateAlarmState(update: { point_id: string; priority: number; active: boolean; unacknowledged: boolean; suppressed: boolean; message?: string; timestamp: string }): void
  getAlarmState(pointId: string): AlarmState | null
  initFromActive(entries: Array<{ point_id: string; priority: number; active: boolean; unacknowledged: boolean; suppressed: boolean; message?: string; timestamp: string }>): void
  clear(): void
}

export const useAlarmStore = create<AlarmStoreState>((set, get) => ({
  buffer: new Map(),

  updateAlarmState(update) {
    set((state) => {
      const next = new Map(state.buffer)
      if (update.priority === 0 && !update.active && !update.unacknowledged) {
        // Alarm returned to normal — remove from buffer
        next.delete(update.point_id)
      } else {
        next.set(update.point_id, {
          priority: update.priority,
          active: update.active,
          unacknowledged: update.unacknowledged,
          suppressed: update.suppressed,
          message: update.message,
          timestamp: update.timestamp,
        })
      }
      return { buffer: next }
    })
  },

  getAlarmState(pointId) {
    return get().buffer.get(pointId) ?? null
  },

  initFromActive(entries) {
    const next = new Map<string, AlarmState>()
    for (const e of entries) {
      next.set(e.point_id, {
        priority: e.priority,
        active: e.active,
        unacknowledged: e.unacknowledged,
        suppressed: e.suppressed,
        message: e.message,
        timestamp: e.timestamp,
      })
    }
    set({ buffer: next })
  },

  clear() {
    set({ buffer: new Map() })
  },
}))
