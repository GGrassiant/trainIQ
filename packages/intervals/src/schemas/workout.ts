import { z } from "zod";

/**
 * Runtime validation for `GET /api/v1/athlete/{id}/workouts` — the boundary
 * where `response.json()` first becomes TrainIQ data. Before this schema
 * existed, that JSON was asserted `as IntervalsWorkout[]` without being
 * checked, so malformed external data (a missing/null id, a non-array
 * response, ...) could throw deep inside the mapper or silently produce a
 * fabricated `Workout.id` such as `"undefined"`.
 *
 *   Intervals HTTP JSON -> unknown -> Zod validation -> validated data -> mapper -> TrainIQ Workout
 *
 * Deliberately minimal: this validates only the fields `mapIntervalsWorkoutsToLibrary`
 * actually reads, not the whole real Intervals workout schema, and any other field
 * on the real payload (folder_id, indoor, tags, ...) is simply ignored, not rejected.
 * This is the only Intervals.icu boundary validated with Zod today — athlete,
 * wellness and activities still use the plain `as T` pattern; see the P2 fix
 * discussion this schema came from before extending the pattern elsewhere.
 */

/** The real payload sometimes sends an explicit `null` for an absent optional field; treat that the same as "not provided". */
function optional<Schema extends z.ZodType>(schema: Schema) {
  return schema.nullish().transform((value) => value ?? undefined);
}

const IntervalsZoneTimesSchema = optional(
  z.array(
    /**
     * Left loosely typed on purpose: a malformed individual zone-time entry
     * (wrong type, missing field, `null`) should be ignored by the mapper's
     * own defensive per-entry checks, not invalidate the whole workout.
     */
    z.unknown()
  )
);

export const IntervalsWorkoutSchema = z.object({
  /**
   * The one field a fabricated fallback would be actively misleading for: a
   * missing/null/non-numeric id must never become TrainIQ's `Workout.id`, so
   * it is required, strictly a finite JSON number, and never coerced from a
   * string.
   */
  id: z.number().finite(),
  name: optional(z.string()),
  description: optional(z.string()),
  type: optional(z.string()),
  moving_time: optional(z.number().finite()),
  icu_training_load: optional(z.number().finite()),
  workout_doc: optional(z.object({ zoneTimes: IntervalsZoneTimesSchema })),
});

export type ValidatedIntervalsWorkout = z.infer<typeof IntervalsWorkoutSchema>;

/** The response is expected to be a JSON array; nothing about its items is assumed at this stage. */
export const IntervalsWorkoutsResponseSchema = z.array(z.unknown());
