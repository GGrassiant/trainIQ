import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenMeteoClient } from "./client";

const location = { latitude: 45.5, longitude: -73.6, timeZone: "America/Toronto" };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("OpenMeteoClient", () => {
  it("requests daily WMO codes in the configured timezone over the full upcoming week horizon", async () => {
    const payload = { daily: { time: [], weather_code: [] } };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);
    expect(await new OpenMeteoClient().getForecast(location)).toEqual(payload);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: "45.5", longitude: "-73.6", timezone: "America/Toronto",
      daily: "weather_code", timeformat: "iso8601", forecast_days: "16",
    });
  });

  it("reports HTTP failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(new OpenMeteoClient().getForecast(location)).rejects.toThrow("HTTP 429");
  });

  it("propagates a timed-out request so composition can provide unknown weather", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("Forecast timeout")), { once: true });
    })));
    const request = new OpenMeteoClient().getForecast(location);
    controller.abort();
    await expect(request).rejects.toThrow("Forecast timeout");
  });
});
