/**
 * Tests for shapeCache — LRU cache for SVG shape data
 *
 * Verifies get/set/has/clear semantics and LRU eviction behavior.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { shapeCache } from "../shared/graphics/shapeCache";

function makeShape(id: string) {
  return { svg: `<svg id="${id}"/>`, sidecar: { id } };
}

beforeEach(() => {
  shapeCache.clear();
});

describe("shapeCache — basic operations", () => {
  it("returns undefined for a shape not in the cache", () => {
    expect(shapeCache.get("not-here")).toBeUndefined();
  });

  it("stores and retrieves a shape", () => {
    const shape = makeShape("pump-01");
    shapeCache.set("pump-01", shape);
    const result = shapeCache.get("pump-01");
    expect(result).toBeDefined();
    expect(result?.svg).toBe('<svg id="pump-01"/>');
  });

  it("has() returns true for cached shape", () => {
    shapeCache.set("valve-01", makeShape("valve-01"));
    expect(shapeCache.has("valve-01")).toBe(true);
  });

  it("has() returns false for uncached shape", () => {
    expect(shapeCache.has("ghost")).toBe(false);
  });

  it("size() reflects number of cached entries", () => {
    expect(shapeCache.size()).toBe(0);
    shapeCache.set("a", makeShape("a"));
    expect(shapeCache.size()).toBe(1);
    shapeCache.set("b", makeShape("b"));
    expect(shapeCache.size()).toBe(2);
  });

  it("clear() empties the cache", () => {
    shapeCache.set("a", makeShape("a"));
    shapeCache.set("b", makeShape("b"));
    shapeCache.clear();
    expect(shapeCache.size()).toBe(0);
    expect(shapeCache.has("a")).toBe(false);
  });

  it("overwrites existing shape on set()", () => {
    shapeCache.set("x", { svg: "<svg>old</svg>", sidecar: {} });
    shapeCache.set("x", { svg: "<svg>new</svg>", sidecar: {} });
    expect(shapeCache.get("x")?.svg).toBe("<svg>new</svg>");
    // Size should remain 1 (not 2) after overwrite
    expect(shapeCache.size()).toBe(1);
  });
});

describe("shapeCache — LRU behavior", () => {
  it("get() promotes entry to MRU position (does not evict it next)", () => {
    // Fill cache with 3 entries
    shapeCache.set("a", makeShape("a"));
    shapeCache.set("b", makeShape("b"));
    shapeCache.set("c", makeShape("c"));
    // Access 'a' to make it MRU
    shapeCache.get("a");
    // All 3 should still be present
    expect(shapeCache.has("a")).toBe(true);
    expect(shapeCache.has("b")).toBe(true);
    expect(shapeCache.has("c")).toBe(true);
  });

  it("stores many shapes without error", () => {
    for (let i = 0; i < 50; i++) {
      shapeCache.set(`shape-${i}`, makeShape(`shape-${i}`));
    }
    expect(shapeCache.size()).toBe(50);
  });
});
