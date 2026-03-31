/**
 * Auth store unit tests.
 *
 * We test the JWT decode/hydrate logic in isolation rather than importing
 * the full auth store (which transitively loads useWebSocket.ts, which
 * accesses window.location at module load time before happy-dom is ready).
 */
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Replicate the JWT helpers from src/store/auth.ts (not exported)
// ---------------------------------------------------------------------------

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

function hydrateFromToken(token: string) {
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

// ---------------------------------------------------------------------------
// Build test JWTs
// ---------------------------------------------------------------------------

function makeJwt(payload: Record<string, unknown>): string {
  function b64url(s: string): string {
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

const validToken = makeJwt({
  sub: "user-1",
  username: "testuser",
  email: "test@io.test",
  full_name: "Test User",
  permissions: ["console:read", "reports:view"],
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const expiredToken = makeJwt({
  sub: "user-2",
  username: "old",
  email: "old@io.test",
  permissions: [],
  exp: Math.floor(Date.now() / 1000) - 3600,
});

const noExpToken = makeJwt({
  sub: "user-3",
  username: "noexp",
  email: "n@io.test",
  permissions: ["console:read"],
  // no exp field
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("decodeJwt", () => {
  it("returns null for non-JWT string", () => {
    expect(decodeJwt("not.a.jwt.at.all.extra")).toBeNull();
  });

  it("returns null for malformed payload", () => {
    // valid structure but invalid base64 payload
    expect(decodeJwt("header.!!!.sig")).toBeNull();
  });

  it("decodes a valid token and returns payload", () => {
    const payload = decodeJwt(validToken);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user-1");
    expect(payload?.username).toBe("testuser");
    expect(payload?.email).toBe("test@io.test");
  });

  it("returns permissions array from payload", () => {
    const payload = decodeJwt(validToken);
    expect(Array.isArray(payload?.permissions)).toBe(true);
    expect(payload?.permissions).toContain("console:read");
  });
});

describe("isTokenExpired", () => {
  it("returns false when exp is in the future", () => {
    const payload = decodeJwt(validToken)!;
    expect(isTokenExpired(payload)).toBe(false);
  });

  it("returns true when exp is in the past", () => {
    const payload = decodeJwt(expiredToken)!;
    expect(isTokenExpired(payload)).toBe(true);
  });

  it("returns false when exp field is absent", () => {
    const payload = decodeJwt(noExpToken)!;
    expect(isTokenExpired(payload)).toBe(false);
  });
});

describe("hydrateFromToken", () => {
  it("returns user object for a valid non-expired token", () => {
    const user = hydrateFromToken(validToken);
    expect(user).not.toBeNull();
    expect(user?.id).toBe("user-1");
    expect(user?.username).toBe("testuser");
    expect(user?.email).toBe("test@io.test");
    expect(user?.full_name).toBe("Test User");
    expect(user?.permissions).toEqual(["console:read", "reports:view"]);
  });

  it("returns null for an expired token", () => {
    expect(hydrateFromToken(expiredToken)).toBeNull();
  });

  it("returns null for a garbage string", () => {
    expect(hydrateFromToken("garbage")).toBeNull();
  });

  it("falls back to empty permissions array when permissions is missing", () => {
    const token = makeJwt({
      sub: "u",
      username: "x",
      email: "x@x",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const user = hydrateFromToken(token);
    expect(user?.permissions).toEqual([]);
  });
});
