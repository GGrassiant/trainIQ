import type { DayOfWeek } from "./availability";

export type WeatherCondition = "clear" | "clouds" | "rain" | "wind" | "heat" | "cold" | "unknown";

export interface DayWeather {
  condition: WeatherCondition;
}

export interface WeatherContext {
  days: Record<DayOfWeek, DayWeather>;
}
