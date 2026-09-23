import { stubProviders } from "./test-support/providers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { planWeek } from "@trainiq/recommendation";
import { unknownWeather } from "@trainiq/weather";
import { buildPlanningContextFromIntervals } from "./intervals-planning-context";
import { buildServerPlanningContext } from "./planning-context";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("buildServerPlanningContext", () => {
  const now = new Date("2026-09-28T01:00:00Z"); // Still Sunday at the configured location.

  it("shares the target week with Calendar and replaces only weather in the Intervals context", async () => {
    const fetchMock = stubProviders();
    const context = await buildServerPlanningContext(now);
    const intervalsContext = await buildPlanningContextFromIntervals("2026-09-28");
    const expectedWeather = unknownWeather();
    expectedWeather.days.monday = { condition: "rain" };
    expectedWeather.days.sunday = { condition: "clouds" };
    expect(context).toEqual({ ...intervalsContext, weather: expectedWeather });
    expect(planWeek(context)).toEqual(planWeek({ ...intervalsContext, weather: expectedWeather }));
    const calendarUrls = fetchMock.mock.calls.map(([url]) => new URL(url)).filter((url) => url.pathname.endsWith("events.json"));
    expect(calendarUrls.every((url) => url.searchParams.get("oldest") === "2026-09-28" && url.searchParams.get("newest") === "2026-10-04")).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Weather"), expect.arrayContaining([
      { date: "2026-09-29", reason: "No forecast for this planning date." },
    ]));
  });

  it("still produces a complete plan if the weather provider fails, without mock fallback", async () => {
    stubProviders(true);
    const context = await buildServerPlanningContext(now);
    expect(context.weather).toEqual(unknownWeather());
    const intervalsContext = await buildPlanningContextFromIntervals("2026-09-28");
    expect(planWeek(context)).toEqual(planWeek({ ...intervalsContext, weather: unknownWeather() }));
    expect(planWeek(context).days.length).toBeGreaterThan(0);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("all days are unknown"), expect.any(Error));
  });
});
