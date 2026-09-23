import "server-only";
import { planWeek } from "@trainiq/recommendation";
import type { WeeklyPlan } from "@trainiq/types";
import { buildServerPlanningContext } from "./planning-context";

export async function generateWeeklyPlan(now: Date): Promise<WeeklyPlan> {
  const context = await buildServerPlanningContext(now);
  return planWeek(context);
}
