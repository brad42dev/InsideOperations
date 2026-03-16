import { useCallback } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useNavigate } from 'react-router-dom'

export interface PointContextMenuProps {
  pointId: string
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
  children,
  onViewDetail,
  onAddToTrend,
}: PointContextMenuProps) {
  const navigate = useNavigate()

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pointId)
    } catch {
      // Clipboard may be unavailable in some environments — silent fail
    }
  }, [pointId])

  const handleViewHistory = useCallback(() => {
    navigate(`/forensics?point=${encodeURIComponent(pointId)}`)
  }, [navigate, pointId])

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
          {/* View Point Detail */}
          {onViewDetail && (
            <DropdownMenu.Item
              style={menuItemStyle}
              onSelect={() => onViewDetail(pointId)}
              onFocus={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'var(--io-accent-subtle)'
              }}
              onBlur={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <span>🔍</span>
              View Point Detail
            </DropdownMenu.Item>
          )}

          {/* Add to Trend */}
          {onAddToTrend && (
            <DropdownMenu.Item
              style={menuItemStyle}
              onSelect={() => onAddToTrend(pointId)}
              onFocus={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'var(--io-accent-subtle)'
              }}
              onBlur={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <span>📈</span>
              Add to Trend
            </DropdownMenu.Item>
          )}

          {/* Copy Point ID */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => { void handleCopyId() }}
            onFocus={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'var(--io-accent-subtle)'
            }}
            onBlur={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <span>📋</span>
            Copy Point ID
          </DropdownMenu.Item>

          {/* View History */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={handleViewHistory}
            onFocus={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'var(--io-accent-subtle)'
            }}
            onBlur={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <span>🕐</span>
            View History
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
