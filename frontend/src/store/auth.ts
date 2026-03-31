import { create } from "zustand";
import { authApi } from "../api/auth";
import type { EulaPendingItem } from "../api/auth";
import { wsManager } from "../shared/hooks/useWebSocket";
import { publishAuthRefresh } from "../lib/broadcastSync";

const TOKEN_KEY = "io_access_token";

interface AuthUser {
  id: string;
  username: string;
  full_name: string | null;
  email: string;
  permissions: string[];
  eula_accepted?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** null = not yet fetched; [] = none pending; [...] = one or more pending */
  pendingEulas: EulaPendingItem[] | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  setEulaAccepted: (v: boolean) => void;
  setPendingEulas: (eulas: EulaPendingItem[]) => void;
  removePendingEula: (eulaType: "installer" | "end_user") => void;
}

interface JwtPayload {
  sub?: string;
  user_id?: string;
  username?: string;
  email?: string;
  full_name?: string | null;
  permissions?: string[];
  exp?: number;
  [key: string]: unknown;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Pad base64url string
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(payload: JwtPayload): boolean {
  if (!payload.exp) return false;
  return Date.now() / 1000 > payload.exp;
}

function hydrateFromToken(token: string): AuthUser | null {
  const payload = decodeJwt(token);
  if (!payload) return null;
  if (isTokenExpired(payload)) return null;
  return {
    id: (payload.sub ?? payload.user_id ?? "") as string,
    username: (payload.username ?? "") as string,
    email: (payload.email ?? "") as string,
    full_name: (payload.full_name ?? null) as string | null,
    permissions: Array.isArray(payload.permissions)
      ? (payload.permissions as string[])
      : [],
  };
}

// Hydrate initial state from localStorage
function getInitialState(): Pick<
  AuthState,
  "user" | "isAuthenticated" | "isLoading"
> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const user = hydrateFromToken(token);
      if (user) {
        return { user, isAuthenticated: true, isLoading: false };
      }
      // Expired token — remove it
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore
  }
  return { user: null, isAuthenticated: false, isLoading: false };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),
  pendingEulas: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const result = await authApi.login({ username, password });
      if (!result.success) {
        set({ isLoading: false });
        throw new Error(result.error.message);
      }
      const { access_token, user } = result.data;
      localStorage.setItem(TOKEN_KEY, access_token);

      // Decode JWT to get permissions; fall back to empty array
      const payload = decodeJwt(access_token);
      const permissions = Array.isArray(payload?.permissions)
        ? (payload!.permissions as string[])
        : [];

      set({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          permissions,
          eula_accepted: result.data.user.eula_accepted ?? false,
        },
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore errors on logout
    }
    wsManager.disconnect();
    localStorage.removeItem(TOKEN_KEY);
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      pendingEulas: null,
    });
  },

  setAccessToken: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    const user = hydrateFromToken(token);
    if (user) {
      // Preserve eula_accepted from existing state — it is not in the JWT payload
      // and wiping it would cause EulaGate to re-query on every token refresh.
      set((state) => ({
        user: { ...user, eula_accepted: state.user?.eula_accepted },
        isAuthenticated: true,
      }));
      // Propagate the refreshed token to all other open windows
      publishAuthRefresh(token);
    }
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      pendingEulas: null,
    });
  },

  setEulaAccepted: (v: boolean) =>
    set((state) => ({
      user: state.user ? { ...state.user, eula_accepted: v } : null,
    })),

  setPendingEulas: (eulas: EulaPendingItem[]) =>
    set((state) => ({
      pendingEulas: eulas,
      user: state.user
        ? { ...state.user, eula_accepted: eulas.length === 0 }
        : null,
    })),

  removePendingEula: (eulaType: "installer" | "end_user") =>
    set((state) => {
      const remaining = (state.pendingEulas ?? []).filter(
        (e) => e.eula_type !== eulaType,
      );
      return {
        pendingEulas: remaining,
        user: state.user
          ? { ...state.user, eula_accepted: remaining.length === 0 }
          : null,
      };
    }),
}));
