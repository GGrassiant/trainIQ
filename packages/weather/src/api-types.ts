import { z } from "zod";

// Validate each date/code pair separately so one bad day cannot discard its siblings.
export const openMeteoForecastSchema = z.object({
  daily_units: z.object({ time: z.literal("iso8601"), weather_code: z.literal("wmo code") }),
  daily: z.object({
    time: z.array(z.unknown()),
    weather_code: z.array(z.unknown()),
  }),
});

export type OpenMeteoForecast = z.infer<typeof openMeteoForecastSchema>;

export const forecastDateSchema = z.iso.date();
export const weatherCodeSchema = z.number().int().nonnegative();
