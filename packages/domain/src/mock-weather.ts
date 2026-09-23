import type { WeatherContext } from "@trainiq/types";

/**
 * A generally favorable week. The recommendation engine's weather-downgrade
 * rule for outdoor cycling (see plan-intensity.ts) is exercised in tests
 * with an overridden, rainy forecast rather than in this default mock, so
 * the default plan clearly shows the normal goal-driven session mix.
 */
export const mockWeather: WeatherContext = {
  days: {
    monday: { condition: "clear" },
    tuesday: { condition: "clouds" },
    wednesday: { condition: "clouds" },
    thursday: { condition: "clear" },
    friday: { condition: "wind" },
    saturday: { condition: "clear" },
    sunday: { condition: "clear" },
  },
};
