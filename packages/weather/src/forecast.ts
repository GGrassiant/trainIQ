import { DAYS_OF_WEEK, type DayOfWeek, type WeatherCondition, type WeatherContext } from "@trainiq/types";
import { forecastDateSchema, openMeteoForecastSchema, weatherCodeSchema } from "./api-types";

export interface WeatherDiagnostic {
  date?: string;
  reason: string;
}

export interface WeatherMappingResult {
  weather: WeatherContext;
  diagnostics: WeatherDiagnostic[];
}

export function unknownWeather(): WeatherContext {
  return {
    days: {
      monday: { condition: "unknown" },
      tuesday: { condition: "unknown" },
      wednesday: { condition: "unknown" },
      thursday: { condition: "unknown" },
      friday: { condition: "unknown" },
      saturday: { condition: "unknown" },
      sunday: { condition: "unknown" },
    },
  };
}

function conditionFromCode(code: number): WeatherCondition {
  switch (code) {
    case 0:
      return "clear";
    case 1:
    case 2:
    case 3:
      return "clouds";
    case 51:
    case 53:
    case 55:
    case 61:
    case 63:
    case 65:
    case 80:
    case 81:
    case 82:
      return "rain";
    default:
      return "unknown";
  }
}

/** Daily WMO codes describe the most severe condition of the day, not the workout's time slot. */
export function mapOpenMeteoForecast(payload: unknown, weekStartDate: string): WeatherMappingResult {
  const start = new Date(`${forecastDateSchema.parse(weekStartDate)}T00:00:00Z`);
  if (start.getUTCDay() !== 1) throw new Error("The planning week must start on Monday.");

  const targetDays = new Map<string, DayOfWeek>(
    DAYS_OF_WEEK.map((day, offset) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + offset);
      return [date.toISOString().slice(0, 10), day];
    }),
  );

  const weather = unknownWeather();
  const diagnostics: WeatherDiagnostic[] = [];
  const parsed = openMeteoForecastSchema.safeParse(payload);
  if (!parsed.success) {
    return { weather, diagnostics: [{ reason: "Invalid Open-Meteo daily forecast payload or units; all days are unknown." }] };
  }

  const { time, weather_code: codes } = parsed.data.daily;
  if (time.length !== codes.length) {
    return { weather, diagnostics: [{ reason: "Misaligned Open-Meteo date/code arrays; all days are unknown." }] };
  }

  const seen = new Set<string>();
  for (let index = 0; index < time.length; index++) {
    const date = forecastDateSchema.safeParse(time[index]);
    if (!date.success) {
      diagnostics.push({ reason: `Invalid forecast date at index ${index}.` });
      continue;
    }
    const day = targetDays.get(date.data);
    if (!day) continue;
    if (seen.has(date.data)) {
      weather.days[day] = { condition: "unknown" };
      diagnostics.push({ date: date.data, reason: "Duplicate forecast date." });
      continue;
    }
    seen.add(date.data);

    const code = weatherCodeSchema.safeParse(codes[index]);
    if (!code.success) {
      diagnostics.push({ date: date.data, reason: "Missing or invalid weather code." });
      continue;
    }
    const condition = conditionFromCode(code.data);
    weather.days[day] = { condition };
    if (condition === "unknown") {
      diagnostics.push({ date: date.data, reason: `Unsupported WMO weather code ${code.data}.` });
    }
  }

  const missingDateDiagnostics = [...targetDays.keys()]
    .filter((date) => !seen.has(date))
    .map((date) => ({ date, reason: "No forecast for this planning date." }));
  return { weather, diagnostics: [...diagnostics, ...missingDateDiagnostics] };
}
