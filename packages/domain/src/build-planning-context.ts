import type { AthleteIdentity, PlanningContext, ScheduledWorkout, TrainingLoadContext, Workout } from "@trainiq/types";
import { buildMockPlanningContext } from "./mock-planning-context";

/**
 * Builds a PlanningContext with real training-load data (e.g. derived from
 * Intervals.icu wellness + activities) standing in for the mock training
 * load, optionally a real athlete identity (id + name) standing in for the
 * mock one, optionally a real workout library standing in for the mock
 * library, and optionally real scheduled workouts standing in for the mock
 * (empty) ones. `athlete.sports`, goals, availability, and weather remain
 * TrainIQ-owned mock data for now (see the README's development progress
 * table) — `athleteIdentity` only ever overrides `id`/`name`, never
 * `sports`. When `workoutLibrary`/`scheduledWorkouts` is omitted the mock
 * value is kept; when given, it's used as-is, even if empty (an empty
 * library is represented by planWeek() as unresolved days, never silently
 * replaced; scheduledWorkouts is part of the resulting PlanningContext like
 * any other field, but planWeek() does not currently read it).
 *
 * planWeek() consumes the result exactly as it would buildMockPlanningContext()'s
 * — this function, and this package, have no idea Intervals.icu exists.
 */
export function buildPlanningContextWithTrainingLoad(
  trainingLoad: TrainingLoadContext,
  weekStartDate?: string,
  athleteIdentity?: AthleteIdentity,
  workoutLibrary?: Workout[],
  scheduledWorkouts?: ScheduledWorkout[],
): PlanningContext {
  const context = buildMockPlanningContext();
  return {
    ...context,
    weekStartDate: weekStartDate ?? context.weekStartDate,
    trainingLoad,
    athlete: athleteIdentity ? { ...context.athlete, ...athleteIdentity } : context.athlete,
    workoutLibrary: workoutLibrary ?? context.workoutLibrary,
    scheduledWorkouts: scheduledWorkouts ?? context.scheduledWorkouts,
  };
}
