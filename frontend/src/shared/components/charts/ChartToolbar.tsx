import { useEffect, useRef, useState } from 'react'
import type { AggregateType } from './chart-config-types'
import {
  AGGREGATE_LABELS,
  BUCKET_OPTIONS,
  getValidBuckets,
} from './chart-aggregate-config'

export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'

const PRESETS = [1, 2, 3, 5, 7, 30, 60, 90, 120]
const ALL_UNITS: TimeUnit[] = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years']
const NO_SECONDS_UNITS: TimeUnit[] = ['minutes', 'hours', 'days', 'weeks', 'months', 'years']

/**
 * Chart types that show an instantaneous value and make sense at sub-minute
 * durations (gauges, KPI cards, sparklines, indicators).
 */
export const INSTANT_READOUT_CHART_TYPES = new Set([7, 8, 9, 10, 11, 12, 23])

export function toMinutes(value: number, unit: TimeUnit): number {
  switch (unit) {
    case 'seconds': return value / 60
    case 'minutes': return value
    case 'hours':   return value * 60
    case 'days':    return value * 60 * 24
    case 'weeks':   return value * 60 * 24 * 7
    case 'months':  return value * 60 * 24 * 30
    case 'years':   return value * 60 * 24 * 365
  }
}

export function fromMinutes(totalMinutes: number): { value: number; unit: TimeUnit } {
  const m = totalMinutes
  if (m >= 60 * 24 * 365 && Number.isInteger(m / (60 * 24 * 365)))
    return { value: m / (60 * 24 * 365), unit: 'years' }
  if (m >= 60 * 24 * 30 && Number.isInteger(m / (60 * 24 * 30)))
    return { value: m / (60 * 24 * 30), unit: 'months' }
  if (m >= 60 * 24 * 7 && Number.isInteger(m / (60 * 24 * 7)))
    return { value: m / (60 * 24 * 7), unit: 'weeks' }
  if (m >= 60 * 24 && Number.isInteger(m / (60 * 24)))
    return { value: m / (60 * 24), unit: 'days' }
  if (m >= 60 && Number.isInteger(m / 60))
    return { value: m / 60, unit: 'hours' }
  if (m >= 1)
    return { value: Math.round(m), unit: 'minutes' }
  return { value: Math.round(m * 60), unit: 'seconds' }
}

// Responsive size tiers for the toolbar
type SizeTier = 'wide' | 'medium' | 'narrow'

function getTier(width: number): SizeTier {
  if (width >= 560) return 'wide'
  if (width >= 400) return 'medium'
  return 'narrow'
}

interface ChartToolbarProps {
  /** Current window duration in minutes */
  durationMinutes: number
  /** Called when user commits a new time window */
  onDurationChange: (minutes: number) => void
  /** Called when user clicks the gear/configure button */
  onConfigure?: () => void
  /**
   * When true, 'seconds' is available as a unit and durations < 1 minute are
   * allowed. Only instant-readout charts should pass true.
   */
  allowSeconds?: boolean
  /**
   * Aggregate types valid for this chart. If absent or empty the aggregate
   * selector is not shown.
   */
  aggregates?: AggregateType[]
  /** Current bucket size in seconds. undefined = auto (backend decides). */
  bucketSeconds?: number
  onBucketChange?: (seconds: number | undefined) => void
  /** Current aggregate type. */
  aggregateType?: AggregateType
  onAggregateChange?: (agg: AggregateType) => void
}

