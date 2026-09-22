import type { EnduranceSport, WorkoutFocus, WorkoutIntensity } from "@trainiq/types";

/*
 * Workout classification — see docs/adr/0001-workout-classification.md for the
 * reasoning behind everything in this file.
 *
 * Three concepts are deliberately kept independent:
 *   focus         what kind of work primarily characterizes the workout
 *   intensity     how demanding TrainIQ considers it for weekly planning
 *   intervalsLoad Intervals.icu's own training load (never reinterpreted here)
 * `classifyFocus()` and `classifyIntensity()` therefore never call each other:
 * a workout can legitimately have, say, a vo2max focus and a moderate intensity.
 *
 * PROVISIONAL. Every number below is a TrainIQ heuristic constant, NOT a
 * physiological threshold. They were placed in observed gaps in one athlete's
 * real workout library (270 workouts) and have not been validated more
 * broadly. Where a constant's evidence is especially thin, that is noted next
 * to it. Expect them to change.
 */

const SECONDS_PER_MINUTE = 60;

export const ZONE_IDS = ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7"] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

/** Seconds a workout spends in each of the athlete's zones Z1-Z7. Provider-neutral: knows nothing about Intervals.icu payloads. */
export type ZoneSeconds = Record<ZoneId, number>;

/**
 * Everything the classifiers may look at. Deliberately excludes the workout's
 * name, `icu_training_load` and `icu_intensity`: names aren't reliable evidence
 * of content, and Intervals.icu's load/intensity are external values that
 * TrainIQ preserves but does not reinterpret.
 */
export interface WorkoutProfile {
  sport: EnduranceSport;
  /**
   * The workout's PRECISE duration — e.g. `movingTimeSeconds / 60`, not a
   * value already rounded to a whole minute. Only `estimateFatigueCost()`
   * reads this (via `floor(durationMinutes / 45)`), and rounding before this
   * point can cross that boundary incorrectly (a 44:31 workout rounds to 45
   * minutes and would wrongly earn the point intended for a 45+ min one).
   */
  durationMinutes: number;
  zoneSeconds: ZoneSeconds;
  /**
   * Seconds in Intervals.icu's Sweet Spot band, when the workout reports one.
   * SS OVERLAPS Z3/Z4 rather than partitioning time, so it is a focus signal
   * only and is never added to any zone total or share denominator.
   */
  sweetSpotSeconds?: number;
}

export interface WorkoutClassification {
  focus: WorkoutFocus;
  intensity: WorkoutIntensity;
  fatigueCost: number;
}

// ---------------------------------------------------------------------------
// Intensity (planning demand)
// ---------------------------------------------------------------------------

/**
 * A tier is reached by share of workout time OR by an absolute number of
 * minutes (an absolute arm stops a long workout from diluting real hard work
 * into `easy`). A missing `*Minutes` value means that tier has no absolute arm.
 *
 * The sports are separate on purpose: zone numbers don't mean the same thing in
 * cycling (power zones) and running (pace zones), and the running sample is far
 * too small to justify absolute minutes calibrated on cycling. Running keeps
 * the share-only rules.
 */
interface IntensityRules {
  /** Share of time in Z5-Z7 → `very-hard`. */
  veryHardShare: number;
  /** Minutes in Z5-Z7 → `very-hard`. */
  veryHardHighZoneMinutes?: number;
  /** Share of time in Z4-Z7 → `hard`. */
  hardShare: number;
  /** Minutes in Z4-Z7 → `hard`. */
  hardWorkZoneMinutes?: number;
  /** Share of time in Z3-Z7 → `moderate`. */
  moderateShare: number;
  /**
   * Minutes in Z5-Z7 → `moderate`. Deliberately Z5-Z7 and not Z3+: a generic
   * "N minutes of Z3+" arm promotes warm-up ladders (e.g. "Short Sprint 6s",
   * whose 6 Z4 minutes are two 3-minute ladder steps) to `moderate`.
   */
  moderateHighZoneMinutes?: number;
}

const INTENSITY_RULES: Record<EnduranceSport, IntensityRules> = {
  cycling: {
    veryHardShare: 0.15,
    veryHardHighZoneMinutes: 12,
    hardShare: 0.2,
    hardWorkZoneMinutes: 20,
    moderateShare: 0.2,
    moderateHighZoneMinutes: 5,
  },
  running: {
    veryHardShare: 0.15,
    hardShare: 0.2,
    moderateShare: 0.2,
  },
};

