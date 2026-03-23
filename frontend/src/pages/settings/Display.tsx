import { useState } from 'react'
import { setTheme, initTheme, type Theme } from '../../shared/theme/tokens'
import { useSetDensity, type Density } from '../../shared/theme/ThemeContext'

const DENSITY_KEY = 'io:display:density'
const DATE_FORMAT_KEY = 'io:display:dateFormat'
const TIME_FORMAT_KEY = 'io:display:timeFormat'
type DateFormat = 'local' | 'iso' | 'us'
type TimeFormat = '12h' | '24h'

export default function Display() {
  const setDensityCtx = useSetDensity()

  const [theme, setThemeState] = useState<Theme>(() => initTheme())
  const [density, setDensityState] = useState<Density>(() => {
    const stored = localStorage.getItem(DENSITY_KEY)
    if (stored === 'compact' || stored === 'default' || stored === 'comfortable') return stored
    return 'default'
  })
  const [dateFormat, setDateFormatState] = useState<DateFormat>(
    () => (localStorage.getItem(DATE_FORMAT_KEY) as DateFormat | null) ?? 'local',
  )
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(
    () => (localStorage.getItem(TIME_FORMAT_KEY) as TimeFormat | null) ?? '24h',
  )

  function applyTheme(t: Theme) {
    setThemeState(t)
    setTheme(t)
  }

  function applyDensity(d: Density) {
    setDensityState(d)
    localStorage.setItem(DENSITY_KEY, d)
    setDensityCtx(d)
  }

  function applyDateFormat(f: DateFormat) {
    setDateFormatState(f)
    localStorage.setItem(DATE_FORMAT_KEY, f)
  }

  function applyTimeFormat(f: TimeFormat) {
    setTimeFormatState(f)
    localStorage.setItem(TIME_FORMAT_KEY, f)
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--io-surface)',
    border: '1px solid var(--io-border)',
    borderRadius: '10px',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--io-text-primary)',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--io-border)',
  }

  const optionRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  }

  function OptionBtn({ label, active, onClick, desc }: { label: string; active: boolean; onClick: () => void; desc?: string }) {
    return (
      <button
        onClick={onClick}
        style={{
          flex: 1,
          padding: '10px 16px',
          background: active ? 'var(--io-accent)' : 'var(--io-surface-secondary)',
          border: active ? '2px solid var(--io-accent)' : '2px solid var(--io-border)',
          borderRadius: '8px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 700, color: active ? '#fff' : 'var(--io-text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: '11px', color: active ? 'rgba(255,255,255,0.8)' : 'var(--io-text-muted)', marginTop: '2px' }}>{desc}</div>}
      </button>
    )
  }

  return (
    <div style={{ padding: 'var(--io-space-6)', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '720px' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>Display Preferences</h2>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--io-text-secondary)' }}>
          Personal display settings — stored locally in your browser.
        </p>
      </div>

      {/* Theme */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Theme</h3>
        <div style={optionRowStyle}>
          <OptionBtn label="Dark" desc="Professional dark interface" active={theme === 'dark'} onClick={() => applyTheme('dark')} />
          <OptionBtn label="Light" desc="High visibility light mode" active={theme === 'light'} onClick={() => applyTheme('light')} />
          <OptionBtn label="HP-HMI" desc="High-contrast industrial" active={theme === 'hphmi'} onClick={() => applyTheme('hphmi')} />
        </div>
      </div>

      {/* Density */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Layout Density</h3>
        <div style={optionRowStyle}>
          <OptionBtn label="Comfortable" desc="Standard spacing — best for desktop" active={density === 'comfortable'} onClick={() => applyDensity('comfortable')} />
          <OptionBtn label="Compact" desc="Reduced spacing — more data on screen" active={density === 'compact'} onClick={() => applyDensity('compact')} />
        </div>
      </div>

      {/* Date format */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Date Format</h3>
        <div style={optionRowStyle}>
          <OptionBtn label="Local" desc={new Date().toLocaleDateString()} active={dateFormat === 'local'} onClick={() => applyDateFormat('local')} />
          <OptionBtn label="ISO 8601" desc="2026-03-18" active={dateFormat === 'iso'} onClick={() => applyDateFormat('iso')} />
          <OptionBtn label="US" desc="03/18/2026" active={dateFormat === 'us'} onClick={() => applyDateFormat('us')} />
        </div>
      </div>

      {/* Time format */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Time Format</h3>
        <div style={optionRowStyle}>
          <OptionBtn label="24-hour" desc="14:30:00" active={timeFormat === '24h'} onClick={() => applyTimeFormat('24h')} />
          <OptionBtn label="12-hour" desc="2:30:00 PM" active={timeFormat === '12h'} onClick={() => applyTimeFormat('12h')} />
        </div>
      </div>
    </div>
  )
}
