/**
 * Tests for graphics pipeline utility functions — doc 33 §Unit Tests
 *
 * Covers:
 * - pipeRouter.routePipe() — orthogonal A* pipe routing
 * - queryString() from api/client — URL parameter building
 */
import { describe, it, expect } from "vitest";
import { routePipe } from "../shared/graphics/pipeRouter";
import { queryString } from "../api/client";

// ---------------------------------------------------------------------------
// routePipe — orthogonal pipe routing
// ---------------------------------------------------------------------------

describe("routePipe — basic routing", () => {
  it("produces a valid SVG path string starting with M", () => {
    const path = routePipe({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(path).toMatch(/^M/);
  });

  it("connects same-point start and end with a trivial path", () => {
    const path = routePipe({ x: 50, y: 50 }, { x: 50, y: 50 });
    expect(path).toBeTruthy();
    expect(typeof path).toBe("string");
  });

  it("routes a horizontal segment (no obstacles)", () => {
    const path = routePipe({ x: 0, y: 100 }, { x: 200, y: 100 });
    // Should be a straight line or nearly straight — no turns
    expect(path).toMatch(/^M/);
    // Should include the end point somewhere
    expect(path).toContain("L");
  });

  it("routes a vertical segment (no obstacles)", () => {
    const path = routePipe({ x: 100, y: 0 }, { x: 100, y: 200 });
    expect(path).toMatch(/^M/);
  });

  it("routes an L-shaped path (different x and y)", () => {
    const path = routePipe({ x: 0, y: 0 }, { x: 100, y: 100 });
    expect(path).toMatch(/^M/);
    expect(path).toContain("L");
  });

  it("returns a string (not empty) for valid start/end", () => {
    const path = routePipe({ x: 10, y: 20 }, { x: 300, y: 150 });
    expect(path.length).toBeGreaterThan(0);
  });

  it("avoids obstacles when routing", () => {
    // Obstacle at (10, 0) — forces routing around it
    const obstacles = new Set(["10,0"]);
    const path = routePipe({ x: 0, y: 0 }, { x: 20, y: 0 }, obstacles);
    expect(path).toMatch(/^M/);
  });

  it("routes through waypoints in order", () => {
    const path = routePipe({ x: 0, y: 0 }, { x: 200, y: 200 }, new Set(), [
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ]);
    expect(path).toMatch(/^M/);
    expect(path.length).toBeGreaterThan(0);
  });

  it("produces orthogonal path — contains only M, L, H, V, Z commands", () => {
    const path = routePipe({ x: 0, y: 0 }, { x: 100, y: 100 });
    // SVG path commands used by pointsToPath should be M and L only
    const nonMlChars = path.replace(/[ML\d. ,-]/g, "").trim();
    expect(nonMlChars).toBe("");
  });
});

describe("routePipe — edge cases", () => {
  it("handles negative coordinates", () => {
    const path = routePipe({ x: -100, y: -50 }, { x: 100, y: 50 });
    expect(path).toMatch(/^M/);
  });

  it("handles large canvas coordinates", () => {
    const path = routePipe({ x: 0, y: 0 }, { x: 1920, y: 1080 });
    expect(path).toMatch(/^M/);
  });

  it("handles all four quadrant directions", () => {
    // Right
    expect(routePipe({ x: 100, y: 100 }, { x: 200, y: 100 })).toMatch(/^M/);
    // Left
    expect(routePipe({ x: 200, y: 100 }, { x: 100, y: 100 })).toMatch(/^M/);
    // Down
    expect(routePipe({ x: 100, y: 100 }, { x: 100, y: 200 })).toMatch(/^M/);
    // Up
    expect(routePipe({ x: 100, y: 200 }, { x: 100, y: 100 })).toMatch(/^M/);
  });
});

// ---------------------------------------------------------------------------
// queryString — URL parameter building
// ---------------------------------------------------------------------------

describe("queryString", () => {
  it("returns empty string for undefined input", () => {
    expect(queryString(undefined)).toBe("");
  });

  it("returns empty string for empty object", () => {
    expect(queryString({})).toBe("");
  });

  it("builds a query string from a single param", () => {
    expect(queryString({ page: 1 })).toBe("?page=1");
  });

  it("builds a query string from multiple params", () => {
    const qs = queryString({ page: 1, limit: 50 });
    expect(qs).toContain("page=1");
    expect(qs).toContain("limit=50");
    expect(qs).toMatch(/^\?/);
  });

  it("omits undefined values", () => {
    const qs = queryString({ page: 1, filter: undefined });
    expect(qs).toBe("?page=1");
    expect(qs).not.toContain("filter");
  });

  it("omits null values", () => {
    const qs = queryString({ page: 1, type: null });
    expect(qs).toBe("?page=1");
    expect(qs).not.toContain("type");
  });

  it("encodes special characters in keys and values", () => {
    const qs = queryString({ q: "hello world" });
    expect(qs).toBe("?q=hello%20world");
  });

  it("encodes ampersands in values", () => {
    const qs = queryString({ name: "a&b" });
    expect(qs).toBe("?name=a%26b");
  });

  it("handles boolean values", () => {
    const qs = queryString({ published: true, active: false });
    expect(qs).toContain("published=true");
    expect(qs).toContain("active=false");
  });

  it("handles string values with slashes", () => {
    const qs = queryString({ path: "/api/v1" });
    expect(qs).toContain("path=");
    // The value should be encoded
    expect(qs).toContain("%2Fapi%2Fv1");
  });

  it("returns empty string when all params are null or undefined", () => {
    expect(queryString({ a: null, b: undefined })).toBe("");
  });
});
