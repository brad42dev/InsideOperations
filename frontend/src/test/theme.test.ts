import { describe, it, expect, beforeEach } from "vitest";
import { initTheme, setTheme } from "../shared/theme/tokens";

const THEME_KEY = "io_theme";

beforeEach(() => {
  localStorage.clear();
  // Reset data-theme attribute
  document.documentElement.removeAttribute("data-theme");
});

describe("initTheme", () => {
  it("defaults to dark when no localStorage preference is set on desktop", () => {
    // In test env, navigator.userAgent does not contain mobile keywords
    const theme = initTheme();
    expect(theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it('returns stored theme when localStorage has "light"', () => {
    localStorage.setItem(THEME_KEY, "light");
    const theme = initTheme();
    expect(theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it('returns stored theme when localStorage has "hphmi"', () => {
    localStorage.setItem(THEME_KEY, "hphmi");
    const theme = initTheme();
    expect(theme).toBe("hphmi");
    expect(document.documentElement.getAttribute("data-theme")).toBe("hphmi");
  });

  it("ignores invalid stored values and falls back to default", () => {
    localStorage.setItem(THEME_KEY, "invalid-theme");
    const theme = initTheme();
    // Falls back to dark on desktop
    expect(theme).toBe("dark");
  });
});

describe("setTheme", () => {
  it("persists theme to localStorage", () => {
    setTheme("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("updates data-theme attribute on documentElement", () => {
    setTheme("hphmi");
    expect(document.documentElement.getAttribute("data-theme")).toBe("hphmi");
  });

  it("roundtrips dark theme", () => {
    setTheme("light");
    setTheme("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
