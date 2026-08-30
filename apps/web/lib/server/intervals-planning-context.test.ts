import { afterEach, describe, expect, it, vi } from "vitest";
import { isIntervalsDemoRouteEnabled, mondayOfLocalWeek } from "./intervals-planning-context";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isIntervalsDemoRouteEnabled", () => {
  it("is disabled in production, so the demo route fails closed if deployed", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isIntervalsDemoRouteEnabled()).toBe(false);
  });

  it("is disabled in test", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(isIntervalsDemoRouteEnabled()).toBe(false);
  });

  it("is enabled only in local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isIntervalsDemoRouteEnabled()).toBe(true);
  });
});

describe("mondayOfLocalWeek", () => {
  it("returns the same date when given a Monday", () => {
    expect(mondayOfLocalWeek(new Date(2026, 7, 24))).toBe("2026-08-24"); // Monday
  });

  it("returns the Monday earlier in the week for a mid-week date", () => {
    expect(mondayOfLocalWeek(new Date(2026, 7, 26))).toBe("2026-08-24"); // Wednesday -> that week's Monday
  });

  it("returns the Monday of the same week for a Sunday, not the following week", () => {
    expect(mondayOfLocalWeek(new Date(2026, 7, 30))).toBe("2026-08-24"); // Sunday -> Monday that started this week
  });

  it("rolls back across a month boundary correctly", () => {
    expect(mondayOfLocalWeek(new Date(2026, 8, 1))).toBe("2026-08-31"); // Tuesday, Sep 1 2026 -> Monday, Aug 31 2026
  });
});
