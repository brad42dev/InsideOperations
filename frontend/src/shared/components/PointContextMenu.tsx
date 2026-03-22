import { useCallback } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useNavigate } from 'react-router-dom'
import { usePermission } from '../hooks/usePermission'

export interface PointContextMenuProps {
  pointId: string
  tagName: string
  isAlarm: boolean
  isAlarmElement: boolean
  children: React.ReactNode
  onViewDetail?: (pointId: string) => void
  onAddToTrend?: (pointId: string) => void
}

const menuContentStyle: React.CSSProperties = {
  background: 'var(--io-surface-elevated)',
  border: '1px solid var(--io-border)',
  borderRadius: '6px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  padding: '4px',
  minWidth: 180,
  zIndex: 2500,
  animation: 'io-dropdown-in 0.1s ease',
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '7px 10px',
  borderRadius: '4px',
  fontSize: '13px',
  color: 'var(--io-text-primary)',
  cursor: 'pointer',
  outline: 'none',
  userSelect: 'none',
}

export default function PointContextMenu({
  pointId,
  tagName,
  isAlarm,
  isAlarmElement,
  children,
  onViewDetail,
  onAddToTrend,
}: PointContextMenuProps) {
  const navigate = useNavigate()
  const canForensics = usePermission('forensics:read')
  const canReports = usePermission('reports:read')

  const handleCopyTagName = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tagName)
    } catch {
      // Clipboard may be unavailable in some environments — silent fail
    }
  }, [tagName])

  const handleViewHistory = useCallback(() => {
    navigate(`/forensics?point=${encodeURIComponent(pointId)}`)
  }, [navigate, pointId])

  const handleInvestigateAlarm = useCallback(() => {
    navigate(`/forensics/new?alarm=${encodeURIComponent(pointId)}`)
  }, [navigate, pointId])

  const handleInvestigatePoint = useCallback(() => {
    navigate(`/forensics/new?point=${encodeURIComponent(pointId)}`)
  }, [navigate, pointId])

  const handleReportOnPoint = useCallback(() => {
    navigate(`/reports?point=${encodeURIComponent(pointId)}`)
  }, [navigate, pointId])

  const focusStyle = (e: React.FocusEvent<HTMLDivElement>) => {
    ;(e.currentTarget as HTMLElement).style.background = 'var(--io-accent-subtle)'
  }
  const blurStyle = (e: React.FocusEvent<HTMLDivElement>) => {
    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild onContextMenu={(e) => e.preventDefault()}>
        {/* Wrap in a span that captures right-click and delegates to Radix trigger */}
        <span
          onContextMenu={(e) => {
            e.preventDefault()
            // Programmatically open the dropdown by dispatching a click on the trigger
            ;(e.currentTarget as HTMLElement).dispatchEvent(
              new MouseEvent('click', { bubbles: true }),
            )
          }}
          style={{ display: 'contents' }}
        >
          {children}
        </span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          style={menuContentStyle}
          sideOffset={4}
          align="start"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {/* Copy Tag Name — always present */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => { void handleCopyTagName() }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            <span>📋</span>
            Copy Tag Name
          </DropdownMenu.Item>

          {/* View History — always present */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={handleViewHistory}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            <span>🕐</span>
            View History
          </DropdownMenu.Item>

          {/* View Point Detail — always present */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => onViewDetail?.(pointId)}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            <span>🔍</span>
            View Point Detail
          </DropdownMenu.Item>

          {/* Trend This Point — always present, no permission gate */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => onAddToTrend?.(pointId)}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            <span>📈</span>
            Trend This Point
          </DropdownMenu.Item>

          {/* Investigate Alarm — only when isAlarm or isAlarmElement is true */}
          {(isAlarm || isAlarmElement) && (
            <DropdownMenu.Item
              style={menuItemStyle}
              onSelect={handleInvestigateAlarm}
              onFocus={focusStyle}
              onBlur={blurStyle}
            >
              <span>🚨</span>
              Investigate Alarm
            </DropdownMenu.Item>
          )}

          {/* Investigate Point — gated on forensics:read */}
          {canForensics && (
            <DropdownMenu.Item
              style={menuItemStyle}
              onSelect={handleInvestigatePoint}
              onFocus={focusStyle}
              onBlur={blurStyle}
            >
              <span>🔎</span>
              Investigate Point
            </DropdownMenu.Item>
          )}

          {/* Report on Point — gated on reports:read */}
          {canReports && (
            <DropdownMenu.Item
              style={menuItemStyle}
              onSelect={handleReportOnPoint}
              onFocus={focusStyle}
              onBlur={blurStyle}
            >
              <span>📊</span>
              Report on Point
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>

      <style>{`
        @keyframes io-dropdown-in {
          from { opacity: 0; transform: scale(0.96) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </DropdownMenu.Root>
  )
}
