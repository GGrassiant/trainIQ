export interface WeatherLocation {
  latitude: number;
  longitude: number;
  timeZone: string;
}

export class OpenMeteoClient {
  async getForecast(location: WeatherLocation): Promise<unknown> {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      timezone: location.timeZone,
      daily: "weather_code",
      timeformat: "iso8601",
      // Planning next Monday–Sunday can require more than the default seven days.
      forecast_days: "16",
    }).toString();

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`Open-Meteo forecast request failed (HTTP ${response.status}).`);
    }
    return response.json();
  }
}
