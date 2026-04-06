import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { graphicsApi } from "../../api/graphics";
import type { WorkspaceLayout } from "./types";
import { useConsoleWorkspaceFavorites } from "../../shared/hooks/useConsoleWorkspaceFavorites";
import { useAuthStore } from "../../store/auth";
import {
  useConsoleFavorites,
  CONSOLE_FAVORITES_KEYS,
} from "../../shared/hooks/useConsoleFavorites";
import {
  useConsoleSectionViewMode,
  type SectionViewMode,
} from "../../shared/hooks/useConsoleSectionViewMode";
import * as RadixContextMenu from "@radix-ui/react-context-menu";
import PointsBrowserPanel from "../../shared/components/PointsBrowserPanel";
import {
  useSavedChartsStore,
  type SavedChart,
} from "../../store/savedChartsStore";
import { MicroIcon } from "../../shared/components/charts/ChartTypePicker";
import { usePermission } from "../../shared/hooks/usePermission";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Drag data key used to communicate drops from palette to panes
export const CONSOLE_DRAG_KEY = "application/io-console-item";

export interface ConsoleDragItem {
  itemType: "chart" | "graphic";
  label?: string;
  pointIds?: string[];
  graphicId?: string;
  /** Full chart config — set when dragging a saved chart from the palette. */
  chartConfig?: import("../../shared/components/charts/chart-config-types").ChartConfig;
}

// ---------------------------------------------------------------------------
// Helper: style constants
// ---------------------------------------------------------------------------

const PANEL_W = 220;

const panel: React.CSSProperties = {
  width: PANEL_W,
  minWidth: PANEL_W,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  background: "var(--io-surface-secondary)",
  borderRight: "1px solid var(--io-border)",
  overflow: "hidden",
  userSelect: "none",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "0 10px",
  height: 36,
  cursor: "pointer",
  flexShrink: 0,
  borderBottom: "1px solid var(--io-border)",
  gap: 6,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--io-text-muted)",
  flex: 1,
};

const chevron = (open: boolean): React.CSSProperties => ({
  width: 14,
  height: 14,
  color: "var(--io-text-muted)",
  transition: "transform 0.15s",
  transform: open ? "rotate(90deg)" : "rotate(0deg)",
  flexShrink: 0,
});

const listItem = (dragging?: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  fontSize: 12,
  color: "var(--io-text-primary)",
  cursor: "grab",
  borderRadius: "var(--io-radius)",
  margin: "1px 4px",
  opacity: dragging ? 0.5 : 1,
  transition: "background 0.1s",
});

// ---------------------------------------------------------------------------
// Accordion section
// ---------------------------------------------------------------------------

import React from "react";

// ---------------------------------------------------------------------------
// View mode icon components — List, Thumbnails, Grid
// ---------------------------------------------------------------------------

function ViewModeListIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="1" y1="3" x2="11" y2="3" />
      <line x1="1" y1="6" x2="11" y2="6" />
      <line x1="1" y1="9" x2="11" y2="9" />
    </svg>
  );
}

function ViewModeThumbnailsIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="1" width="4" height="3" rx="0.5" />
      <line x1="6.5" y1="2" x2="11" y2="2" />
      <line x1="6.5" y1="3.5" x2="9" y2="3.5" />
      <rect x="1" y="6" width="4" height="3" rx="0.5" />
      <line x1="6.5" y1="7" x2="11" y2="7" />
      <line x1="6.5" y1="8.5" x2="9" y2="8.5" />
    </svg>
  );
}

function ViewModeGridIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="1" width="4" height="4" rx="0.5" />
      <rect x="7" y="1" width="4" height="4" rx="0.5" />
      <rect x="1" y="7" width="4" height="4" rx="0.5" />
      <rect x="7" y="7" width="4" height="4" rx="0.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ViewModeSelector — three icon buttons shown in accordion section header
// ---------------------------------------------------------------------------

const VIEW_MODE_BUTTONS: {
  mode: SectionViewMode;
  label: string;
  Icon: React.FC;
}[] = [
  { mode: "list", label: "List view", Icon: ViewModeListIcon },
  {
    mode: "thumbnails",
    label: "Thumbnails view",
    Icon: ViewModeThumbnailsIcon,
  },
  { mode: "grid", label: "Grid view", Icon: ViewModeGridIcon },
];

