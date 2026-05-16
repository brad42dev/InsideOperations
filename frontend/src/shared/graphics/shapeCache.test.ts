import { describe, it, expect, beforeEach, vi } from "vitest";
import { shapeCache, fetchShapes } from "./shapeCache";
import type { ShapeData } from "./shapeCache";

function makeShape(svg = "<svg/>", label = "test"): ShapeData {
  return { svg, sidecar: { display_name: label } as never };
}

beforeEach(() => {
  shapeCache.clear();
});

describe("shapeCache", () => {
  it("stores and retrieves an entry", () => {
    shapeCache.set("a", makeShape("<svg>a</svg>"));
    expect(shapeCache.get("a")?.svg).toBe("<svg>a</svg>");
  });

  it("returns undefined for missing entries", () => {
    expect(shapeCache.get("missing")).toBeUndefined();
  });

  it("has() reflects presence without promoting", () => {
    expect(shapeCache.has("x")).toBe(false);
    shapeCache.set("x", makeShape());
    expect(shapeCache.has("x")).toBe(true);
  });

  it("delete() removes an entry", () => {
    shapeCache.set("del", makeShape());
    shapeCache.delete("del");
    expect(shapeCache.get("del")).toBeUndefined();
  });

  it("LRU evicts the oldest entry when capacity is exceeded", () => {
    // Fill to capacity (200) — "first" is inserted first and should be evicted
    shapeCache.set("first", makeShape("<svg>first</svg>"));
    for (let i = 0; i < 199; i++) {
      shapeCache.set(`shape-${i}`, makeShape());
    }
    // Cache is now at 200; inserting one more should evict "first"
    shapeCache.set("overflow", makeShape());
    expect(shapeCache.get("first")).toBeUndefined();
    expect(shapeCache.get("overflow")).toBeDefined();
  });

  it("get() promotes accessed entry to MRU position, preventing its eviction", () => {
    shapeCache.set("mru", makeShape("<svg>mru</svg>"));
    // Insert 199 more entries so "mru" would normally be next to evict
    for (let i = 0; i < 199; i++) {
      shapeCache.set(`shape-${i}`, makeShape());
    }
    // Promote "mru" to most-recently-used
    shapeCache.get("mru");
    // Inserting one more should now evict shape-0 (oldest after promotion)
    shapeCache.set("trigger-evict", makeShape());
    expect(shapeCache.get("mru")).toBeDefined();
    expect(shapeCache.get("shape-0")).toBeUndefined();
  });
});

describe("fetchShapes", () => {
  it("returns cached shapes without calling batchFetch", async () => {
    const shape = makeShape("<svg>cached</svg>");
    shapeCache.set("cached-id", shape);

    const batchFetch = vi.fn();
    const result = await fetchShapes(["cached-id"], batchFetch);

    expect(batchFetch).not.toHaveBeenCalled();
    expect(result.get("cached-id")?.svg).toBe("<svg>cached</svg>");
  });

  it("calls batchFetch only for missing IDs", async () => {
    shapeCache.set("hit", makeShape("<svg>hit</svg>"));

    const fetched = makeShape("<svg>fetched</svg>");
    const batchFetch = vi.fn().mockResolvedValue({ miss: fetched });

    const result = await fetchShapes(["hit", "miss"], batchFetch);

    expect(batchFetch).toHaveBeenCalledWith(["miss"]);
    expect(result.get("hit")?.svg).toBe("<svg>hit</svg>");
    expect(result.get("miss")?.svg).toBe("<svg>fetched</svg>");
  });

  it("populates the cache after a successful batchFetch", async () => {
    const fetched = makeShape("<svg>new</svg>");
    const batchFetch = vi.fn().mockResolvedValue({ "new-id": fetched });

    await fetchShapes(["new-id"], batchFetch);

    expect(shapeCache.get("new-id")?.svg).toBe("<svg>new</svg>");
  });

  it("returns empty map and does not throw when batchFetch rejects", async () => {
    const batchFetch = vi.fn().mockRejectedValue(new Error("network error"));

    const result = await fetchShapes(["missing"], batchFetch);

    expect(result.size).toBe(0);
  });

  it("skips batchFetch entirely when no IDs are missing", async () => {
    shapeCache.set("a", makeShape());
    shapeCache.set("b", makeShape());

    const batchFetch = vi.fn();
    await fetchShapes(["a", "b"], batchFetch);

    expect(batchFetch).not.toHaveBeenCalled();
  });

  it("returns empty map when batchFetch is not provided and shapes are missing", async () => {
    const result = await fetchShapes(["no-fetcher"]);
    expect(result.size).toBe(0);
  });

  it("handles empty input without calling batchFetch", async () => {
    const batchFetch = vi.fn();
    const result = await fetchShapes([], batchFetch);
    expect(batchFetch).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });
});
