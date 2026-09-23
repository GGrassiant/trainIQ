import { afterEach, describe, expect, it, vi } from "vitest";
import { unknownWeather } from "@trainiq/weather";
import { buildWeatherContext, mondayOfNextWeek, readWeatherLocation } from "./weather-context";

const location = { latitude: 45.5, longitude: -73.6, timeZone: "America/Toronto" };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("weather configuration", () => {
  function configure() {
    vi.stubEnv("TRAINIQ_WEATHER_LATITUDE", "0");
    vi.stubEnv("TRAINIQ_WEATHER_LONGITUDE", "-73.6");
    vi.stubEnv("TRAINIQ_WEATHER_TIMEZONE", "America/Toronto");
  }

  it("accepts explicit coordinates including zero and an IANA timezone", () => {
    configure();
    expect(readWeatherLocation()).toEqual({ ...location, latitude: 0 });
  });

  it.each([
    ["TRAINIQ_WEATHER_LATITUDE", ""], ["TRAINIQ_WEATHER_LATITUDE", " "],
    ["TRAINIQ_WEATHER_LATITUDE", "91"], ["TRAINIQ_WEATHER_LATITUDE", "Infinity"],
    ["TRAINIQ_WEATHER_LONGITUDE", "-181"], ["TRAINIQ_WEATHER_LONGITUDE", "east"],
    ["TRAINIQ_WEATHER_TIMEZONE", ""], ["TRAINIQ_WEATHER_TIMEZONE", "not-a-timezone"],
  ])("reports invalid configuration for %s=%s instead of guessing a location", (name, value) => {
    configure();
    vi.stubEnv(name, value);
    expect(() => readWeatherLocation()).toThrow(name);
  });
});

describe("planning week in the weather location's timezone", () => {
  it("uses local Sunday even when UTC is already Monday", () => {
    expect(mondayOfNextWeek(new Date("2026-09-28T01:00:00Z"), "America/Toronto")).toBe("2026-09-28");
    expect(mondayOfNextWeek(new Date("2026-09-28T01:00:00Z"), "Asia/Tokyo")).toBe("2026-10-05");
  });
  it.each([
    ["2026-03-08T07:30:00Z", "2026-03-09"],
    ["2026-11-01T06:30:00Z", "2026-11-02"],
    ["2025-12-31T15:00:00Z", "2026-01-05"],
  ])("handles DST and year boundaries (%s)", (now, monday) => {
    expect(mondayOfNextWeek(new Date(now), location.timeZone)).toBe(monday);
  });
});

describe("buildWeatherContext", () => {
  it.each(["network", "HTTP", "JSON", "payload"])("returns unknown with diagnostics after a %s failure", async (failure) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (failure === "network") throw new Error("Network unavailable");
      return {
        ok: failure !== "HTTP", status: 503,
        json: async () => {
          if (failure === "JSON") throw new SyntaxError("Invalid JSON");
          return null;
        },
      };
    }));
    expect(await buildWeatherContext("2026-09-28", location)).toEqual(unknownWeather());
    expect(console.warn).toHaveBeenCalled();
  });
});
