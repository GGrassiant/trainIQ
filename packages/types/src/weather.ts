import type { DayOfWeek } from "./availability";

export type WeatherCondition = "clear" | "clouds" | "rain" | "wind" | "heat" | "cold";

export interface DayWeather {
  condition: WeatherCondition;
  temperatureC: number;
  precipitationChance: number;
}

export interface WeatherContext {
  days: Record<DayOfWeek, DayWeather>;
}
