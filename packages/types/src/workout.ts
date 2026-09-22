import type { Sport } from "./athlete";

export type WorkoutFocus =
  | "endurance"
  | "tempo"
  | "sweet-spot"
  | "threshold"
  | "over-under"
  | "vo2max"
  | "climbing"
  | "openers"
  | "strength";

export type WorkoutIntensity = "easy" | "moderate" | "hard" | "very-hard";

export interface Workout {
  id: string;
  name: string;
  sport: Sport;
  durationMinutes: number;
  focus: WorkoutFocus;
  intensity: WorkoutIntensity;
  /**
   * TrainIQ's own relative fatigue heuristic, 1 (very easy) - 10 (maximal).
   * Used only for TrainIQ's internal planning/ranking.
   *
   * This is NOT the same thing as Intervals.icu's "Load" metric — fatigueCost
   * is a simple, self-contained heuristic we invented for this planner, while
   * Intervals.icu Load is an external, physiologically-modeled training load
   * value, carried separately as `intervalsLoad`. Never derive one from the
   * other or treat them as equivalent or interchangeable.
   */
  fatigueCost: number;
  /**
   * Intervals.icu's `icu_training_load` for this workout, when the workout
   * was sourced from an Intervals.icu library. Unset for mock workouts. An
   * external, physiologically-modeled value — preserved as-is, and distinct
   * from `fatigueCost`, `focus` and `intensity`, which are TrainIQ-owned
   * planning concepts.
   */
  intervalsLoad?: number;
  description: string;
}
