import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// parseQuery — inlined from CommandPalette.tsx
// Tests that prefix scopes are correctly parsed from raw input.
// ---------------------------------------------------------------------------

type PrefixScope = "commands" | "users" | "routes" | "tags" | null;

interface ParsedQuery {
  scope: PrefixScope;
  term: string;
  prefix: string;
}

function parseQuery(raw: string): ParsedQuery {
  if (raw.startsWith(">"))
    return { scope: "commands", term: raw.slice(1).trimStart(), prefix: ">" };
  if (raw.startsWith("@"))
    return { scope: "users", term: raw.slice(1).trimStart(), prefix: "@" };
  if (raw.startsWith("/"))
    return { scope: "routes", term: raw.slice(1).trimStart(), prefix: "/" };
  if (raw.startsWith("#"))
    return { scope: "tags", term: raw.slice(1).trimStart(), prefix: "#" };
  return { scope: null, term: raw, prefix: "" };
}

describe("parseQuery — no prefix", () => {
  it("returns null scope for plain query", () => {
    expect(parseQuery("dashboard").scope).toBe(null);
  });

  it("returns the full string as term", () => {
    expect(parseQuery("alarm list").term).toBe("alarm list");
  });

  it("returns empty prefix", () => {
    expect(parseQuery("anything").prefix).toBe("");
  });

  it("returns null scope for empty string", () => {
    const r = parseQuery("");
    expect(r.scope).toBe(null);
    expect(r.term).toBe("");
  });
});

describe("parseQuery — > commands prefix", () => {
  it("returns commands scope", () => {
    expect(parseQuery(">console").scope).toBe("commands");
  });

  it("strips the prefix from term", () => {
    expect(parseQuery(">console").term).toBe("console");
  });

  it("trims leading whitespace from term", () => {
    expect(parseQuery("> console").term).toBe("console");
  });

  it("returns empty term when only prefix is typed", () => {
    expect(parseQuery(">").term).toBe("");
  });

  it("returns prefix as >", () => {
    expect(parseQuery(">anything").prefix).toBe(">");
  });
});

describe("parseQuery — @ users prefix", () => {
  it("returns users scope", () => {
    expect(parseQuery("@john").scope).toBe("users");
  });

  it("strips the prefix from term", () => {
    expect(parseQuery("@john doe").term).toBe("john doe");
  });

  it("handles space after prefix", () => {
    expect(parseQuery("@ john").term).toBe("john");
  });
});

describe("parseQuery — / routes prefix", () => {
  it("returns routes scope", () => {
    expect(parseQuery("/settings").scope).toBe("routes");
  });

  it("strips the prefix from term", () => {
    expect(parseQuery("/settings/users").term).toBe("settings/users");
  });
});

describe("parseQuery — # tags prefix", () => {
  it("returns tags scope", () => {
    expect(parseQuery("#FIC-101").scope).toBe("tags");
  });

  it("strips the prefix from term", () => {
    expect(parseQuery("#FIC-101").term).toBe("FIC-101");
  });

  it("handles space after prefix", () => {
    expect(parseQuery("# pump").term).toBe("pump");
  });
});

// ---------------------------------------------------------------------------
// toAlarmRow — inlined from AlarmListPane.tsx
// Tests the adapter that maps API alarm shapes to UI display rows.
// ---------------------------------------------------------------------------

type AlarmPriority = "critical" | "high" | "medium" | "low";
type AlarmState = "active" | "unacknowledged" | "acknowledged";

interface AlarmRow {
  id: string;
  priority: AlarmPriority;
  tag: string;
  message: string;
  time: string;
  state: AlarmState;
}

interface ApiAlarm {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  source: string;
  state: string;
  triggered_at: string;
  acknowledged_at?: string | null;
  tag?: string;
  message?: string;
}

function toAlarmRow(a: ApiAlarm): AlarmRow {
  const priority: AlarmPriority =
    a.severity === "info" ? "low" : (a.severity as AlarmPriority);
  const state: AlarmState = a.acknowledged_at
    ? "acknowledged"
    : a.state === "active"
      ? "active"
      : "unacknowledged";
  const ts = new Date(a.triggered_at);
  return {
    id: a.id,
    priority,
    tag: a.tag ?? a.source,
    message: a.message ?? a.title,
    time: ts.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    state,
  };
}

const BASE_ALARM: ApiAlarm = {
  id: "alarm-1",
  title: "High pressure",
  severity: "critical",
  source: "FIC-101",
  state: "active",
  triggered_at: "2026-03-18T10:00:00.000Z",
  acknowledged_at: null,
};

