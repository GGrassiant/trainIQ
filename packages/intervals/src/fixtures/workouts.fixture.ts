import type { IntervalsWorkout, IntervalsZoneTime } from "../api-types";

/**
 * Builds a `zoneTimes` array in the real payload's shape: Z1-Z7 in order,
 * followed by the overlapping "SS" (Sweet Spot) entry. The real entries carry
 * extra metadata (name, color, watt ranges) that TrainIQ doesn't read.
 */
export function zoneTimesFixture(secondsByZone: Partial<Record<"Z1" | "Z2" | "Z3" | "Z4" | "Z5" | "Z6" | "Z7" | "SS", number>>): IntervalsZoneTime[] {
  return (["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7", "SS"] as const).map((id) => ({ id, secs: secondsByZone[id] ?? 0 }));
}

/**
 * Anonymized, hand-written samples resembling the real
 * `GET /api/v1/athlete/0/workouts` response. Not real athlete data.
 */

/** Easy endurance: 2h entirely in Zone 2. */
export const z2RideWorkout: IntervalsWorkout = {
  id: 245,
  name: "Z2 Ride",
  description: "- 2h 60%",
  type: "Ride",
  moving_time: 7200,
  icu_training_load: 72,
  workout_doc: { zoneTimes: zoneTimesFixture({ Z2: 7200 }) },
};

/**
 * Structured VO2/anaerobic session: 66 min, but most of the minutes are
 * warmup, recoveries and cooldown (Z1 + Z2 = 42 min) around 18 min in Z5
 * and 6 min in Z7.
 */
export const raceReadyWorkout: IntervalsWorkout = {
  id: 312,
  name: "Race Ready",
  description: "- 15m ramp 55-75%\n\n2 sets of\n6x\n- 90s 105-130%\n- 30s 180-500%\n- 60s 50%\n\n- 10m ramp 55-75%",
  type: "Ride",
  moving_time: 3960,
  icu_training_load: 88,
  workout_doc: { zoneTimes: zoneTimesFixture({ Z1: 1020, Z2: 1500, Z5: 1080, Z7: 360 }) },
};

export const easyRunWorkout: IntervalsWorkout = {
  id: 401,
  name: "Easy Run",
  description: "- 45m 70%",
  type: "Run",
  moving_time: 2700,
  icu_training_load: 38,
  workout_doc: { zoneTimes: zoneTimesFixture({ Z1: 300, Z2: 2400 }) },
};

/** A sport TrainIQ doesn't plan for. */
export const swimWorkout: IntervalsWorkout = {
  id: 500,
  name: "Easy Swim",
  type: "Swim",
  moving_time: 1800,
  icu_training_load: 20,
  workout_doc: { zoneTimes: zoneTimesFixture({ Z2: 1800 }) },
};

/** A free-text workout: no structured `workout_doc`, so there is nothing to classify from. */
export const freeTextWorkout: IntervalsWorkout = {
  id: 600,
  name: "Ride to the coast",
  description: "Just ride steady, see how it feels.",
  type: "Ride",
  moving_time: 10800,
};

/**
 * Real-library counterexamples that shaped the classifier (see ADR 0001).
 * Zone distributions are the real ones; ids are anonymized.
 */

/** 3 x 3' at Z5 inside a 66-minute ride: VO2 work diluted to 13.6% of the workout. */
export const vo2WorkInLongRideWorkout: IntervalsWorkout = {
  id: 701,
  name: "Short VO2 Intervals",
  type: "Ride",
  moving_time: 3960,
  icu_training_load: 60,
  workout_doc: { zoneTimes: zoneTimesFixture({ Z1: 1680, Z2: 1740, Z5: 540 }) },
};

/** 8 x (3' Z4 + 30" Z5) inside a 181-minute ride: 32 min of Z4+, but only ~18% of the ride. */
export const thresholdIntervalsInLongRideWorkout: IntervalsWorkout = {
  id: 702,
  name: "Long Ride With Threshold Intervals",
  type: "Ride",
  moving_time: 10860,
  icu_training_load: 173,
  workout_doc: { zoneTimes: zoneTimesFixture({ Z1: 240, Z2: 8520, Z3: 180, Z4: 1440, Z5: 480 }) },
};

/** Warm-up ladders (whose Zone 3-4 steps Intervals puts in Z4) plus a few 6-second sprints. */
export const warmupLadderAndSprintsWorkout: IntervalsWorkout = {
  id: 703,
  name: "Sprint Session",
  type: "Ride",
  moving_time: 3744,
  icu_training_load: 50,
  workout_doc: { zoneTimes: zoneTimesFixture({ Z2: 3360, Z4: 360, Z6: 24, SS: 360 }) },
};

/** 3 x 10' at 88-92% FTP: Z3 time that is entirely inside the overlapping Sweet Spot band. */
export const sweetSpotBlocksWorkout: IntervalsWorkout = {
  id: 704,
  name: "Sweet Spot Blocks",
  type: "Ride",
  moving_time: 3900,
  icu_training_load: 68,
  workout_doc: { zoneTimes: zoneTimesFixture({ Z2: 2100, Z3: 1800, SS: 1800 }) },
};
