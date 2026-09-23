import { describe, expect, it } from "vitest";
import { mapOpenMeteoForecast, unknownWeather } from "./forecast";

const dates = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
function forecast(time: unknown[] = dates, codes: unknown[] = [0, 1, 2, 3, 51, 61, 80]) {
  return { daily_units: { time: "iso8601", weather_code: "wmo code" }, daily: { time, weather_code: codes } };
}

describe("mapOpenMeteoForecast", () => {
  it("rejects a planning week that does not start on Monday", () => {
    expect(() => mapOpenMeteoForecast(forecast(), "2026-09-29")).toThrow(
      new Error("The planning week must start on Monday."),
    );
  });

  it("maps local daily conditions across a month boundary", () => {
    const result = mapOpenMeteoForecast(forecast(), dates[0]);
    expect(result.diagnostics).toEqual([]);
    expect(result.weather.days).toEqual({
      monday: { condition: "clear" }, tuesday: { condition: "clouds" },
      wednesday: { condition: "clouds" }, thursday: { condition: "clouds" },
      friday: { condition: "rain" }, saturday: { condition: "rain" }, sunday: { condition: "rain" },
    });
  });

  it.each([51, 53, 55, 61, 63, 65, 80, 81, 82])("maps ordinary drizzle, rain and showers (%s) to rain", (code) => {
    expect(mapOpenMeteoForecast(forecast(dates, dates.map(() => code)), dates[0]).weather.days.monday.condition).toBe("rain");
  });

  it.each([45, 48, 56, 57, 66, 67, 71, 73, 75, 77, 85, 86, 95, 96, 99, 100])("leaves unsupported code %s unknown with a diagnostic", (code) => {
    const result = mapOpenMeteoForecast(forecast(dates, [code, 0, 0, 0, 0, 0, 0]), dates[0]);
    expect(result.weather.days.monday.condition).toBe("unknown");
    expect(result.weather.days.tuesday.condition).toBe("clear");
    expect(result.diagnostics).toEqual([{ date: dates[0], reason: `Unsupported WMO weather code ${code}.` }]);
  });

  it.each([null, undefined, -1, 1.5, NaN, Infinity, "61", {}, []])("preserves valid siblings around malformed code %j", (code) => {
    const result = mapOpenMeteoForecast(forecast(dates, [0, code, 61, 0, 0, 0, 0]), dates[0]);
    expect(result.weather.days.monday.condition).toBe("clear");
    expect(result.weather.days.tuesday.condition).toBe("unknown");
    expect(result.weather.days.wednesday.condition).toBe("rain");
    expect(result.diagnostics).toEqual([{ date: dates[1], reason: "Missing or invalid weather code." }]);
  });

  it.each([null, [], {}, { daily: [] }, { daily_units: { time: "unixtime", weather_code: "wmo code" }, daily: { time: dates, weather_code: [0] } }])("returns unknown for an unusable envelope %j", (payload) => {
    const result = mapOpenMeteoForecast(payload, dates[0]);
    expect(result.weather).toEqual(unknownWeather());
    expect(result.diagnostics).not.toHaveLength(0);
  });

  it("does not shift conditions when the parallel arrays are misaligned", () => {
    const result = mapOpenMeteoForecast(forecast(dates, [61]), dates[0]);
    expect(result.weather).toEqual(unknownWeather());
    expect(result.diagnostics[0].reason).toContain("Misaligned");
  });

  it.each(["2026-02-29", "2026-09-31", "2026-9-29", "2026-09-29T00:00:00", null, {}])("rejects invalid local date %j without losing siblings", (date) => {
    const result = mapOpenMeteoForecast(forecast([dates[0], date, dates[2]], [0, 61, 61]), dates[0]);
    expect(result.weather.days.monday.condition).toBe("clear");
    expect(result.weather.days.tuesday.condition).toBe("unknown");
    expect(result.weather.days.wednesday.condition).toBe("rain");
    expect(result.diagnostics.some(({ reason }) => reason.includes("Invalid forecast date"))).toBe(true);
  });

  it("accepts February 29 in a leap year", () => {
    const result = mapOpenMeteoForecast(forecast(["2028-02-29"], [61]), "2028-02-28");
    expect(result.weather.days.tuesday.condition).toBe("rain");
    expect(result.diagnostics.some(({ date }) => date === "2028-02-29")).toBe(false);
  });

  it("aligns by full dates regardless of ordering, across New Year and DST weeks", () => {
    expect(mapOpenMeteoForecast(forecast(["2026-01-04", "2025-12-29"], [61, 0]), "2025-12-29").weather.days.sunday.condition).toBe("rain");
    expect(mapOpenMeteoForecast(forecast(["2026-11-01", "2026-10-26"], [61, 0]), "2026-10-26").weather.days.sunday.condition).toBe("rain");
  });

  it("does not reuse another week's weekdays when the forecast horizon misses the target week", () => {
    const result = mapOpenMeteoForecast(forecast(), "2026-10-05");
    expect(result.weather).toEqual(unknownWeather());
    expect(result.diagnostics).toHaveLength(7);
  });

  it("leaves empty forecasts unknown and diagnoses each missing date", () => {
    const result = mapOpenMeteoForecast(forecast([], []), dates[0]);
    expect(result.weather).toEqual(unknownWeather());
    expect(result.diagnostics.map(({ date }) => date)).toEqual(dates);
  });

  it("leaves a duplicated date unknown rather than selecting an arbitrary forecast", () => {
    const result = mapOpenMeteoForecast(forecast([dates[0], dates[0], dates[0], dates[1]], [0, 61, 0, 61]), dates[0]);
    expect(result.weather.days.monday.condition).toBe("unknown");
    expect(result.weather.days.tuesday.condition).toBe("rain");
    expect(result.diagnostics.some(({ reason }) => reason === "Duplicate forecast date.")).toBe(true);
  });
});