export default function ChartToolbar({
  durationMinutes,
  onDurationChange,
  onConfigure,
  allowSeconds = false,
  aggregates,
  bucketSeconds,
  onBucketChange,
  aggregateType,
  onAggregateChange,
}: ChartToolbarProps) {
  const units = allowSeconds ? ALL_UNITS : NO_SECONDS_UNITS
  const showAggregate = aggregates && aggregates.length > 0
  const showBucket = !!onBucketChange

  function clampedFromMinutes(mins: number): { value: number; unit: TimeUnit } {
    const parsed = fromMinutes(mins)
    if (!allowSeconds && parsed.unit === 'seconds') return { value: 1, unit: 'minutes' }
    return parsed
  }

  const initial = clampedFromMinutes(durationMinutes)
  const [value, setValue] = useState(initial.value)
  const [unit, setUnit] = useState<TimeUnit>(initial.unit)
  const [inputStr, setInputStr] = useState(String(initial.value))
  const presetRef = useRef<HTMLSelectElement>(null)

  // Responsive tier
  const containerRef = useRef<HTMLDivElement>(null)
  const [tier, setTier] = useState<SizeTier>('wide')
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setTier(getTier(entry.contentRect.width))
    })
    ro.observe(el)
    setTier(getTier(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  // Sync when parent-controlled duration changes externally
  useEffect(() => {
    const parsed = clampedFromMinutes(durationMinutes)
    setValue(parsed.value)
    setUnit(parsed.unit)
    setInputStr(String(parsed.value))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMinutes, allowSeconds])

  function commit(v: number, u: TimeUnit) {
    if (v <= 0 || !isFinite(v)) return
    const mins = toMinutes(v, u)
    const effective = !allowSeconds ? Math.max(1, mins) : mins
    if (effective > 0) onDurationChange(effective)
  }

  function handlePresetSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const p = Number(e.target.value)
    if (!p) return
    setValue(p)
    setInputStr(String(p))
    commit(p, unit)
    e.target.value = ''
  }

  function handleUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const u = e.target.value as TimeUnit
    setUnit(u)
    commit(value, u)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputStr(e.target.value)
  }

  function handleInputCommit() {
    const n = parseFloat(inputStr)
    if (n > 0 && isFinite(n)) {
      setValue(n)
      commit(n, unit)
    } else {
      setInputStr(String(value))
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  // Valid bucket options for the current duration
  const validBuckets = getValidBuckets(durationMinutes)

  // Unit label for the unit select — abbreviated in narrow tier
  function unitLabel(u: TimeUnit): string {
    if (tier === 'narrow') {
      const map: Record<TimeUnit, string> = {
        seconds: 'sec', minutes: 'min', hours: 'hr',
        days: 'day', weeks: 'wk', months: 'mo', years: 'yr',
      }
      return map[u]
    }
    return u
  }

  // Bucket label — short in narrow tier
  function bucketLabel(seconds: number): string {
    const opt = BUCKET_OPTIONS.find((b) => b.seconds === seconds)
    if (!opt) return `${seconds}s`
    return tier === 'narrow' ? opt.labelShort : opt.label
  }

  // Aggregate label
  function aggLabel(agg: AggregateType): string {
    return tier === 'narrow'
      ? AGGREGATE_LABELS[agg].short
      : AGGREGATE_LABELS[agg].full
  }

  const inputStyle: React.CSSProperties = {
    height: 22,
    background: 'var(--io-input-bg)',
    border: '1px solid var(--io-input-border)',
    color: 'var(--io-text-primary)',
    fontSize: 11,
    outline: 'none',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    padding: '0 4px',
    borderRadius: 3,
    cursor: 'pointer',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--io-text-muted)',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  }

  const groupStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }

  const durLabel = tier === 'wide' ? 'Duration' : tier === 'medium' ? 'Dur' : 'Dur'
  const bucketLabelText = tier === 'wide' ? 'Bucket Size' : tier === 'medium' ? 'Bucket' : 'Bkt'
  const aggLabelText = tier === 'wide' ? 'Aggregate' : tier === 'medium' ? 'Agg' : 'Agg'

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 32,
        padding: '0 8px',
        borderTop: '1px solid var(--io-border)',
        background: 'var(--io-surface-secondary)',
        flexShrink: 0,
        gap: 8,
        overflow: 'hidden',
      }}
    >
      {/* Left: time window + bucket + aggregate controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', minWidth: 0 }}>

        {/* Duration */}
        <div style={groupStyle}>
          <span style={labelStyle}>{durLabel}:</span>
          {/* Value input */}
          <input
            type="text"
            inputMode="numeric"
            value={inputStr}
            onChange={handleInputChange}
            onBlur={handleInputCommit}
            onKeyDown={handleInputKeyDown}
            style={{
              ...inputStyle,
              width: 40,
              padding: '0 4px',
              textAlign: 'right',
              borderRadius: '3px 0 0 3px',
              borderRight: 'none',
            }}
          />
          {/* Presets quick-pick */}
          <select
            ref={presetRef}
            onChange={handlePresetSelect}
            defaultValue=""
            style={{
              ...inputStyle,
              width: 20,
              padding: 0,
              borderRadius: '0 3px 3px 0',
              cursor: 'pointer',
              appearance: 'auto',
              color: 'var(--io-text-muted)',
            }}
            title="Quick presets"
          >
            <option value="" disabled hidden />
            {PRESETS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {/* Unit select */}
          <select
            value={unit}
            onChange={handleUnitChange}
            style={selectStyle}
          >
            {units.map((u) => (
              <option key={u} value={u}>{unitLabel(u)}</option>
            ))}
          </select>
        </div>

        {/* Bucket Size */}
        {showBucket && validBuckets.length > 0 && (
          <div style={groupStyle}>
            <span style={labelStyle}>{bucketLabelText}:</span>
            <select
              value={bucketSeconds ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onBucketChange!(v === '' ? undefined : Number(v))
              }}
              style={selectStyle}
            >
              <option value="">Auto</option>
              {validBuckets.map((b) => (
                <option key={b.seconds} value={b.seconds}>
                  {bucketLabel(b.seconds)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Aggregate Type */}
        {showAggregate && aggregates && aggregates.length > 0 && onAggregateChange && (
          <div style={groupStyle}>
            <span style={labelStyle}>{aggLabelText}:</span>
            <select
              value={aggregateType ?? aggregates[0]}
              onChange={(e) => onAggregateChange(e.target.value as AggregateType)}
              style={selectStyle}
            >
              {aggregates.map((a) => (
                <option key={a} value={a}>
                  {aggLabel(a)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: gear icon */}
      <button
        onClick={onConfigure}
        title="Configure chart"
        style={{
          background: 'none',
          border: 'none',
          padding: '3px 4px',
          cursor: 'pointer',
          color: 'var(--io-text-muted)',
          display: 'flex',
          alignItems: 'center',
          borderRadius: 3,
          lineHeight: 0,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--io-text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--io-text-muted)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  )
}
