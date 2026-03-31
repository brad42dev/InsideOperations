import { useCallback, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../hooks/usePermission";
import { forensicsApi } from "../../api/forensics";

export interface PointContextMenuProps {
  pointId: string;
  tagName: string;
  isAlarm?: boolean;
  isAlarmElement?: boolean;
  children: React.ReactNode;
  /** Controlled open state — when provided, the menu is driven externally */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Optional override for "Point Detail" action.
   * When omitted, the default navigates to the point detail route.
   * Modules that show an in-pane panel (e.g. Console floating panel) pass this.
   */
  onPointDetail?: (pointId: string) => void;
  /**
   * Optional override for "Trend Point" action.
   * When omitted, the default navigates to /console?trend={pointId}.
   */
  onTrendPoint?: (pointId: string) => void;
  /**
   * Optional override for "Investigate Point" action.
   * When omitted, the default POSTs to create a new investigation then navigates.
   */
  onInvestigatePoint?: (pointId: string) => void;
}

const menuContentStyle: React.CSSProperties = {
  background: "var(--io-surface-elevated)",
  border: "1px solid var(--io-border)",
  borderRadius: "6px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  padding: "4px",
  minWidth: 180,
  zIndex: 2500,
  animation: "io-dropdown-in 0.1s ease",
};

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "7px 10px",
  borderRadius: "4px",
  fontSize: "13px",
  color: "var(--io-text-primary)",
  cursor: "pointer",
  outline: "none",
  userSelect: "none",
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: "var(--io-border)",
  margin: "4px 0",
};

export default function PointContextMenu({
  pointId,
  tagName,
  isAlarm = false,
  isAlarmElement = false,
  children,
  open,
  onOpenChange,
  onPointDetail,
  onTrendPoint,
  onInvestigatePoint,
}: PointContextMenuProps) {
  const navigate = useNavigate();
  const canConsole = usePermission("console:read");
  const canForensicsWrite = usePermission("forensics:write");
  const canReports = usePermission("reports:read");

  // Internal open state for long-press in uncontrolled mode
  const [internalOpen, setInternalOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isControlled = open !== undefined;

  const triggerOpen = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(true);
    } else {
      setInternalOpen(true);
    }
  }, [isControlled, onOpenChange]);

  const handleCopyTagName = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tagName);
    } catch {
      // Clipboard may be unavailable in some environments — silent fail
    }
  }, [tagName]);

  const handlePointDetail = useCallback(() => {
    if (onPointDetail) {
      onPointDetail(pointId);
    } else {
      navigate(`/forensics?point=${encodeURIComponent(pointId)}&panel=detail`);
    }
  }, [navigate, pointId, onPointDetail]);

  const handleTrendPoint = useCallback(() => {
    if (onTrendPoint) {
      onTrendPoint(pointId);
    } else {
      navigate(`/console?trend=${encodeURIComponent(pointId)}`);
    }
  }, [navigate, pointId, onTrendPoint]);

  const handleInvestigatePoint = useCallback(async () => {
    if (onInvestigatePoint) {
      onInvestigatePoint(pointId);
      return;
    }
    const result = await forensicsApi.createInvestigation({
      name: `Investigation — ${tagName}`,
      anchor_point_id: pointId,
    });
    if (result.success) {
      navigate(`/forensics/investigations/${result.data.id}`);
    }
  }, [navigate, pointId, tagName, onInvestigatePoint]);

  const handleReportOnPoint = useCallback(() => {
    navigate(`/reports/new?point=${encodeURIComponent(pointId)}`);
  }, [navigate, pointId]);

  const handleInvestigateAlarm = useCallback(() => {
    navigate(`/forensics/new?alarm=${encodeURIComponent(pointId)}`);
  }, [navigate, pointId]);

  const focusStyle = (e: React.FocusEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).style.background =
      "var(--io-accent-subtle)";
  };
  const blurStyle = (e: React.FocusEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).style.background = "transparent";
  };

  return (
    <DropdownMenu.Root
      open={isControlled ? open : internalOpen}
      onOpenChange={isControlled ? onOpenChange : setInternalOpen}
    >
      {!isControlled ? (
        <DropdownMenu.Trigger asChild onContextMenu={(e) => e.preventDefault()}>
          {/* Wrap in a span that captures right-click and long-press, delegates to Radix trigger */}
          <span
            onContextMenu={(e) => {
              e.preventDefault();
              triggerOpen();
            }}
            onTouchStart={() => {
              longPressTimer.current = setTimeout(() => triggerOpen(), 500);
            }}
            onTouchEnd={() => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
            }}
            onTouchMove={() => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
            }}
            style={{ display: "contents" }}
          >
            {children}
          </span>
        </DropdownMenu.Trigger>
      ) : (
        <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
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

          {/* 2. Trend Point — hidden if user lacks console:read */}
          {canConsole && (
            <DropdownMenu.Item
              style={menuItemStyle}
              onSelect={handleTrendPoint}
              onFocus={focusStyle}
              onBlur={blurStyle}
            >
              Trend Point
            </DropdownMenu.Item>
          )}

          {/* Separator before investigation/reports actions */}
          <div style={separatorStyle} />

          {/* 3. Investigate Point — hidden if user lacks forensics:write */}
          {canForensicsWrite && (
            <DropdownMenu.Item
              style={menuItemStyle}
              onSelect={() => {
                void handleInvestigatePoint();
              }}
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

          {/* Copy Tag Name — always visible */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => {
              void handleCopyTagName();
            }}
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
  );
}
