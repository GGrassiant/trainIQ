import type { RecentSession, Sport } from "@trainiq/types";
import type { IntervalsActivity } from "../api-types";

/** Intervals.icu activity `type` values TrainIQ currently knows how to plan around. Anything else is skipped, not guessed at. */
const SPORT_BY_INTERVALS_TYPE: Record<string, Sport> = {
  Ride: "cycling",
  VirtualRide: "cycling",
  GravelRide: "cycling",
  MountainBikeRide: "cycling",
  Run: "running",
  VirtualRun: "running",
  TrailRun: "running",
};

const SECONDS_PER_MINUTE = 60;

/**
 * Maps Intervals.icu activities into TrainIQ RecentSession objects.
 *
 * Intentional non-mappings:
 * - `icu_training_load` is preserved as `intervalsTrainingLoad`, never as
 *   `fatigueCost` — the two are different, non-interchangeable concepts.
 * - `icu_intensity` (Intervals.icu's relative intensity) is not mapped to
 *   `intensity` (TrainIQ's 1-10 perceived-exertion scale) — they measure
 *   different things and conflating them would fabricate data.
 *
 * An activity is skipped (not included in the result) when its `type` isn't
 * one TrainIQ plans for, or when `moving_time` is missing and a truthful
 * `durationMinutes` can't be produced. Skipping is explicit and safe: it
 * never throws and never invents a duration or sport.
 */
export function mapActivitiesToRecentSessions(activities: IntervalsActivity[]): RecentSession[] {
  return activities.reduce<RecentSession[]>((sessions, activity) => {
    const sport = SPORT_BY_INTERVALS_TYPE[activity.type];
    if (!sport || activity.moving_time === undefined) {
      return sessions;
    }

    sessions.push({
      date: activity.start_date_local.slice(0, 10),
      sport,
      durationMinutes: Math.round(activity.moving_time / SECONDS_PER_MINUTE),
      intervalsTrainingLoad: activity.icu_training_load,
    });
    return sessions;
  }, []);
}
