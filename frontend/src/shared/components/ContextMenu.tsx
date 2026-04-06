import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { ChevronRight } from "lucide-react";
import { hasPermission } from "../hooks/usePermission";

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
  /** Permission key — item is hidden if the user lacks this permission */
  permission?: string;
  /** Render in danger/red color (destructive actions) */
  danger?: boolean;
  /** Submenu items — renders a nested menu on hover/ArrowRight */
  children?: ContextMenuItem[];
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
 * Keyboard navigation: Arrow Up/Down/Home/End to move focus, Enter/Space to
 * activate, ArrowRight to open submenu, Escape to close.
 *
 * Permission gating: items with `permission` set are hidden (not disabled)
 * when the user lacks that permission. Uses hasPermission() from auth store.
 *
 * z-index: 1800 (above module content at 1000, below modals at 2000).
 */
export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter out items where user lacks permission — hide, never disable
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) => !item.permission || hasPermission(item.permission),
      ),
    [items],
  );

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

  // Close on outside click, scroll, or Escape; arrow/Home/End navigation
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Home" ||
        e.key === "End"
      ) {
        e.preventDefault();
        if (!menuRef.current) return;
        const focusableItems = Array.from(
          menuRef.current.querySelectorAll<HTMLElement>(
            "[data-menu-item]:not([data-disabled])",
          ),
        );
        if (focusableItems.length === 0) return;
        const focused = document.activeElement as HTMLElement;
        const idx = focusableItems.indexOf(focused);
        if (e.key === "ArrowDown") {
          const next =
            idx < focusableItems.length - 1
              ? focusableItems[idx + 1]
              : focusableItems[0];
          next?.focus();
        } else if (e.key === "ArrowUp") {
          const prev =
            idx > 0
              ? focusableItems[idx - 1]
              : focusableItems[focusableItems.length - 1];
          prev?.focus();
        } else if (e.key === "Home") {
          focusableItems[0]?.focus();
        } else if (e.key === "End") {
          focusableItems[focusableItems.length - 1]?.focus();
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
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {visibleItems.map((item, idx) => (
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
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
}

// ---------------------------------------------------------------------------
// MenuItemRow — a single item in the menu (with optional submenu)
// ---------------------------------------------------------------------------

function MenuItemRow({
  item,
  onClose,
}: {
  item: ContextMenuItem;
  onClose: () => void;
}) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuPos, setSubmenuPos] = useState({ x: 0, y: 0 });
  const rowRef = useRef<HTMLDivElement>(null);

  const hasSubmenu = item.children && item.children.length > 0;

  const handleActivate = () => {
    if (item.disabled) return;
    if (hasSubmenu) return; // submenu items don't fire onClick
    onClose();
    item.onClick?.();
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (item.disabled) return;
    (e.currentTarget as HTMLElement).style.background =
      "var(--io-accent-subtle)";
    (e.currentTarget as HTMLElement).focus();
    if (hasSubmenu) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setSubmenuPos({ x: rect.right - 4, y: rect.top });
      setSubmenuOpen(true);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).style.background = "transparent";
    // Don't close submenu on mouse leave — it closes when parent menu closes
  };

  const textColor = item.danger
    ? "var(--io-alarm-critical)"
    : item.disabled
      ? "var(--io-text-muted)"
      : "var(--io-text-primary)";

  return (
    <>
      <div
        ref={rowRef}
        role="menuitem"
        tabIndex={item.disabled ? -1 : 0}
        data-menu-item
        data-disabled={item.disabled ? "" : undefined}
        aria-disabled={item.disabled}
        aria-haspopup={hasSubmenu ? "menu" : undefined}
        aria-expanded={hasSubmenu ? submenuOpen : undefined}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleActivate();
          }
          if (e.key === "ArrowRight" && hasSubmenu) {
            e.preventDefault();
            if (rowRef.current) {
              const rect = rowRef.current.getBoundingClientRect();
              setSubmenuPos({ x: rect.right - 4, y: rect.top });
              setSubmenuOpen(true);
            }
          }
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
          color: textColor,
          cursor: item.disabled ? "default" : "pointer",
          userSelect: "none",
          outline: "none",
          background: "transparent",
          opacity: item.disabled ? 0.5 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {/* Icon column — always 16px wide so labels line up */}
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
          {item.icon ?? null}
        </span>
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.shortcut && !hasSubmenu && (
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
        {hasSubmenu && (
          <ChevronRight
            size={12}
            style={{ marginLeft: "auto", color: "var(--io-text-muted)" }}
          />
        )}
      </div>

      {/* Submenu — rendered as a separate ContextMenu at computed position */}
      {hasSubmenu && submenuOpen && (
        <ContextMenu
          x={submenuPos.x}
          y={submenuPos.y}
          items={item.children!}
          onClose={() => {
            setSubmenuOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
