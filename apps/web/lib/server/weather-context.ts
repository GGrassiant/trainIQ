import { mapOpenMeteoForecast, OpenMeteoClient, unknownWeather, type WeatherLocation } from "@trainiq/weather";
import type { WeatherContext } from "@trainiq/types";

export function readWeatherLocation(): WeatherLocation {
  function coordinate(name: string, min: number, max: number): number {
    const value = process.env[name]?.trim();
    const number = Number(value);
    if (!value || !Number.isFinite(number) || number < min || number > max) {
      throw new Error(`${name} must be a number between ${min} and ${max}.`);
    }
    return number;
  }

  const latitude = coordinate("TRAINIQ_WEATHER_LATITUDE", -90, 90);
  const longitude = coordinate("TRAINIQ_WEATHER_LONGITUDE", -180, 180);
  const timeZone = process.env.TRAINIQ_WEATHER_TIMEZONE?.trim();
  if (!timeZone) throw new Error("TRAINIQ_WEATHER_TIMEZONE must be an IANA timezone.");
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    throw new Error("TRAINIQ_WEATHER_TIMEZONE must be an IANA timezone.");
  }
  return { latitude, longitude, timeZone };
}

export function mondayOfNextWeek(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(({ type }) => type === name)!.value;
  // Arithmetic on calendar dates avoids DST and the server's own timezone.
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (day === 0 ? 1 : 8 - day));
  return date.toISOString().slice(0, 10);
}

export async function buildWeatherContext(weekStartDate: string, location: WeatherLocation): Promise<WeatherContext> {
  try {
    const payload = await new OpenMeteoClient().getForecast(location);
    const { weather, diagnostics } = mapOpenMeteoForecast(payload, weekStartDate);
    if (diagnostics.length > 0) console.warn("[TrainIQ] Weather forecast diagnostics:", diagnostics);
    return weather;
  } catch (error) {
    console.warn("[TrainIQ] Weather forecast unavailable; all days are unknown:", error);
    return unknownWeather();
  }
}
