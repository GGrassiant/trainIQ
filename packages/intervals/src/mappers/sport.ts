import type { EnduranceSport } from "@trainiq/types";

/** Intervals.icu `type` values TrainIQ currently knows how to plan around. Anything else is skipped, not guessed at. */
const SPORT_BY_INTERVALS_TYPE: Record<string, EnduranceSport> = {
  Ride: "cycling",
  VirtualRide: "cycling",
  GravelRide: "cycling",
  MountainBikeRide: "cycling",
  Run: "running",
  VirtualRun: "running",
  TrailRun: "running",
};

/** The TrainIQ sport for an Intervals.icu activity/workout `type`, or `undefined` when TrainIQ doesn't plan for it. */
export function sportFromIntervalsType(type: string): EnduranceSport | undefined {
  return SPORT_BY_INTERVALS_TYPE[type];
}
