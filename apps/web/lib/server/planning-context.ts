import type { PlanningContext } from "@trainiq/types";
import { buildPlanningContextFromIntervals } from "./intervals-planning-context";
import { buildWeatherContext, mondayOfNextWeek, readWeatherLocation } from "./weather-context";

export async function buildServerPlanningContext(now: Date): Promise<PlanningContext> {
  const location = readWeatherLocation();
  const weekStartDate = mondayOfNextWeek(now, location.timeZone);
  const [context, weather] = await Promise.all([
    buildPlanningContextFromIntervals(weekStartDate),
    buildWeatherContext(weekStartDate, location),
  ]);
  return { ...context, weather };
}
