import type { Workout } from "@trainiq/types";
import { classifyWorkout, ZONE_IDS, type ZoneSeconds } from "../classify-workout";
import { IntervalsWorkoutSchema, IntervalsWorkoutsResponseSchema, type ValidatedIntervalsWorkout } from "../schemas/workout";
import { sportFromIntervalsType } from "./sport";

const SECONDS_PER_MINUTE = 60;

export interface SkippedWorkout {
  id: string;
  /** Plain-language explanation of why the workout was left out of the library. */
  reason: string;
}

export interface WorkoutMappingResult {
  workouts: Workout[];
  skipped: SkippedWorkout[];
}

type SingleWorkoutResult = { workout: Workout } | { reason: string };

const SWEET_SPOT_ZONE_ID = "SS";

/** A label for a top-level response that isn't the JSON array Intervals.icu is expected to return. */
const INVALID_RESPONSE_ID = "response";

function isUsableSeconds(secs: number): boolean {
  return Number.isFinite(secs) && secs > 0;
}

/** A zone-time entry shaped enough to read `id`/`secs` off of, without assuming their types. */
function isZoneTimeEntry(value: unknown): value is { id?: unknown; secs?: unknown } {
  return typeof value === "object" && value !== null;
}

/**
 * Sums seconds per zone for Z1-Z7 only. Zod only checks that `zoneTimes` (if
 * present) is an array — individual entries are `unknown`, so a malformed one
 * (wrong type, missing field, `null`) is ignored here rather than invalidating
 * the whole workout or throwing when destructured.
 */
function toZoneSeconds(zoneTimes: unknown[]): ZoneSeconds {
  const zoneSeconds: ZoneSeconds = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0, Z6: 0, Z7: 0 };
  for (const entry of zoneTimes) {
    if (!isZoneTimeEntry(entry)) continue;
    const zone = ZONE_IDS.find((zoneId) => zoneId === entry.id);
    if (zone && typeof entry.secs === "number" && isUsableSeconds(entry.secs)) {
      zoneSeconds[zone] += entry.secs;
    }
  }
  return zoneSeconds;
}

/**
 * The real `zoneTimes` array also carries an "SS" (Sweet Spot) entry that
 * OVERLAPS Z3/Z4. It is read separately and handed to the classifier as a
 * focus signal only — it is never part of `toZoneSeconds()`, because adding it
 * to the Z1-Z7 totals would double-count time already in those zones.
 */
function toSweetSpotSeconds(zoneTimes: unknown[]): number | undefined {
  const entry = zoneTimes.find((z) => isZoneTimeEntry(z) && z.id === SWEET_SPOT_ZONE_ID);
  if (!isZoneTimeEntry(entry)) return undefined;
  return typeof entry.secs === "number" && isUsableSeconds(entry.secs) ? entry.secs : undefined;
}

function mapWorkout(workout: ValidatedIntervalsWorkout): SingleWorkoutResult {
  if (typeof workout.name !== "string" || workout.name.trim() === "") {
    return { reason: "Workout has no name." };
  }

  const sport = workout.type === undefined ? undefined : sportFromIntervalsType(workout.type);
  if (!sport) {
    return { reason: `Unsupported or missing workout type (${workout.type ?? "none"}).` };
  }

  // Precise, unrounded duration for fatigueCost's floor(duration / 45): rounding to a whole
  // minute first (as durationMinutes below does) can cross that boundary incorrectly — e.g.
  // 44:31 rounds to 45 min and would wrongly earn the point intended for a 45+ min workout.
  const preciseDurationMinutes = (workout.moving_time ?? Number.NaN) / SECONDS_PER_MINUTE;
  const durationMinutes = Math.round(preciseDurationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
    return { reason: "Workout has no usable moving_time." };
  }

  const zoneTimes = workout.workout_doc?.zoneTimes;
  if (!Array.isArray(zoneTimes)) {
    return { reason: "Workout has no workout_doc.zoneTimes, so it can't be classified." };
  }

  const classification = classifyWorkout({
    sport,
    durationMinutes: preciseDurationMinutes,
    zoneSeconds: toZoneSeconds(zoneTimes),
    sweetSpotSeconds: toSweetSpotSeconds(zoneTimes),
  });
  if (!classification) {
    return { reason: "Workout has no time in zones Z1-Z7, so it can't be classified." };
  }

  return {
    workout: {
      id: String(workout.id),
      name: workout.name,
      sport,
      durationMinutes,
      ...classification,
      intervalsLoad: workout.icu_training_load,
      description: workout.description ?? "",
    },
  };
}

