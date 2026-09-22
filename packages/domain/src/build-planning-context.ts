import type { AthleteIdentity, PlanningContext, ScheduledWorkout, TrainingLoadContext, Workout } from "@trainiq/types";
import { buildMockPlanningContext } from "./mock-planning-context";

/**
 * Completes supplied planning data with mock defaults for development.
 * Athlete identity leaves planning sports unchanged; omitted arrays use the
 * defaults, while supplied arrays (including empty ones) are kept as-is.
 */
export function buildPlanningContextWithMockDefaults({
  trainingLoad,
  weekStartDate,
  athleteIdentity,
  workoutLibrary,
  scheduledWorkouts,
}: {
  trainingLoad: TrainingLoadContext;
  weekStartDate?: string;
  athleteIdentity?: AthleteIdentity;
  workoutLibrary?: Workout[];
  scheduledWorkouts?: ScheduledWorkout[];
}): PlanningContext {
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