function ViewModeSelector({
  current,
  onChange,
}: {
  current: SectionViewMode;
  onChange: (mode: SectionViewMode) => void;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      {VIEW_MODE_BUTTONS.map(({ mode, label, Icon }) => {
        const active = current === mode;
        return (
          <button
            key={mode}
            title={label}
            onClick={(e) => {
              e.stopPropagation();
              onChange(mode);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
              padding: 0,
              background: active ? "var(--io-accent-subtle)" : "transparent",
              color: active ? "var(--io-accent)" : "var(--io-text-muted)",
              transition: "background 0.1s, color 0.1s",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--io-surface-elevated)";
                (e.currentTarget as HTMLElement).style.color =
                  "var(--io-text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  "var(--io-text-muted)";
              }
            }}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accordion section
// ---------------------------------------------------------------------------

interface AccordionSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: number;
  /** Render function receives the current search term (empty string when no search active). */
  children: (search: string) => React.ReactNode;
  viewMode?: SectionViewMode;
  onViewModeChange?: (mode: SectionViewMode) => void;
  /** Controlled height for the content area when open; undefined = natural height */
  sectionHeight?: number;
  /** Called on mousedown of the bottom resize handle */
  onHeightResizeMouseDown?: (e: React.MouseEvent) => void;
  /** Whether a height resize is currently in progress */
  isHeightResizing?: boolean;
  /**
   * When true and open, the section grows to fill available flex space instead
   * of using a fixed pixel height. The content area scrolls internally.
   * Flexible sections do not show the bottom resize handle.
   */
  flexible?: boolean;
  /** Show a search toggle icon in the header. Click to reveal/hide an inline search bar. */
  searchable?: boolean;
}

function AccordionSection({
  title,
  open,
  onToggle,
  badge,
  children,
  viewMode,
  onViewModeChange,
  sectionHeight,
  onHeightResizeMouseDown,
  isHeightResizing,
  flexible,
  searchable,
}: AccordionSectionProps) {
  const [searchActive, setSearchActive] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  function toggleSearch(e: React.MouseEvent) {
    e.stopPropagation();
    if (searchActive) {
      setSearchActive(false);
      setSearchTerm("");
    } else {
      setSearchActive(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        ...(flexible && open
          ? { flex: "1 1 0", minHeight: 80, overflow: "hidden" }
          : { flexShrink: 0 }),
      }}
    >
      <div
        style={{ ...sectionHeader, paddingRight: 4 }}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
      >
        <svg
          style={chevron(open)}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 4 10 8 6 12" />
        </svg>
        <span style={sectionLabel}>{title}</span>
        {badge !== undefined && badge > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              background: "var(--io-accent-subtle)",
              color: "var(--io-accent)",
              borderRadius: 8,
              padding: "1px 5px",
              lineHeight: 1.4,
            }}
          >
            {badge}
          </span>
        )}
        {viewMode !== undefined && onViewModeChange !== undefined && (
          <ViewModeSelector current={viewMode} onChange={onViewModeChange} />
        )}
        {searchable && (
          <button
            title={searchActive ? "Close search" : "Search"}
            onClick={toggleSearch}
            style={{
              background: searchActive ? "var(--io-accent-subtle)" : "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 3,
              color: searchActive ? "var(--io-accent)" : "var(--io-text-muted)",
              flexShrink: 0,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        )}
      </div>
      {open && searchActive && (
        <div
          style={{
            padding: "4px 8px",
            borderBottom: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          <input
            ref={searchInputRef}
            type="search"
            placeholder={`Search ${title.toLowerCase()}…`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              padding: "3px 7px",
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              color: "var(--io-text)",
              fontSize: 11,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}
      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            ...(flexible
              ? { flex: 1, overflow: "hidden" }
              : {
                  overflow: sectionHeight !== undefined ? "hidden" : undefined,
                  height: sectionHeight,
                  minHeight:
                    sectionHeight !== undefined ? sectionHeight : undefined,
                }),
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY:
                flexible || sectionHeight !== undefined ? "auto" : undefined,
            }}
          >
            {children(searchActive ? searchTerm : "")}
          </div>
          {/* Bottom edge resize handle — only for non-flexible sections */}
          {!flexible && (
            <div
              role="separator"
              aria-label={`Resize ${title} section height`}
              onMouseDown={onHeightResizeMouseDown}
              style={{
                height: 5,
                cursor: "ns-resize",
                flexShrink: 0,
                background: isHeightResizing
                  ? "var(--io-accent)"
                  : "transparent",
                borderTop: "1px solid var(--io-border)",
                transition: "background 0.1s",
                userSelect: "none",
              }}
              onMouseEnter={(e) => {
                if (!isHeightResizing) {
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--io-surface-elevated)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isHeightResizing) {
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Star icon — used in rows to toggle favorites
// ---------------------------------------------------------------------------

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill={filled ? "var(--io-warning)" : "none"}
      stroke={filled ? "var(--io-warning)" : "var(--io-text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SubGroupLabel — static non-interactive sub-group label
// ---------------------------------------------------------------------------

function SubGroupLabel({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--io-text-muted)",
        padding: "6px 10px 2px",
        display: "flex",
        alignItems: "center",
        gap: 5,
        userSelect: "none",
      }}
    >
      {icon}
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LockIcon — used in Published sub-group label
// ---------------------------------------------------------------------------

function LockIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--io-text-muted)", flexShrink: 0 }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// PersonIcon — used in Personal sub-group label
// ---------------------------------------------------------------------------

function PersonIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--io-text-muted)", flexShrink: 0 }}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Single workspace row — used in both favorites and full list
// ---------------------------------------------------------------------------

function WorkspaceRow({
  ws,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onRename,
  onDuplicate,
  onDelete,
  canDelete,
  onOpenInWindow,
}: {
  ws: WorkspaceLayout;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  onOpenInWindow?: () => void;
}) {
  const [hovering, setHovering] = useState(false);

  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: isActive
              ? "color-mix(in srgb, var(--io-accent) 14%, transparent)"
              : "transparent",
            padding: "0 4px 0 0",
          }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <button
            onClick={onSelect}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: 1,
              padding: "5px 6px 5px 10px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
              minWidth: 0,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--io-text-muted)"
              strokeWidth="2"
              style={{ flexShrink: 0 }}
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span
              style={{
                flex: 1,
                fontSize: 12,
                color: isActive ? "var(--io-accent)" : "var(--io-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {ws.name}
            </span>
          </button>
          {/* Star button — visible on hover or when already favorited */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 3px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 3,
              flexShrink: 0,
              opacity: isFavorite || hovering ? 1 : 0,
              transition: "opacity 0.1s",
            }}
          >
            <StarIcon filled={isFavorite} />
          </button>
        </div>
      </RadixContextMenu.Trigger>

      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          style={{
            zIndex: 1800,
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            minWidth: 200,
            paddingTop: 4,
            paddingBottom: 4,
            outline: "none",
            animation: "io-context-menu-in 0.08s ease",
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <style>{`
            @keyframes io-context-menu-in {
              from { opacity: 0; transform: scale(0.97) translateY(-3px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
            [data-radix-context-menu-item]:focus {
              background: var(--io-accent-subtle);
              outline: none;
            }
          `}</style>

          <RadixContextMenu.Item onSelect={onSelect} style={ctxMenuItemStyle}>
            Open
          </RadixContextMenu.Item>

          {onOpenInWindow && (
            <RadixContextMenu.Item
              onSelect={onOpenInWindow}
              style={ctxMenuItemStyle}
            >
              Open in New Window
            </RadixContextMenu.Item>
          )}

          <RadixContextMenu.Separator style={ctxMenuSeparatorStyle} />

          <RadixContextMenu.Item
            onSelect={onToggleFavorite}
            style={ctxMenuItemStyle}
          >
            {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          </RadixContextMenu.Item>

          {onRename && (
            <RadixContextMenu.Item onSelect={onRename} style={ctxMenuItemStyle}>
              {"Rename\u2026"}
            </RadixContextMenu.Item>
          )}

          {onDuplicate && (
            <RadixContextMenu.Item
              onSelect={onDuplicate}
              style={ctxMenuItemStyle}
            >
              Duplicate
            </RadixContextMenu.Item>
          )}

          {onDelete && (
            <>
              <RadixContextMenu.Separator style={ctxMenuSeparatorStyle} />
              <RadixContextMenu.Item
                onSelect={onDelete}
                disabled={!canDelete}
                style={{
                  ...ctxMenuItemStyle,
                  color: !canDelete
                    ? "var(--io-text-muted)"
                    : "var(--io-text-primary)",
                  opacity: !canDelete ? 0.5 : 1,
                  cursor: !canDelete ? "default" : "pointer",
                }}
              >
                Delete
              </RadixContextMenu.Item>
            </>
          )}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}

const ctxMenuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 14px",
  fontSize: 13,
  color: "var(--io-text-primary)",
  cursor: "pointer",
  userSelect: "none",
  outline: "none",
};

const ctxMenuSeparatorStyle: React.CSSProperties = {
  height: 1,
  background: "var(--io-border)",
  margin: "3px 0",
};

// ---------------------------------------------------------------------------
// WorkspaceThumbnailCard — for thumbnails (48×36) and grid (80×60) view modes
// ---------------------------------------------------------------------------

function WorkspaceThumbnailCard({
  ws,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onRename,
  onDuplicate,
  onDelete,
  canDelete,
  gridMode,
  onOpenInWindow,
}: {
  ws: WorkspaceLayout;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  gridMode: boolean;
  onOpenInWindow?: () => void;
}) {
  const [hovering, setHovering] = useState(false);
  const thumbW = gridMode ? 80 : 48;
  const thumbH = gridMode ? 60 : 36;

  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>
        <div
          title={ws.name}
          onClick={onSelect}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          style={{
            display: "flex",
            flexDirection: gridMode ? "column" : "row",
            alignItems: gridMode ? "center" : "flex-start",
            gap: gridMode ? 4 : 8,
            padding: gridMode ? "6px 4px" : "5px 6px",
            borderRadius: "var(--io-radius)",
            cursor: "pointer",
            background: isActive
              ? "color-mix(in srgb, var(--io-accent) 14%, transparent)"
              : "transparent",
            border: isActive
              ? "1px solid color-mix(in srgb, var(--io-accent) 30%, transparent)"
              : "1px solid transparent",
            transition: "background 0.1s",
            position: "relative",
          }}
          onMouseOver={(e) => {
            if (!isActive)
              (e.currentTarget as HTMLElement).style.background =
                "var(--io-surface-elevated)";
          }}
          onMouseOut={(e) => {
            if (!isActive)
              (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          {/* Mini layout preview thumbnail */}
          <div
            style={{
              width: thumbW,
              height: thumbH,
              flexShrink: 0,
              background: "var(--io-surface-sunken)",
              borderRadius: 3,
              border: "1px solid var(--io-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* Placeholder grid pattern representing panes */}
            <svg
              width={thumbW - 6}
              height={thumbH - 6}
              viewBox="0 0 40 30"
              fill="none"
            >
              <rect
                x="1"
                y="1"
                width="18"
                height="13"
                rx="1"
                fill="var(--io-border)"
                opacity="0.6"
              />
              <rect
                x="21"
                y="1"
                width="18"
                height="13"
                rx="1"
                fill="var(--io-border)"
                opacity="0.6"
              />
              <rect
                x="1"
                y="16"
                width="38"
                height="13"
                rx="1"
                fill="var(--io-border)"
                opacity="0.4"
              />
            </svg>
          </div>

          {/* Name — up to 2 lines in thumbnails, 1 line in grid */}
          <div
            style={{
              flex: gridMode ? undefined : 1,
              minWidth: 0,
              textAlign: gridMode ? "center" : "left",
              width: gridMode ? thumbW : undefined,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: isActive ? "var(--io-accent)" : "var(--io-text-primary)",
                fontWeight: isActive ? 600 : 400,
                display: "-webkit-box",
                WebkitLineClamp: gridMode ? 1 : 2,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}
            >
              {ws.name}
            </span>
          </div>

          {/* Star button — appears on hover or when favorited */}
          {!gridMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 3,
                flexShrink: 0,
                opacity: isFavorite || hovering ? 1 : 0,
                transition: "opacity 0.1s",
              }}
            >
              <StarIcon filled={isFavorite} />
            </button>
          )}
        </div>
      </RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          style={{
            zIndex: 1800,
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            minWidth: 160,
            paddingTop: 4,
            paddingBottom: 4,
            outline: "none",
            animation: "io-context-menu-in 0.08s ease",
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <style>{`
            @keyframes io-context-menu-in {
              from { opacity: 0; transform: scale(0.97) translateY(-3px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
            [data-radix-context-menu-item]:focus {
              background: var(--io-accent-subtle);
              outline: none;
            }
          `}</style>

          <RadixContextMenu.Item onSelect={onSelect} style={ctxMenuItemStyle}>
            Open
          </RadixContextMenu.Item>

          {onOpenInWindow && (
            <RadixContextMenu.Item
              onSelect={onOpenInWindow}
              style={ctxMenuItemStyle}
            >
              Open in New Window
            </RadixContextMenu.Item>
          )}

          <RadixContextMenu.Separator style={ctxMenuSeparatorStyle} />

          <RadixContextMenu.Item
            onSelect={onToggleFavorite}
            style={ctxMenuItemStyle}
          >
            {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          </RadixContextMenu.Item>

          {onRename && (
            <RadixContextMenu.Item onSelect={onRename} style={ctxMenuItemStyle}>
              {"Rename\u2026"}
            </RadixContextMenu.Item>
          )}

          {onDuplicate && (
            <RadixContextMenu.Item
              onSelect={onDuplicate}
              style={ctxMenuItemStyle}
            >
              Duplicate
            </RadixContextMenu.Item>
          )}

          {onDelete && (
            <>
              <RadixContextMenu.Separator style={ctxMenuSeparatorStyle} />
              <RadixContextMenu.Item
                onSelect={onDelete}
                disabled={!canDelete}
                style={{
                  ...ctxMenuItemStyle,
                  color: !canDelete
                    ? "var(--io-text-muted)"
                    : "var(--io-text-primary)",
                  opacity: !canDelete ? 0.5 : 1,
                  cursor: !canDelete ? "default" : "pointer",
                }}
              >
                Delete
              </RadixContextMenu.Item>
            </>
          )}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}

// ---------------------------------------------------------------------------
// Workspaces section — Favorites / Published / Personal grouping
// ---------------------------------------------------------------------------

function WorkspacesSection({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  favoriteIds,
  onToggleFavorite,
  onRenameWorkspace,
  onDuplicateWorkspace,
  onDeleteWorkspace,
  viewMode,
  search = "",
}: {
  workspaces: WorkspaceLayout[];
  activeWorkspaceId: string | null;
  onSelectWorkspace?: (id: string) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  onRenameWorkspace?: (id: string) => void;
  onDuplicateWorkspace?: (id: string) => void;
  onDeleteWorkspace?: (id: string) => void;
  viewMode: SectionViewMode;
  search?: string;
}) {
  const currentUserId = useAuthStore((s) => s.user?.id);

  const filteredWorkspaces = search
    ? workspaces.filter((ws) =>
        ws.name.toLowerCase().includes(search.toLowerCase()),
      )
    : workspaces;

  const favoriteItems = filteredWorkspaces.filter((ws) =>
    favoriteIds.has(ws.id),
  );
  const publishedItems = filteredWorkspaces.filter(
    (ws) => ws.published && !favoriteIds.has(ws.id),
  );
  const personalItems = filteredWorkspaces.filter(
    (ws) => !ws.published && !favoriteIds.has(ws.id),
  );

  const isGridMode = viewMode === "grid";
  const isThumbnailsMode = viewMode === "thumbnails";
  const useCards = isThumbnailsMode || isGridMode;

  const renderWorkspaceList = (
    wsList: WorkspaceLayout[],
    canDeleteCheck: boolean,
  ) => {
    if (!useCards) {
      return wsList.map((ws) => (
        <WorkspaceRow
          key={ws.id}
          ws={ws}
          isActive={ws.id === activeWorkspaceId}
          isFavorite={favoriteIds.has(ws.id)}
          onSelect={() => onSelectWorkspace?.(ws.id)}
          onToggleFavorite={() => onToggleFavorite(ws.id)}
          onRename={
            onRenameWorkspace ? () => onRenameWorkspace(ws.id) : undefined
          }
          onDuplicate={
            onDuplicateWorkspace ? () => onDuplicateWorkspace(ws.id) : undefined
          }
          onDelete={
            onDeleteWorkspace ? () => onDeleteWorkspace(ws.id) : undefined
          }
          canDelete={canDeleteCheck}
          onOpenInWindow={() =>
            window.open(
              `/detached/console/${ws.id}`,
              "_blank",
              "noopener,noreferrer,width=1400,height=900",
            )
          }
        />
      ));
    }

    if (isGridMode) {
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 4,
            padding: "4px 6px",
          }}
        >
          {wsList.map((ws) => (
            <WorkspaceThumbnailCard
              key={ws.id}
              ws={ws}
              isActive={ws.id === activeWorkspaceId}
              isFavorite={favoriteIds.has(ws.id)}
              onSelect={() => onSelectWorkspace?.(ws.id)}
              onToggleFavorite={() => onToggleFavorite(ws.id)}
              onRename={
                onRenameWorkspace ? () => onRenameWorkspace(ws.id) : undefined
              }
              onDuplicate={
                onDuplicateWorkspace
                  ? () => onDuplicateWorkspace(ws.id)
                  : undefined
              }
              onDelete={
                onDeleteWorkspace ? () => onDeleteWorkspace(ws.id) : undefined
              }
              canDelete={canDeleteCheck}
              gridMode
              onOpenInWindow={() =>
                window.open(
                  `/detached/console/${ws.id}`,
                  "_blank",
                  "noopener,noreferrer,width=1400,height=900",
                )
              }
            />
          ))}
        </div>
      );
    }

    // Thumbnails view — vertical list with 48×36 thumbnails
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "4px 6px",
        }}
      >
        {wsList.map((ws) => (
          <WorkspaceThumbnailCard
            key={ws.id}
            ws={ws}
            isActive={ws.id === activeWorkspaceId}
            isFavorite={favoriteIds.has(ws.id)}
            onSelect={() => onSelectWorkspace?.(ws.id)}
            onToggleFavorite={() => onToggleFavorite(ws.id)}
            onRename={
              onRenameWorkspace ? () => onRenameWorkspace(ws.id) : undefined
            }
            onDuplicate={
              onDuplicateWorkspace
                ? () => onDuplicateWorkspace(ws.id)
                : undefined
            }
            onDelete={
              onDeleteWorkspace ? () => onDeleteWorkspace(ws.id) : undefined
            }
            canDelete={canDeleteCheck}
            gridMode={false}
            onOpenInWindow={() =>
              window.open(
                `/detached/console/${ws.id}`,
                "_blank",
                "noopener,noreferrer,width=1400,height=900",
              )
            }
          />
        ))}
      </div>
    );
  };

  // Suppress unused variable warning — currentUserId is reserved for future
  // owner-based delete permission checks on published workspaces.
  void currentUserId;

  return (
    <div style={{ padding: "4px 0" }}>
      {favoriteItems.length > 0 && (
        <>
          <SubGroupLabel label="Favorites" icon={<StarIcon filled />} />
          {renderWorkspaceList(favoriteItems, false)}
        </>
      )}

      {publishedItems.length > 0 && (
        <>
          <SubGroupLabel label="Published" icon={<LockIcon />} />
          {renderWorkspaceList(publishedItems, true)}
        </>
      )}

      {personalItems.length > 0 && (
        <>
          <SubGroupLabel label="Personal" icon={<PersonIcon />} />
          {renderWorkspaceList(personalItems, true)}
        </>
      )}

      {filteredWorkspaces.length === 0 && (
        <div
          style={{
            padding: "4px 10px",
            fontSize: 12,
            color: "var(--io-text-muted)",
            lineHeight: 1.5,
          }}
        >
          {search ? "No workspaces match." : "No saved workspaces."}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Charts section — single draggable "Chart" item that opens Configure Chart
// ---------------------------------------------------------------------------

const CHART_ITEM_ICON_SM = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="var(--io-accent)"
    strokeWidth="1.5"
  >
    <polyline points="1 12 4 7 7 9 10 5 15 3" />
    <line x1="1" y1="14" x2="15" y2="14" strokeOpacity="0.4" />
  </svg>
);

function ChartsSection({
  onQuickPlace,
}: {
  onQuickPlace?: (item: ConsoleDragItem) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const { charts, publishChart, deleteChart } = useSavedChartsStore();
  const canPublish = usePermission("console:publish");
  const blankItem: ConsoleDragItem = { itemType: "chart", label: "Chart" };

  const published = charts.filter((c) => c.published);
  const personal = charts.filter((c) => !c.published);

  function dragSaved(e: React.DragEvent, chart: SavedChart) {
    const item: ConsoleDragItem = {
      itemType: "chart",
      label: chart.name,
      chartConfig: chart.config,
    };
    e.dataTransfer.setData(CONSOLE_DRAG_KEY, JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      style={{
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {/* Blank "any chart" item */}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(CONSOLE_DRAG_KEY, JSON.stringify(blankItem));
          e.dataTransfer.effectAllowed = "copy";
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onQuickPlace?.(blankItem);
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        title="Drag onto a pane, or double-click to place in the selected pane"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          borderRadius: 4,
          cursor: "grab",
          background: dragging
            ? "var(--io-accent-subtle)"
            : hovering
              ? "var(--io-surface-elevated)"
              : "transparent",
          border: dragging
            ? "1px solid var(--io-accent)"
            : "1px solid transparent",
          userSelect: "none",
        }}
      >
        {CHART_ITEM_ICON_SM}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 12, color: "var(--io-text)", fontWeight: 500 }}
          >
            Chart
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--io-text-muted)",
              marginTop: 1,
            }}
          >
            Trend · Table · Alarm · Any chart type
          </div>
        </div>
      </div>

      {/* Saved charts */}
      {charts.length > 0 && (
        <>
          {published.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--io-text-muted)",
                  padding: "6px 8px 2px",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Published
              </div>
              {published.map((chart) => (
                <SavedChartRow
                  key={chart.id}
                  chart={chart}
                  canPublish={canPublish}
                  onDragStart={dragSaved}
                  onQuickPlace={() =>
                    onQuickPlace?.({
                      itemType: "chart",
                      label: chart.name,
                      chartConfig: chart.config,
                    })
                  }
                  onPublish={(pub) => publishChart(chart.id, pub)}
                  onDelete={() => deleteChart(chart.id)}
                />
              ))}
            </>
          )}
          {personal.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--io-text-muted)",
                  padding: "6px 8px 2px",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Personal
              </div>
              {personal.map((chart) => (
                <SavedChartRow
                  key={chart.id}
                  chart={chart}
                  canPublish={canPublish}
                  onDragStart={dragSaved}
                  onQuickPlace={() =>
                    onQuickPlace?.({
                      itemType: "chart",
                      label: chart.name,
                      chartConfig: chart.config,
                    })
                  }
                  onPublish={(pub) => publishChart(chart.id, pub)}
                  onDelete={() => deleteChart(chart.id)}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function SavedChartRow({
  chart,
  canPublish,
  onDragStart,
  onQuickPlace,
  onPublish,
  onDelete,
}: {
  chart: SavedChart;
  canPublish: boolean;
  onDragStart: (e: React.DragEvent, chart: SavedChart) => void;
  onQuickPlace: () => void;
  onPublish: (published: boolean) => void;
  onDelete: () => void;
}) {
  const [hovering, setHovering] = useState(false);

  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>
        <div
          draggable
          onDragStart={(e) => onDragStart(e, chart)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onQuickPlace();
          }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          title={`${chart.name}${chart.description ? `\n${chart.description}` : ""}\nDrag to place · double-click to quick-place`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 8px",
            borderRadius: 4,
            cursor: "grab",
            background: hovering ? "var(--io-surface-elevated)" : "transparent",
            userSelect: "none",
          }}
        >
          <span
            style={{
              color: "var(--io-accent)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <MicroIcon id={chart.chartType} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--io-text)",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {chart.name}
            </div>
            {chart.description && (
              <div
                style={{
                  fontSize: 10,
                  color: "var(--io-text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {chart.description}
              </div>
            )}
          </div>
        </div>
      </RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          style={{
            zIndex: 1800,
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            minWidth: 180,
            paddingTop: 4,
            paddingBottom: 4,
            outline: "none",
          }}
        >
          <RadixContextMenu.Item
            onSelect={onQuickPlace}
            style={ctxMenuItemStyle}
          >
            Place in Active Pane
          </RadixContextMenu.Item>
          <RadixContextMenu.Separator style={ctxMenuSeparatorStyle} />
          {canPublish && (
            <RadixContextMenu.Item
              onSelect={() => onPublish(!chart.published)}
              style={ctxMenuItemStyle}
            >
              {chart.published ? "Unpublish" : "Publish"}
            </RadixContextMenu.Item>
          )}
          <RadixContextMenu.Separator style={ctxMenuSeparatorStyle} />
          <RadixContextMenu.Item
            onSelect={onDelete}
            style={{ ...ctxMenuItemStyle, color: "var(--io-error, #e05)" }}
          >
            Delete
          </RadixContextMenu.Item>
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}

// ---------------------------------------------------------------------------
// Points section
// ---------------------------------------------------------------------------

function PointsSection({ search }: { search?: string }) {
  return (
    <PointsBrowserPanel
      cacheKey="console-points-browser"
      emptyHint="Drag a point onto a Chart or Table pane to add it."
      externalSearch={search}
      onDragStart={(e, pts) => {
        e.dataTransfer.setData(
          CONSOLE_DRAG_KEY,
          JSON.stringify({
            itemType: "chart",
            label: pts.length === 1 ? pts[0].tagname : `${pts.length} points`,
            pointIds: pts.map((p) => p.id),
          }),
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Graphic thumbnail tile — drag-to-drop onto console pane
// ---------------------------------------------------------------------------

function GraphicTile({
  item,
  name,
  thumbUrl,
  isFavorite,
  onToggleFavorite,
  onQuickPlace,
}: {
  item: ConsoleDragItem;
  name: string;
  thumbUrl: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onQuickPlace?: (item: ConsoleDragItem) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [hovering, setHovering] = useState(false);

  return (
    <div
      draggable
      onDoubleClick={(e) => {
        e.stopPropagation();
        onQuickPlace?.(item);
      }}
      style={{
        position: "relative",
        padding: "5px 6px",
        borderRadius: "var(--io-radius)",
        cursor: "grab",
        opacity: dragging ? 0.5 : 1,
        transition: "background 0.1s",
        border: "1px solid transparent",
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData(CONSOLE_DRAG_KEY, JSON.stringify(item));
        e.dataTransfer.effectAllowed = "copy";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onMouseEnter={(e) => {
        setHovering(true);
        (e.currentTarget as HTMLElement).style.background =
          "var(--io-surface-elevated)";
      }}
      onMouseLeave={(e) => {
        setHovering(false);
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          background: "var(--io-surface-sunken)",
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid var(--io-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
      >
        {!thumbError ? (
          <img
            src={thumbUrl}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={() => setThumbError(true)}
          />
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--io-text-muted)"
            strokeWidth="1.2"
            opacity={0.4}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        )}
      </div>
      <span
        style={{
          fontSize: 11,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "block",
          color: "var(--io-text-primary)",
        }}
      >
        {name}
      </span>
      {/* Star overlay — shown on hover or when favorited */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggleFavorite();
        }}
        title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "rgba(0,0,0,0.5)",
          border: "none",
          cursor: "pointer",
          padding: "3px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
          flexShrink: 0,
          opacity: isFavorite || hovering ? 1 : 0,
          transition: "opacity 0.1s",
        }}
      >
        <StarIcon filled={isFavorite} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Graphics section — shows available graphics as thumbnail tiles
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Graphic list row — for list view mode
// ---------------------------------------------------------------------------

function GraphicListRow({
  g,
  onQuickPlace,
}: {
  g: { id: string; name: string };
  onQuickPlace?: (item: ConsoleDragItem) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const item: ConsoleDragItem = {
    itemType: "graphic",
    graphicId: g.id,
    label: g.name,
  };

  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>
        <div
          draggable
          style={listItem(dragging)}
          title={g.name}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onQuickPlace?.(item);
          }}
          onDragStart={(e) => {
            e.dataTransfer.setData(CONSOLE_DRAG_KEY, JSON.stringify(item));
            e.dataTransfer.effectAllowed = "copy";
            setDragging(true);
          }}
          onDragEnd={() => setDragging(false)}
          onMouseEnter={(e) => {
            if (!dragging)
              (e.currentTarget as HTMLElement).style.background =
                "var(--io-surface-elevated)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--io-text-muted)"
            strokeWidth="1.2"
            style={{ flexShrink: 0 }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <span
            style={{
              flex: 1,
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {g.name}
          </span>
        </div>
      </RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          style={{
            zIndex: 1800,
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            minWidth: 180,
            paddingTop: 4,
            paddingBottom: 4,
            outline: "none",
            animation: "io-context-menu-in 0.08s ease",
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <RadixContextMenu.Item
            onSelect={() => onQuickPlace?.(item)}
            style={ctxMenuItemStyle}
          >
            Open in Pane
          </RadixContextMenu.Item>
          <RadixContextMenu.Item
            onSelect={() =>
              window.open(
                `/detached/process/${g.id}`,
                "_blank",
                "noopener,noreferrer,width=1400,height=900",
              )
            }
            style={ctxMenuItemStyle}
          >
            Open in New Window
          </RadixContextMenu.Item>
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}

function GraphicsSection({
  onQuickPlace,
  viewMode,
  favoriteIds,
  onToggleFavorite,
  search = "",
}: {
  onQuickPlace?: (item: ConsoleDragItem) => void;
  viewMode: SectionViewMode;
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  search?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["console-palette-graphics"],
    queryFn: async () => {
      const r = await graphicsApi.list({ scope: "console" });
      if (!r.success) return [];
      return r.data.data ?? [];
    },
    staleTime: 60_000,
  });

  const graphics = data ?? [];
  const filteredGraphics = search
    ? graphics.filter((g) =>
        g.name.toLowerCase().includes(search.toLowerCase()),
      )
    : graphics;

  const favoriteGraphics = filteredGraphics.filter((g) =>
    favoriteIds.has(g.id),
  );
  const libraryGraphics = filteredGraphics.filter(
    (g) => !favoriteIds.has(g.id),
  );

  if (isLoading) {
    return (
      <div style={{ padding: "4px 0" }}>
        <div
          style={{
            padding: "8px 10px",
            fontSize: 12,
            color: "var(--io-text-muted)",
          }}
        >
          Loading…
        </div>
      </div>
    );
  }

  if (graphics.length === 0) {
    return (
      <div style={{ padding: "4px 0" }}>
        <div
          style={{
            padding: "8px 10px",
            fontSize: 12,
            color: "var(--io-text-muted)",
            lineHeight: 1.5,
          }}
        >
          No graphics. Create one in Designer.
        </div>
      </div>
    );
  }

  const isGrid = viewMode === "grid";

  // Render a single graphic in list mode with an inline star toggle
  function GraphicListRowWithStar({ g }: { g: { id: string; name: string } }) {
    const [hovering, setHovering] = useState(false);
    const fav = favoriteIds.has(g.id);
    return (
      <div
        style={{ display: "flex", alignItems: "center", padding: "0 4px 0 0" }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <GraphicListRow g={g} onQuickPlace={onQuickPlace} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(g.id);
          }}
          title={fav ? "Remove from Favorites" : "Add to Favorites"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 3px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 3,
            flexShrink: 0,
            opacity: fav || hovering ? 1 : 0,
            transition: "opacity 0.1s",
          }}
        >
          <StarIcon filled={fav} />
        </button>
      </div>
    );
  }

  const renderGraphicGroup = (
    items: typeof filteredGraphics,
  ): React.ReactNode => {
    if (viewMode === "list") {
      return (
        <div style={{ padding: "0 0 2px" }}>
          {items.map((g) => (
            <GraphicListRowWithStar key={g.id} g={g} />
          ))}
        </div>
      );
    }
    return (
      <div
        style={{
          display: isGrid ? "grid" : "flex",
          gridTemplateColumns: isGrid
            ? "repeat(auto-fill, minmax(88px, 1fr))"
            : undefined,
          flexDirection: isGrid ? undefined : "column",
          gap: isGrid ? 6 : 3,
          padding: "0 0 2px",
        }}
      >
        {items.map((g) => {
          const thumbUrl = graphicsApi.thumbnailUrl(g.id);
          const item: ConsoleDragItem = {
            itemType: "graphic",
            graphicId: g.id,
            label: g.name,
          };
          return (
            <GraphicTile
              key={g.id}
              item={item}
              name={g.name}
              thumbUrl={thumbUrl}
              isFavorite={favoriteIds.has(g.id)}
              onToggleFavorite={() => onToggleFavorite(g.id)}
              onQuickPlace={onQuickPlace}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        padding: "6px 6px 4px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {filteredGraphics.length === 0 && (
        <div
          style={{
            padding: "4px 4px",
            fontSize: 12,
            color: "var(--io-text-muted)",
          }}
        >
          No matching graphics
        </div>
      )}

      {favoriteGraphics.length > 0 && (
        <>
          <SubGroupLabel label="Favorites" icon={<StarIcon filled />} />
          {renderGraphicGroup(favoriteGraphics)}
        </>
      )}

      {libraryGraphics.length > 0 && (
        <>
          {favoriteGraphics.length > 0 && <SubGroupLabel label="Library" />}
          {renderGraphicGroup(libraryGraphics)}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConsolePalette — main component
// ---------------------------------------------------------------------------

interface ConsolePaletteProps {
  visible: boolean;
  onToggle: () => void;
  onQuickPlace?: (item: ConsoleDragItem) => void;
  workspaces?: WorkspaceLayout[];
  activeWorkspaceId?: string | null;
  onSelectWorkspace?: (id: string) => void;
  onRenameWorkspace?: (id: string) => void;
  onDuplicateWorkspace?: (id: string) => void;
  onDeleteWorkspace?: (id: string) => void;
  /** Panel width — lifted to parent so the header can align tabs. */
  panelWidth: number;
  /** Resize drag handler for the panel's right edge. */
  onPanelResizeMouseDown: (e: React.MouseEvent) => void;
  /** True while the user is dragging the resize handle. */
  isPanelResizing: boolean;
}

export default function ConsolePalette({
  visible,
  onToggle,
  onQuickPlace,
  workspaces = [],
  activeWorkspaceId = null,
  onSelectWorkspace,
  onRenameWorkspace,
  onDuplicateWorkspace,
  onDeleteWorkspace,
  panelWidth,
  onPanelResizeMouseDown,
  isPanelResizing,
}: ConsolePaletteProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    workspaces: true,
    graphics: true,
    widgets: true,
    points: false,
  });

  // Workspace favorites — uses legacy hook for backward-compat with existing LS key
  const {
    favoriteIds: workspaceFavoriteIds,
    toggleFavorite: toggleWorkspaceFavorite,
  } = useConsoleWorkspaceFavorites();

  // Graphic, widget, and point favorites — generic hook
  const {
    favoriteIds: graphicFavoriteIds,
    toggleFavorite: toggleGraphicFavorite,
  } = useConsoleFavorites(CONSOLE_FAVORITES_KEYS.graphics);

  // Per-section view modes — persisted in localStorage
  const { viewMode: workspacesViewMode, setViewMode: setWorkspacesViewMode } =
    useConsoleSectionViewMode("workspaces", "list");
  const { viewMode: graphicsViewMode, setViewMode: setGraphicsViewMode } =
    useConsoleSectionViewMode("graphics", "grid");

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Section height resize — drag the bottom handle to change a section's pixel height.
  // Points section remains flexible (fills whatever is left).
  const [sectionHeights, setSectionHeights] = useState<Record<string, number>>({
    workspaces: 200,
    graphics: 200,
  });
  const resizingSectionRef = useRef<string | null>(null);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(0);
  const [resizingSection, setResizingSection] = useState<string | null>(null);
  const [expandHovered, setExpandHovered] = useState(false);

  const handleSectionResizeMouseDown = useCallback(
    (sectionKey: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizingSectionRef.current = sectionKey;
      resizeStartYRef.current = e.clientY;
      resizeStartHeightRef.current = sectionHeights[sectionKey] ?? 200;
      setResizingSection(sectionKey);
    },
    [sectionHeights],
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizingSectionRef.current) return;
      const delta = e.clientY - resizeStartYRef.current;
      const newHeight = Math.max(80, resizeStartHeightRef.current + delta);
      setSectionHeights((prev) => ({
        ...prev,
        [resizingSectionRef.current!]: newHeight,
      }));
    }
    function onMouseUp() {
      if (!resizingSectionRef.current) return;
      resizingSectionRef.current = null;
      setResizingSection(null);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  if (!visible) {
    return (
      <div
        style={{ position: "relative", width: 0, flexShrink: 0, zIndex: 10 }}
        onMouseEnter={() => setExpandHovered(true)}
        onMouseLeave={() => setExpandHovered(false)}
      >
        {/* Invisible hover zone — widens on hover to reveal the expand button */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: expandHovered ? 28 : 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "width 0.15s",
            overflow: "hidden",
          }}
        >
          <button
            onClick={onToggle}
            title="Show palette"
            style={{
              background: "var(--io-surface-secondary)",
              border: "1px solid var(--io-border)",
              borderLeft: "none",
              borderRadius: "0 4px 4px 0",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              padding: "6px 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: expandHovered ? 1 : 0,
              transition: "opacity 0.15s",
              flexShrink: 0,
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="6 4 10 8 6 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...panel,
        width: panelWidth,
        minWidth: panelWidth,
        position: "relative",
        cursor: isPanelResizing ? "col-resize" : undefined,
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          height: 36,
          borderBottom: "1px solid var(--io-border)",
          flexShrink: 0,
          gap: 6,
        }}
      >
        <span
          style={{
            ...sectionLabel,
            color: "var(--io-text-secondary)",
            fontSize: 12,
            fontWeight: 700,
            flex: 1,
          }}
        >
          Assets
        </span>
        <button
          onClick={onToggle}
          title="Collapse palette"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--io-text-muted)",
            padding: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 3,
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </button>
      </div>

      {/* Sections container — flex column, sections with flexible prop fill remaining space */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <AccordionSection
          title="Workspaces"
          open={openSections.workspaces}
          onToggle={() => toggleSection("workspaces")}
          badge={workspaces.length}
          viewMode={workspacesViewMode}
          onViewModeChange={setWorkspacesViewMode}
          sectionHeight={
            openSections.workspaces ? sectionHeights.workspaces : undefined
          }
          onHeightResizeMouseDown={handleSectionResizeMouseDown("workspaces")}
          isHeightResizing={resizingSection === "workspaces"}
          searchable
        >
          {(search) => (
            <WorkspacesSection
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              onSelectWorkspace={onSelectWorkspace}
              favoriteIds={workspaceFavoriteIds}
              onToggleFavorite={toggleWorkspaceFavorite}
              onRenameWorkspace={onRenameWorkspace}
              onDuplicateWorkspace={onDuplicateWorkspace}
              onDeleteWorkspace={onDeleteWorkspace}
              viewMode={workspacesViewMode}
              search={search}
            />
          )}
        </AccordionSection>

        <AccordionSection
          title="Graphics"
          open={openSections.graphics}
          onToggle={() => toggleSection("graphics")}
          viewMode={graphicsViewMode}
          onViewModeChange={setGraphicsViewMode}
          sectionHeight={
            openSections.graphics ? sectionHeights.graphics : undefined
          }
          onHeightResizeMouseDown={handleSectionResizeMouseDown("graphics")}
          isHeightResizing={resizingSection === "graphics"}
          searchable
        >
          {(search) => (
            <GraphicsSection
              onQuickPlace={onQuickPlace}
              viewMode={graphicsViewMode}
              favoriteIds={graphicFavoriteIds}
              onToggleFavorite={toggleGraphicFavorite}
              search={search}
            />
          )}
        </AccordionSection>

        <AccordionSection
          title="Charts"
          open={openSections.widgets}
          onToggle={() => toggleSection("widgets")}
        >
          {() => <ChartsSection onQuickPlace={onQuickPlace} />}
        </AccordionSection>

        <AccordionSection
          title="Points"
          open={openSections.points}
          onToggle={() => toggleSection("points")}
          flexible
          searchable
        >
          {(search) => <PointsSection search={search} />}
        </AccordionSection>
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: "6px 10px",
          borderTop: "1px solid var(--io-border)",
          fontSize: 10,
          color: "var(--io-text-muted)",
          flexShrink: 0,
          lineHeight: 1.5,
        }}
      >
        Drag items onto panes to assign them
      </div>

      {/* Right-edge resize handle — drag to adjust panel width (200–400px) */}
      <div
        role="separator"
        aria-label="Resize assets palette width"
        onMouseDown={onPanelResizeMouseDown}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 5,
          height: "100%",
          cursor: "col-resize",
          background: isPanelResizing ? "var(--io-accent)" : "transparent",
          transition: "background 0.1s",
          zIndex: 10,
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          if (!isPanelResizing) {
            (e.currentTarget as HTMLElement).style.background =
              "var(--io-surface-elevated)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isPanelResizing) {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }
        }}
      />
    </div>
  );
}
