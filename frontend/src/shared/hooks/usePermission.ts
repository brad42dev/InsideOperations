/**
 * usePermission.ts
 *
 * Hook for RBAC permission checks in the frontend.
 * Reads from the auth store's `user.permissions` array (populated from JWT claims).
 *
 * Usage:
 *   const canWrite = usePermission('designer:write')
 *   const { canRead, canWrite, canPublish } = useDesignerPermissions()
 */

import { useAuthStore } from "../../store/auth";

/**
 * Returns true if the current user has the specified permission.
 * Returns false if not authenticated or permission is absent.
 */
export function usePermission(permission: string): boolean {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  return permissions.includes(permission);
}

/**
 * Returns true if the user has ANY of the given permissions.
 */
export function useAnyPermission(perms: string[]): boolean {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  return perms.some((p) => permissions.includes(p));
}

/**
 * Returns true if the user has ALL of the given permissions.
 */
export function useAllPermissions(perms: string[]): boolean {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  return perms.every((p) => permissions.includes(p));
}

// ── Module-level check (outside React, for use in callbacks/effects) ──────────

/**
 * Check a permission outside of a React component.
 * Reads the current store state directly.
 */
export function hasPermission(permission: string): boolean {
  const user = useAuthStore.getState().user;
  return user?.permissions.includes(permission) ?? false;
}

// ── Designer module convenience hook ──────────────────────────────────────────

export interface DesignerPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canImport: boolean;
  canExport: boolean;
  isAdmin: boolean;
}

export function useDesignerPermissions(): DesignerPermissions {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  const has = (p: string) => permissions.includes(p);
  return {
    canRead: has("designer:read"),
    canWrite: has("designer:write"),
    canDelete: has("designer:delete"),
    canPublish: has("designer:publish"),
    canImport: has("designer:import"),
    canExport: has("designer:export"),
    isAdmin: has("designer:admin"),
  };
}
