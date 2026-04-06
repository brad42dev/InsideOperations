import { useState, useCallback } from "react";

/**
 * useContextMenu — generic hook for managing context menu state.
 *
 * Stores the (x, y) coordinates of the right-click event and an optional
 * data payload. Use with the shared <ContextMenu> component.
 *
 * @example
 * const { menuState, handleContextMenu, closeMenu } = useContextMenu<MyRow>();
 *
 * return (
 *   <>
 *     <div onContextMenu={(e) => handleContextMenu(e, row)} />
 *     {menuState && (
 *       <ContextMenu
 *         x={menuState.x}
 *         y={menuState.y}
 *         items={buildItems(menuState.data)}
 *         onClose={closeMenu}
 *       />
 *     )}
 *   </>
 * );
 */

export interface ContextMenuState<T = undefined> {
  x: number;
  y: number;
  data?: T;
}

export function useContextMenu<T = undefined>() {
  const [menuState, setMenuState] = useState<ContextMenuState<T> | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, data?: T) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({ x: e.clientX, y: e.clientY, data });
  }, []);

  const closeMenu = useCallback(() => setMenuState(null), []);

  return { menuState, handleContextMenu, closeMenu };
}
