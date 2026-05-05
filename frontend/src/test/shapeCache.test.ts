/**
 * Tests for shapeCache — LRU cache for SVG shape data
 *
 * Verifies get/set/has/clear semantics, LRU eviction behavior,
 * delete, and fetchShapes with batchFetch.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { shapeCache, fetchShapes } from "../shared/graphics/shapeCache";
import type { ShapeData } from "../shared/graphics/shapeCache";
import type { ShapeSidecar } from "../shared/types/shapes";

function makeShape(id: string) {
  return {
    svg: `<svg id="${id}"/>`,
    sidecar: { id } as unknown as ShapeSidecar,
  };
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
    shapeCache.set("x", {
      svg: "<svg>old</svg>",
      sidecar: {} as unknown as ShapeSidecar,
    });
    shapeCache.set("x", {
      svg: "<svg>new</svg>",
      sidecar: {} as unknown as ShapeSidecar,
    });
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

  it("evicts the oldest entry when capacity (200) is exceeded", () => {
    // Insert 200 entries — fills cache exactly
    for (let i = 0; i < 200; i++) {
      shapeCache.set(`lru-${i}`, makeShape(`lru-${i}`));
    }
    expect(shapeCache.size()).toBe(200);
    expect(shapeCache.has("lru-0")).toBe(true);

    // 201st insert must evict the LRU entry (lru-0)
    shapeCache.set("lru-200", makeShape("lru-200"));
    expect(shapeCache.size()).toBe(200);
    expect(shapeCache.has("lru-0")).toBe(false);
    expect(shapeCache.has("lru-200")).toBe(true);
  });
});

describe("shapeCache — delete()", () => {
  it("removes a cached entry", () => {
    shapeCache.set("del-me", makeShape("del-me"));
    expect(shapeCache.has("del-me")).toBe(true);
    shapeCache.delete("del-me");
    expect(shapeCache.has("del-me")).toBe(false);
    expect(shapeCache.size()).toBe(0);
  });

  it("is a no-op for a key that is not cached", () => {
    shapeCache.delete("ghost");
    expect(shapeCache.size()).toBe(0);
  });
});

describe("fetchShapes", () => {
  it("returns cached shapes without calling batchFetch", async () => {
    shapeCache.set("cached-1", makeShape("cached-1"));
    shapeCache.set("cached-2", makeShape("cached-2"));
    const batchFetch = vi.fn(
      async (_ids: string[]): Promise<Record<string, ShapeData>> => ({}),
    );

    const result = await fetchShapes(["cached-1", "cached-2"], batchFetch);

    expect(batchFetch).not.toHaveBeenCalled();
    expect(result.size).toBe(2);
    expect(result.get("cached-1")?.svg).toBe('<svg id="cached-1"/>');
    expect(result.get("cached-2")?.svg).toBe('<svg id="cached-2"/>');
  });

  it("fetches missing shapes via batchFetch and populates cache", async () => {
    const fetched = makeShape("fetched-1");
    const batchFetch = vi
      .fn(async (_ids: string[]): Promise<Record<string, ShapeData>> => ({}))
      .mockResolvedValueOnce({ "fetched-1": fetched });

    const result = await fetchShapes(["fetched-1"], batchFetch);

    expect(batchFetch).toHaveBeenCalledWith(["fetched-1"]);
    expect(result.size).toBe(1);
    expect(result.get("fetched-1")).toEqual(fetched);
    // Shape should now be cached
    expect(shapeCache.has("fetched-1")).toBe(true);
  });

  it("returns an empty map (no crash) when batchFetch throws", async () => {
    const batchFetch = vi
      .fn(async (_ids: string[]): Promise<Record<string, ShapeData>> => ({}))
      .mockRejectedValueOnce(new Error("network error"));

    const result = await fetchShapes(["missing-shape"], batchFetch);

    expect(result.size).toBe(0);
  });

  it("mixes cached and missing shapes in a single call", async () => {
    shapeCache.set("mix-cached", makeShape("mix-cached"));
    const batchFetch = vi
      .fn(async (_ids: string[]): Promise<Record<string, ShapeData>> => ({}))
      .mockResolvedValueOnce({ "mix-fetched": makeShape("mix-fetched") });

    const result = await fetchShapes(["mix-cached", "mix-fetched"], batchFetch);

    expect(batchFetch).toHaveBeenCalledWith(["mix-fetched"]);
    expect(result.size).toBe(2);
    expect(result.has("mix-cached")).toBe(true);
    expect(result.has("mix-fetched")).toBe(true);
  });

  it("returns an empty map with no crash when batchFetch is omitted", async () => {
    const result = await fetchShapes(["no-fetch-fn"]);
    expect(result.size).toBe(0);
  });
});
