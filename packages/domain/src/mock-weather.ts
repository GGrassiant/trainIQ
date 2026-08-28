import type { WeatherContext } from "@trainiq/types";

/**
 * A generally favorable week. The recommendation engine's weather-downgrade
 * rule for outdoor cycling (see plan-intensity.ts) is exercised in tests
 * with an overridden, rainy forecast rather than in this default mock, so
 * the default plan clearly shows the normal goal-driven session mix.
 */
export const mockWeather: WeatherContext = {
  days: {
    monday: { condition: "clear", temperatureC: 24, precipitationChance: 0.05 },
    tuesday: { condition: "clouds", temperatureC: 19, precipitationChance: 0.2 },
    wednesday: { condition: "clouds", temperatureC: 21, precipitationChance: 0.15 },
    thursday: { condition: "clear", temperatureC: 23, precipitationChance: 0.1 },
    friday: { condition: "wind", temperatureC: 20, precipitationChance: 0.15 },
    saturday: { condition: "clear", temperatureC: 23, precipitationChance: 0.1 },
    sunday: { condition: "clear", temperatureC: 27, precipitationChance: 0.05 },
  },
};
