import type { Sport } from "./athlete";

export interface RecentSession {
  date: string;
  sport: Sport;
  durationMinutes: number;
  /** 1 (very easy) - 10 (maximal) perceived intensity. */
  intensity: number;
  fatigueCost: number;
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
