import { useCallback } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useNavigate } from 'react-router-dom'
import { usePermission } from '../hooks/usePermission'

export interface PointContextMenuProps {
  pointId: string
  tagName: string
  isAlarm?: boolean
  isAlarmElement?: boolean
  children: React.ReactNode
  /** Controlled open state — when provided, the menu is driven externally */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Optional override for "Point Detail" action.
   * When omitted, the default navigates to the point detail route.
   * Modules that show an in-pane panel (e.g. Console floating panel) pass this.
   */
  onPointDetail?: (pointId: string) => void
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

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--io-border)',
  margin: '4px 0',
}

export default function PointContextMenu({
  pointId,
  tagName,
  isAlarm = false,
  isAlarmElement = false,
  children,
  open,
  onOpenChange,
  onPointDetail,
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

  const handlePointDetail = useCallback(() => {
    if (onPointDetail) {
      onPointDetail(pointId)
    } else {
      navigate(`/forensics?point=${encodeURIComponent(pointId)}&panel=detail`)
    }
  }, [navigate, pointId, onPointDetail])

  const handleTrendThisPoint = useCallback(() => {
    navigate(`/forensics?point=${encodeURIComponent(pointId)}&mode=trend`)
  }, [navigate, pointId])

  const handleInvestigatePoint = useCallback(() => {
    navigate(`/forensics/new?point=${encodeURIComponent(pointId)}`)
  }, [navigate, pointId])

  const handleReportOnPoint = useCallback(() => {
    navigate(`/reports?point=${encodeURIComponent(pointId)}`)
  }, [navigate, pointId])

  const handleInvestigateAlarm = useCallback(() => {
    navigate(`/forensics/new?alarm=${encodeURIComponent(pointId)}`)
  }, [navigate, pointId])

  const focusStyle = (e: React.FocusEvent<HTMLDivElement>) => {
    ;(e.currentTarget as HTMLElement).style.background = 'var(--io-accent-subtle)'
  }
  const blurStyle = (e: React.FocusEvent<HTMLDivElement>) => {
    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
  }

  const isControlled = open !== undefined

  return (
    <DropdownMenu.Root
      open={isControlled ? open : undefined}
      onOpenChange={isControlled ? onOpenChange : undefined}
    >
      {!isControlled ? (
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
      ) : (
        <DropdownMenu.Trigger asChild>
          {children}
        </DropdownMenu.Trigger>
      )}

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          style={menuContentStyle}
          sideOffset={4}
          align="start"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {/* 1. Point Detail — always visible */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={handlePointDetail}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            Point Detail
          </DropdownMenu.Item>

          {/* 2. Trend This Point — always visible, no permission gate */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={handleTrendThisPoint}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            Trend This Point
          </DropdownMenu.Item>

          {/* Separator */}
          <div style={separatorStyle} />

          {/* 3. Investigate Point — hidden if user lacks forensics:read */}
          {canForensics && (
            <DropdownMenu.Item
              style={menuItemStyle}
              onSelect={handleInvestigatePoint}
              onFocus={focusStyle}
              onBlur={blurStyle}
            >
              Investigate Point
            </DropdownMenu.Item>
          )}

          {/* 4. Report on Point — hidden if user lacks reports:read */}
          {canReports && (
            <DropdownMenu.Item
              style={menuItemStyle}
              onSelect={handleReportOnPoint}
              onFocus={focusStyle}
              onBlur={blurStyle}
            >
              Report on Point
            </DropdownMenu.Item>
          )}

          {/* Conditional separator + Investigate Alarm — only when isAlarm or isAlarmElement */}
          {(isAlarm || isAlarmElement) && (
            <>
              <div style={separatorStyle} />
              <DropdownMenu.Item
                style={menuItemStyle}
                onSelect={handleInvestigateAlarm}
                onFocus={focusStyle}
                onBlur={blurStyle}
              >
                Investigate Alarm
              </DropdownMenu.Item>
            </>
          )}

          {/* Separator before Copy Tag Name */}
          <div style={separatorStyle} />

          {/* 7. Copy Tag Name — always visible */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => { void handleCopyTagName() }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            Copy Tag Name
          </DropdownMenu.Item>
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