/**
 * Best-effort label for a `SkippedWorkout` whose raw data failed schema
 * validation — used only when there's no validated `id` to fall back on.
 * Never falls back to a fabricated-looking id like "undefined" or "null":
 * either a genuine string/number id is visible on the raw value, or the
 * entry's position in the response is used instead.
 */
function describeUnvalidatedWorkout(candidate: unknown, index: number): string {
  if (typeof candidate === "object" && candidate !== null && "id" in candidate) {
    const id = (candidate as { id?: unknown }).id;
    if (typeof id === "number" || typeof id === "string") return String(id);
  }
  return `workout at index ${index}`;
}

/**
 * Maps the athlete's Intervals.icu workout library into TrainIQ Workouts.
 * `rawResponse` is untrusted external data (`unknown`) — the raw result of
 * `response.json()` — not an already-typed `IntervalsWorkout[]`. It, and each
 * workout in it, is validated with `IntervalsWorkoutSchema` (see
 * `../schemas/workout.ts`) before anything is read off of it:
 *
 *   unknown -> Zod validation -> validated Intervals data -> mapper -> TrainIQ Workout
 *
 * Direct mappings, once a workout validates: `id` (as a string), `name`,
 * `type` → `sport`, `moving_time` → `durationMinutes`, `icu_training_load` →
 * `intervalsLoad`, `description`.
 *
 * `focus`, `intensity` and `fatigueCost` are TrainIQ-owned planning concepts
 * with no Intervals.icu equivalent — they come from `classifyWorkout()`, which
 * sees only sport, duration and zone times (never the name, `icu_training_load`
 * or `icu_intensity`). `icu_training_load` is preserved only as `intervalsLoad`.
 *
 * A workout is skipped, with a reason, when TrainIQ can't produce a truthful
 * Workout from it: it fails schema validation (missing/null/non-numeric id,
 * wrong field types, ...), or it validates but has an unsupported/missing
 * sport type, no name, no usable duration, or no zone data to classify from.
 * Never throws, on any input: a response that isn't a JSON array, an array
 * containing non-object entries, and a workout that fails validation all
 * become skip entries instead.
 */
export function mapIntervalsWorkoutsToLibrary(rawResponse: unknown): WorkoutMappingResult {
  const topLevel = IntervalsWorkoutsResponseSchema.safeParse(rawResponse);
  if (!topLevel.success) {
    return {
      workouts: [],
      skipped: [{ id: INVALID_RESPONSE_ID, reason: "Intervals.icu workouts response was not a JSON array." }],
    };
  }

  const result: WorkoutMappingResult = { workouts: [], skipped: [] };

  topLevel.data.forEach((candidate, index) => {
    const parsed = IntervalsWorkoutSchema.safeParse(candidate);
    if (!parsed.success) {
      result.skipped.push({
        id: describeUnvalidatedWorkout(candidate, index),
        reason: "Workout did not match the expected shape from Intervals.icu.",
      });
      return;
    }

    const mapped = mapWorkout(parsed.data);
    if ("workout" in mapped) {
      result.workouts.push(mapped.workout);
    } else {
      result.skipped.push({ id: String(parsed.data.id), reason: mapped.reason });
    }
  });

  return result;
}