/**
 * `fatigueCost` PROVISIONAL heuristic. `Workout.fatigueCost` is a required
 * field, so something must populate it; `planWeek()` does not read it today.
 * It depends only on TrainIQ's intensity tier and the duration — never on
 * Intervals.icu's `icu_training_load`.
 */
const FATIGUE_BASE_BY_INTENSITY: Record<WorkoutIntensity, number> = {
  easy: 2,
  moderate: 4,
  hard: 5,
  "very-hard": 6,
};
const MINUTES_PER_FATIGUE_POINT = 45;
const MAX_FATIGUE_COST = 10;

function sumZones(zoneSeconds: ZoneSeconds, zones: ZoneId[]): number {
  return zones.reduce((sum, zone) => sum + zoneSeconds[zone], 0);
}

function totalSeconds(zoneSeconds: ZoneSeconds): number {
  return sumZones(zoneSeconds, [...ZONE_IDS]);
}

function atLeastShare(seconds: number, totalWorkoutSeconds: number, share: number): boolean {
  return seconds / totalWorkoutSeconds >= share;
}

/** `minutes` undefined means "this tier has no absolute-minutes arm", so it is never reached this way. */
function atLeastMinutes(seconds: number, minutes: number | undefined): boolean {
  return minutes !== undefined && seconds >= minutes * SECONDS_PER_MINUTE;
}

/**
 * How demanding TrainIQ considers the workout for weekly planning. The first
 * matching tier wins:
 *
 * - very-hard: Z5-Z7 share >= 15%, or (cycling) >= 12 min in Z5-Z7
 * - hard:      Z4-Z7 share >= 20%, or (cycling) >= 20 min in Z4-Z7
 * - moderate:  Z3-Z7 share >= 20%, or (cycling) >= 5 min in Z5-Z7
 * - easy:      otherwise
 *
 * Requires a workout with time in Z1-Z7 (see `classifyWorkout()`).
 */
export function classifyIntensity(profile: WorkoutProfile): WorkoutIntensity {
  const { zoneSeconds } = profile;
  const rules = INTENSITY_RULES[profile.sport];
  const total = totalSeconds(zoneSeconds);
  const highZone = sumZones(zoneSeconds, ["Z5", "Z6", "Z7"]);
  const workZone = sumZones(zoneSeconds, ["Z4", "Z5", "Z6", "Z7"]);
  const aboveEndurance = sumZones(zoneSeconds, ["Z3", "Z4", "Z5", "Z6", "Z7"]);

  if (atLeastShare(highZone, total, rules.veryHardShare) || atLeastMinutes(highZone, rules.veryHardHighZoneMinutes)) return "very-hard";
  if (atLeastShare(workZone, total, rules.hardShare) || atLeastMinutes(workZone, rules.hardWorkZoneMinutes)) return "hard";
  if (atLeastShare(aboveEndurance, total, rules.moderateShare) || atLeastMinutes(highZone, rules.moderateHighZoneMinutes)) return "moderate";
  return "easy";
}

/** `durationMinutes` should be precise, not pre-rounded — see `WorkoutProfile.durationMinutes`. */
export function estimateFatigueCost(intensity: WorkoutIntensity, durationMinutes: number): number {
  const durationPoints = Math.floor(durationMinutes / MINUTES_PER_FATIGUE_POINT);
  return Math.min(MAX_FATIGUE_COST, FATIGUE_BASE_BY_INTENSITY[intensity] + durationPoints);
}

// ---------------------------------------------------------------------------
// Focus (what kind of work characterizes the workout)
// ---------------------------------------------------------------------------

/** Cycling only: minutes in the Sweet Spot band needed to call a workout `sweet-spot`. Robust on the observed library (any value 10-30 gives the same labels). */
const SWEET_SPOT_MIN_MINUTES = 20;
/** Cycling only: share of the workout's Z3+ time that must sit in the SS band. Robust on the observed library (0.88-1.0 give the same labels). */
const SWEET_SPOT_MIN_SHARE_OF_WORK = 0.95;

/**
 * A work band can only name the workout's focus if it holds a meaningful
 * amount of it: a share of the workout's time, or (cycling only) an absolute
 * number of minutes. Otherwise the focus falls back to `endurance`.
 *
 * `endurance` is a CONSERVATIVE FALLBACK, not a finding that the workout is
 * physiologically an endurance workout: it means aggregate zone data can't
 * establish another focus. In particular a workout whose real structure is
 * "endurance plus a few sprints" (an opener) also lands here, because openers
 * can't be inferred safely from aggregate zones.
 */
