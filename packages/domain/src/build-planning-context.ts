import type { AthleteIdentity, PlanningContext, TrainingLoadContext } from "@trainiq/types";
import { buildMockPlanningContext } from "./mock-planning-context";

/**
 * Builds a PlanningContext with real training-load data (e.g. derived from
 * Intervals.icu wellness + activities) standing in for the mock training
 * load, and optionally a real athlete identity (id + name) standing in for
 * the mock one. `athlete.sports`, goals, availability, weather, and the
 * workout library remain TrainIQ-owned mock data for now (see V0.3 scope in
 * the README) — `athleteIdentity` only ever overrides `id`/`name`, never
 * `sports`.
 *
 * planWeek() consumes the result exactly as it would buildMockPlanningContext()'s
 * — this function, and this package, have no idea Intervals.icu exists.
 */
export function buildPlanningContextWithTrainingLoad(
  trainingLoad: TrainingLoadContext,
  weekStartDate?: string,
  athleteIdentity?: AthleteIdentity,
): PlanningContext {
  const context = buildMockPlanningContext();
  return {
    ...context,
    weekStartDate: weekStartDate ?? context.weekStartDate,
    trainingLoad,
    athlete: athleteIdentity ? { ...context.athlete, ...athleteIdentity } : context.athlete,
  };
}
