import { vi } from "vitest";

export function stubProviders(weatherUnavailable = false) {
  vi.stubEnv("INTERVALS_API_KEY", "test-key");
  vi.stubEnv("TRAINIQ_WEATHER_LATITUDE", "45.5");
  vi.stubEnv("TRAINIQ_WEATHER_LONGITUDE", "-73.6");
  vi.stubEnv("TRAINIQ_WEATHER_TIMEZONE", "America/Toronto");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const responses: Record<string, unknown> = {
    "/api/v1/athlete/0": { id: "i123", name: "Jamie" },
    "/api/v1/athlete/0/wellness": [{ id: "2026-09-27", ctl: 60, atl: 55 }],
    "/api/v1/athlete/0/activities": [],
    "/api/v1/athlete/0/workouts": [],
    "/api/v1/athlete/0/events.json": [],
    "/v1/forecast": {
      daily_units: { time: "iso8601", weather_code: "wmo code" },
      daily: { time: ["2026-09-21", "2026-09-28", "2026-10-04"], weather_code: [0, 61, 3] },
    },
  };
  const fetchMock = vi.fn(async (input: URL | string) => {
    const url = new URL(input);
    if (url.hostname === "api.open-meteo.com" && weatherUnavailable) throw new Error("Forecast unavailable");
    const body = responses[url.pathname];
    if (body === undefined) throw new Error(`Unexpected request: ${url.pathname}`);
    return { ok: true, json: async () => body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