interface FocusGate {
  /**
   * PROVISIONAL, and the weakest-evidenced constant here. Its evidence is
   * substantially one 29-minute workout ("Lactate Tolerance 4x12", 20.7%):
   * only values around 19-20.5% reproduce the observed labels. It is a TrainIQ
   * heuristic, not an established training-science threshold.
   */
  minShare: number;
  /**
   * Cycling only. PROVISIONAL: a value inside an observed gap, not a
   * physiological threshold. Any value from roughly 6.5 to 8 minutes gives
   * identical labels on the observed library; 7 is a simple choice within it.
   * The gap is bounded by "Short Sprint 6s" (6 min of Z4, which is warm-up
   * ladder steps and must not become `threshold`) below, and "PMA-2"
   * (8 min of Z6, which must stay `vo2max`) above.
   * Not applied to running: absolute minutes calibrated on cycling shouldn't
   * be transferred to a sport with far less evidence.
   */
  minMinutes?: number;
}

const FOCUS_GATE: Record<EnduranceSport, FocusGate> = {
  cycling: { minShare: 0.2, minMinutes: 7 },
  running: { minShare: 0.2 },
};

/**
 * What kind of work primarily characterizes the workout. Evaluated in order:
 *
 * 1. sweet-spot (cycling only): >= 20 min in the SS band AND SS >= 95% of the
 *    workout's Z3+ minutes.
 * 2. Otherwise the dominant work band — the most minutes among Z3 (tempo), Z4
 *    (threshold) and Z5-Z7 combined (vo2max), ties going to the higher band —
 *    if it is meaningful: >= 20% of the workout's time, or (cycling only)
 *    >= 7 minutes.
 * 3. Otherwise endurance.
 *
 * Only work bands compete, so warm-up/recovery/cooldown time in Z1-Z2 can't
 * decide the focus. `over-under`, `openers`, `climbing` and `strength` are never
 * emitted: they can't be established from aggregate zone data.
 *
 * Requires a workout with time in Z1-Z7 (see `classifyWorkout()`).
 */
export function classifyFocus(profile: WorkoutProfile): WorkoutFocus {
  const { zoneSeconds, sport } = profile;

  if (isSweetSpot(profile)) return "sweet-spot";

  const bands: { focus: WorkoutFocus; seconds: number }[] = [
    { focus: "tempo", seconds: zoneSeconds.Z3 },
    { focus: "threshold", seconds: zoneSeconds.Z4 },
    { focus: "vo2max", seconds: sumZones(zoneSeconds, ["Z5", "Z6", "Z7"]) },
  ];
  const dominant = bands.reduce((best, band) => (band.seconds >= best.seconds ? band : best));

  const gate = FOCUS_GATE[sport];
  const isMeaningful = atLeastShare(dominant.seconds, totalSeconds(zoneSeconds), gate.minShare) || atLeastMinutes(dominant.seconds, gate.minMinutes);
  return isMeaningful ? dominant.focus : "endurance";
}

function isSweetSpot({ sport, zoneSeconds, sweetSpotSeconds }: WorkoutProfile): boolean {
  if (sport !== "cycling" || sweetSpotSeconds === undefined) return false;

  const aboveEndurance = sumZones(zoneSeconds, ["Z3", "Z4", "Z5", "Z6", "Z7"]);
  return (
    sweetSpotSeconds >= SWEET_SPOT_MIN_MINUTES * SECONDS_PER_MINUTE &&
    aboveEndurance > 0 &&
    sweetSpotSeconds / aboveEndurance >= SWEET_SPOT_MIN_SHARE_OF_WORK
  );
}

// ---------------------------------------------------------------------------

/**
 * Classifies a workout on both axes and estimates `fatigueCost`. Returns
 * `undefined` when the workout has no time in Z1-Z7 at all: there is nothing
 * to classify from, and fabricating values would be misleading.
 */
export function classifyWorkout(profile: WorkoutProfile): WorkoutClassification | undefined {
  if (totalSeconds(profile.zoneSeconds) <= 0) {
    return undefined;
  }

  const intensity = classifyIntensity(profile);
  return {
    focus: classifyFocus(profile),
    intensity,
    fatigueCost: estimateFatigueCost(intensity, profile.durationMinutes),
  };
}
