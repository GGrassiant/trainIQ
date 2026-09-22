import type { Sport } from "./athlete";

/**
 * A workout Intervals.icu currently has scheduled for a specific calendar
 * date — what IS planned in Intervals.icu, not a TrainIQ recommendation and
 * not a fixed commitment (see `FixedCommitmentDay` in `plan.ts`). Only
 * Intervals.icu calendar events with `category: "WORKOUT"` become one of
 * these; every other category is unsupported and left out rather than
 * guessed at (see `@trainiq/intervals`'s events mapper).
 */
export interface ScheduledWorkout {
  id: string;
  /** "YYYY-MM-DD", local. Intervals.icu only gives date-level granularity here — no time of day. */
  date: string;
  sport: Sport;
  name: string;
  /** Intervals.icu's planned moving_time, in minutes. */
  plannedDurationMinutes?: number;
  /**
   * Intervals.icu's icu_training_load for the plan itself. This is the
   * PLANNED value: when `completedActivityId` is set, the athlete's actual
   * load may differ — this field never updates to reflect what actually
   * happened, and is not the same concept as TrainIQ's own `fatigueCost`.
   */
  plannedLoad?: number;
  /** The completed activity's id (matches an Intervals.icu activity id) once the athlete has done this workout; unset otherwise. */
  completedActivityId?: string;
}
