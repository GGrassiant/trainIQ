import type { AthleteIdentity, PlanningContext, TrainingLoadContext, Workout } from "@trainiq/types";
import { buildMockPlanningContext } from "./mock-planning-context";

/**
 * Builds a PlanningContext with real training-load data (e.g. derived from
 * Intervals.icu wellness + activities) standing in for the mock training
 * load, optionally a real athlete identity (id + name) standing in for the
 * mock one, and optionally a real workout library standing in for the mock
 * library. `athlete.sports`, goals, availability, and weather remain
 * TrainIQ-owned mock data for now (see the README's development progress
 * table) — `athleteIdentity` only ever overrides `id`/`name`, never
 * `sports`. When `workoutLibrary` is omitted the mock library is kept; when
 * it is given it is used as-is, even if empty (an empty library is
 * represented by planWeek() as unresolved days, never silently replaced).
 *
 * planWeek() consumes the result exactly as it would buildMockPlanningContext()'s
 * — this function, and this package, have no idea Intervals.icu exists.
 */
export function buildPlanningContextWithTrainingLoad(
  trainingLoad: TrainingLoadContext,
  weekStartDate?: string,
  athleteIdentity?: AthleteIdentity,
  workoutLibrary?: Workout[],
): PlanningContext {
  const context = buildMockPlanningContext();
  return {
    ...context,
    weekStartDate: weekStartDate ?? context.weekStartDate,
    trainingLoad,
    athlete: athleteIdentity ? { ...context.athlete, ...athleteIdentity } : context.athlete,
    workoutLibrary: workoutLibrary ?? context.workoutLibrary,
  };
}