describe("toAlarmRow — priority mapping", () => {
  it("maps critical severity to critical priority", () => {
    expect(toAlarmRow({ ...BASE_ALARM, severity: "critical" }).priority).toBe(
      "critical",
    );
  });

  it("maps high severity to high priority", () => {
    expect(toAlarmRow({ ...BASE_ALARM, severity: "high" }).priority).toBe(
      "high",
    );
  });

  it("maps medium severity to medium priority", () => {
    expect(toAlarmRow({ ...BASE_ALARM, severity: "medium" }).priority).toBe(
      "medium",
    );
  });

  it("maps low severity to low priority", () => {
    expect(toAlarmRow({ ...BASE_ALARM, severity: "low" }).priority).toBe("low");
  });

  it("maps info severity to low priority", () => {
    expect(toAlarmRow({ ...BASE_ALARM, severity: "info" }).priority).toBe(
      "low",
    );
  });
});

describe("toAlarmRow — state mapping", () => {
  it("maps active + no ack to active state", () => {
    expect(
      toAlarmRow({ ...BASE_ALARM, state: "active", acknowledged_at: null })
        .state,
    ).toBe("active");
  });

  it("maps non-active + no ack to unacknowledged", () => {
    expect(
      toAlarmRow({ ...BASE_ALARM, state: "resolved", acknowledged_at: null })
        .state,
    ).toBe("unacknowledged");
  });

  it("maps acknowledged_at present to acknowledged state", () => {
    expect(
      toAlarmRow({ ...BASE_ALARM, acknowledged_at: "2026-03-18T10:05:00.000Z" })
        .state,
    ).toBe("acknowledged");
  });

  it("acknowledged takes priority over active state", () => {
    expect(
      toAlarmRow({
        ...BASE_ALARM,
        state: "active",
        acknowledged_at: "2026-03-18T10:05:00.000Z",
      }).state,
    ).toBe("acknowledged");
  });
});

describe("toAlarmRow — tag and message fallbacks", () => {
  it("uses tag field when provided", () => {
    expect(toAlarmRow({ ...BASE_ALARM, tag: "FIC-202" }).tag).toBe("FIC-202");
  });

  it("falls back to source when tag is absent", () => {
    expect(toAlarmRow({ ...BASE_ALARM, tag: undefined }).tag).toBe("FIC-101");
  });

  it("uses message field when provided", () => {
    expect(
      toAlarmRow({ ...BASE_ALARM, message: "Override message" }).message,
    ).toBe("Override message");
  });

  it("falls back to title when message is absent", () => {
    expect(toAlarmRow({ ...BASE_ALARM, message: undefined }).message).toBe(
      "High pressure",
    );
  });

  it("preserves the alarm id", () => {
    expect(toAlarmRow(BASE_ALARM).id).toBe("alarm-1");
  });
});

// ---------------------------------------------------------------------------
// relativeTime — inlined from DesignerGraphicsList.tsx
// Tests relative time formatting for graphic card "last updated" display.
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "unknown";
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo} month${diffMo !== 1 ? "s" : ""} ago`;
  const diffYr = Math.floor(diffMo / 12);
  return `${diffYr} year${diffYr !== 1 ? "s" : ""} ago`;
}

describe("relativeTime", () => {
  it('returns "unknown" for invalid ISO string', () => {
    expect(relativeTime("not-a-date")).toBe("unknown");
  });

  it('returns "just now" for a timestamp 30 seconds ago', () => {
    const iso = new Date(Date.now() - 30_000).toISOString();
    expect(relativeTime(iso)).toBe("just now");
  });

  it('returns "1 minute ago" for 90 seconds ago', () => {
    const iso = new Date(Date.now() - 90_000).toISOString();
    expect(relativeTime(iso)).toBe("1 minute ago");
  });

  it('returns "2 minutes ago" for 2.5 minutes ago', () => {
    const iso = new Date(Date.now() - 150_000).toISOString();
    expect(relativeTime(iso)).toBe("2 minutes ago");
  });

  it('returns "1 hour ago" for 90 minutes ago', () => {
    const iso = new Date(Date.now() - 90 * 60_000).toISOString();
    expect(relativeTime(iso)).toBe("1 hour ago");
  });

  it('returns "2 hours ago" for 2.5 hours ago', () => {
    const iso = new Date(Date.now() - 150 * 60_000).toISOString();
    expect(relativeTime(iso)).toBe("2 hours ago");
  });

  it('returns "1 day ago" for 36 hours ago', () => {
    const iso = new Date(Date.now() - 36 * 3600_000).toISOString();
    expect(relativeTime(iso)).toBe("1 day ago");
  });

  it('returns "5 days ago" for 5 days ago', () => {
    const iso = new Date(Date.now() - 5 * 24 * 3600_000).toISOString();
    expect(relativeTime(iso)).toBe("5 days ago");
  });

  it('returns "1 month ago" for 35 days ago', () => {
    const iso = new Date(Date.now() - 35 * 24 * 3600_000).toISOString();
    expect(relativeTime(iso)).toBe("1 month ago");
  });

  it('returns "1 year ago" for 400 days ago', () => {
    const iso = new Date(Date.now() - 400 * 24 * 3600_000).toISOString();
    expect(relativeTime(iso)).toBe("1 year ago");
  });
});
