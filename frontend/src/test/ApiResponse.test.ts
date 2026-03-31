import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./server";
import { api } from "../api/client";

// The api client uses import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
// In tests, import.meta.env.VITE_API_URL is undefined, so the base URL is
// 'http://localhost:3000'. MSW intercepts at the path level — we need full URL
// handlers here since api client uses absolute URLs.

const BASE = "http://localhost:3000";

describe("api client — successful responses", () => {
  it("returns success:true with data on a 200 response", async () => {
    server.use(
      http.get(`${BASE}/api/test/item`, () =>
        HttpResponse.json({ success: true, data: { id: "123" } }),
      ),
    );
    const result = await api.get<{ id: string }>("/api/test/item");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("123");
    }
  });

  it("handles POST with body and returns data", async () => {
    server.use(
      http.post(`${BASE}/api/test/create`, () =>
        HttpResponse.json({ success: true, data: { created: true } }),
      ),
    );
    const result = await api.post<{ created: boolean }>("/api/test/create", {
      name: "test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created).toBe(true);
    }
  });
});

describe("api client — 401 and auth refresh", () => {
  beforeEach(() => {
    // Clear any token so refresh returns null quickly
    localStorage.removeItem("io_access_token");
    // Replace window.location with a plain object so assignments don't trigger
    // happy-dom navigation (which throws / swallows the return value).
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "/", assign: vi.fn(), replace: vi.fn() },
    });
  });

  it("returns UNAUTHORIZED error when 401 and refresh fails", async () => {
    server.use(
      http.get(
        `${BASE}/api/test/protected`,
        () => new HttpResponse(null, { status: 401 }),
      ),
      http.post(
        `${BASE}/api/auth/refresh`,
        () => new HttpResponse(null, { status: 401 }),
      ),
    );

    const result = await api.get("/api/test/protected");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("api client — error responses", () => {
  it("returns success:false on a 404", async () => {
    server.use(
      http.get(`${BASE}/api/test/missing`, () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "Resource not found" } },
          { status: 404 },
        ),
      ),
    );
    const result = await api.get("/api/test/missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns NETWORK_ERROR when fetch itself throws", async () => {
    // Bypass MSW and simulate a true network failure by mocking global fetch
    const originalFetch = global.fetch;
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );
    const result = await api.get("/api/test/network-fail");
    global.fetch = originalFetch;
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NETWORK_ERROR");
    }
  });
});
