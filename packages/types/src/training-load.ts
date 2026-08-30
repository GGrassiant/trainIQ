import type { Sport } from "./athlete";

export interface RecentSession {
  date: string;
  sport: Sport;
  durationMinutes: number;
  /**
   * 1 (very easy) - 10 (maximal) perceived intensity. Optional: a session
   * sourced from an external provider (e.g. Intervals.icu) doesn't carry a
   * perceived-exertion rating, and TrainIQ does not invent one.
   */
  intensity?: number;
  /**
   * TrainIQ's own relative fatigue heuristic, 1 (very easy) - 10 (maximal).
   * Optional for the same reason as `intensity` — not knowable for a
   * session TrainIQ didn't itself generate. This is NOT the same thing as
   * Intervals.icu's training load metric — see `intervalsTrainingLoad`.
   */
  fatigueCost?: number;
  /**
   * Intervals.icu's `icu_training_load` for this session, when the session
   * was sourced from Intervals.icu. An external, physiologically-modeled
   * training-load value — distinct from `fatigueCost` and never treated as
   * equivalent to it.
   */
  intervalsTrainingLoad?: number;
}

export interface TrainingLoadContext {
  /** Chronic Training Load — long-term fitness. */
  ctl: number;
  /** Acute Training Load — short-term fatigue. */
  atl: number;
  /** Training Stress Balance / form, typically ctl - atl. */
  tsb: number;
  recentSessions: RecentSession[];
}
