import { useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Show a divider line above this item */
  divider?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// ContextMenu
// ---------------------------------------------------------------------------

/**
 * A portal-based right-click context menu rendered at (x, y) in document
 * coordinates. Automatically adjusts position so it stays within the viewport.
 * Closes on click outside, Escape, or scroll.
 *
 * Keyboard navigation: Arrow Up/Down to move focus, Enter/Space to activate,
 * Escape to close.
 */
export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position to stay within viewport
  const getAdjustedPosition = useCallback(() => {
    if (!menuRef.current) return { left: x, top: y };
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (left + rect.width > vw - 8) left = vw - rect.width - 8;
    if (top + rect.height > vh - 8) top = vh - rect.height - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    return { left, top };
  }, [x, y]);

  // Close on outside click, scroll, or Escape
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!menuRef.current) return;
        const items = Array.from(
          menuRef.current.querySelectorAll<HTMLElement>(
            "[data-menu-item]:not([data-disabled])",
          ),
        );
        if (items.length === 0) return;
        const focused = document.activeElement as HTMLElement;
        const idx = items.indexOf(focused);
        if (e.key === "ArrowDown") {
          const next = idx < items.length - 1 ? items[idx + 1] : items[0];
          next?.focus();
        } else {
          const prev = idx > 0 ? items[idx - 1] : items[items.length - 1];
          prev?.focus();
        }
      }
    };
    const handleScroll = () => onClose();
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  // Focus first item on open
  useEffect(() => {
    if (!menuRef.current) return;
    const first = menuRef.current.querySelector<HTMLElement>(
      "[data-menu-item]:not([data-disabled])",
    );
    first?.focus();
  }, []);

  // Apply adjusted position after mount
  useEffect(() => {
    if (!menuRef.current) return;
    const { left, top } = getAdjustedPosition();
    menuRef.current.style.left = `${left}px`;
    menuRef.current.style.top = `${top}px`;
  }, [getAdjustedPosition]);

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 2000,
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
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, idx) => (
        <div key={idx}>
          {item.divider && idx > 0 && (
            <div
              style={{
                height: 1,
                background: "var(--io-border)",
                margin: "3px 0",
              }}
            />
          )}
          <MenuItemRow item={item} onClose={onClose} />
        </div>
      ))}
      <style>{`
        @keyframes io-context-menu-in {
          from { opacity: 0; transform: scale(0.97) translateY(-3px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
}

// ---------------------------------------------------------------------------
// MenuItemRow — a single item in the menu
// ---------------------------------------------------------------------------

function MenuItemRow({
  item,
  onClose,
}: {
  item: ContextMenuItem;
  onClose: () => void;
}) {
  const handleActivate = () => {
    if (item.disabled) return;
    onClose();
    item.onClick?.();
  };

  return (
    <div
      role="menuitem"
      tabIndex={item.disabled ? -1 : 0}
      data-menu-item
      data-disabled={item.disabled ? "" : undefined}
      aria-disabled={item.disabled}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      onMouseEnter={(e) => {
        if (!item.disabled) {
          (e.currentTarget as HTMLElement).style.background =
            "var(--io-accent-subtle)";
          (e.currentTarget as HTMLElement).focus();
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
      onFocus={(e) => {
        if (!item.disabled) {
          (e.currentTarget as HTMLElement).style.background =
            "var(--io-accent-subtle)";
        }
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        fontSize: 13,
        color: item.disabled
          ? "var(--io-text-muted)"
          : "var(--io-text-primary)",
        cursor: item.disabled ? "default" : "pointer",
        userSelect: "none",
        outline: "none",
        background: "transparent",
        opacity: item.disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {item.icon && (
        <span
          style={{
            width: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {item.icon}
        </span>
      )}
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.shortcut && (
        <kbd
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "var(--io-text-muted)",
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: 3,
            padding: "1px 4px",
            fontFamily: "inherit",
          }}
        >
          {item.shortcut}
        </kbd>
      )}
    </div>
  );
}
