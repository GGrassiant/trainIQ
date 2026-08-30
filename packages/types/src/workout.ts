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
   * value that will come from the Intervals.icu API once that integration
   * exists. Do not treat the two as equivalent or interchangeable.
   */
  fatigueCost: number;
  /**
   * Placeholder for a future Intervals.icu-sourced Load value. Intentionally
   * unset everywhere in mock data today — this field exists to make the
   * eventual integration point explicit, not to simulate real Load numbers.
   */
  intervalsLoad?: number;
  description: string;
}
