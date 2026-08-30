import type { Athlete, AthleteGoal, EnduranceSport, Sport } from "./athlete";
import type { Availability, DayOfWeek } from "./availability";
import type { TrainingLoadContext } from "./training-load";
import type { WeatherContext } from "./weather";
import type { Workout } from "./workout";

interface TrainingDayBase {
  dayOfWeek: DayOfWeek;
  sport: Sport;
  durationMinutes: number;
}

/**
 * A real, immovable commitment from the athlete's calendar (e.g. a running
 * club). This is ground truth, not a recommendation: the planner must never
 * substitute a library workout for it, move it to another day, or let a
 * "better-scoring" workout replace it.
 */
export interface FixedCommitmentDay extends TrainingDayBase {
  status: "fixed";
  sport: EnduranceSport;
  /** The commitment's own label, e.g. "Tuesday morning running club". */
  label: string;
  reasoning: string[];
}

/** An existing workout the engine selected from the library for this day. */
export interface RecommendedTrainingDay extends TrainingDayBase {
  status: "recommended";
  workout: Workout;
  reasoning: string[];
}

/**
 * A day the planner reserved a slot for but could not fill: no existing
 * workout in the library satisfied the sport/intensity/duration
 * requirements. Never invented and never silently dropped — surfaced
 * explicitly so a future workout-generation fallback has something
 * concrete to act on.
 */
export interface UnresolvedTrainingDay extends TrainingDayBase {
  status: "unresolved";
  /** Plain-language explanation of why no workout could be selected. */
  reason: string;
}

/**
 * A single day's plan. Exactly one of three states — never a blend:
 * a fixed commitment, a recommended workout, or an unresolved slot.
 */
export type TrainingDay = FixedCommitmentDay | RecommendedTrainingDay | UnresolvedTrainingDay;

export interface WeeklyPlan {
  weekStartDate: string;
  /** Endurance days and, if scheduled, one complementary strength day — sorted by day of week. */
  days: TrainingDay[];
  /** Count of successfully planned (fixed + recommended) endurance days only; strength and unresolved days don't count toward this. */
  totalTrainingDays: number;
  /** Sum of actually-scheduled session minutes; excludes an unresolved day's unfilled availability. */
  totalDurationMinutes: number;
  /** One-line stats summary. */
  summary: string;
  /** Plain-language, template-based explanation of the week's overall training rationale. */
  rationale: string;
  /**
   * Endurance training needs that couldn't be scheduled at all this week —
   * e.g. fewer available days than the ~4-day target. Empty when the full
   * target was met. Distinct from an UnresolvedTrainingDay: this is a need
   * with no day to attach it to, not a day with no matching workout.
   */
  unmetRequirements: string[];
}

export interface PlanningContext {
  weekStartDate: string;
  athlete: Athlete;
  goals: AthleteGoal[];
  availability: Availability;
  trainingLoad: TrainingLoadContext;
  weather: WeatherContext;
  workoutLibrary: Workout[];
}
