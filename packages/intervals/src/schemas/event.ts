import { z } from "zod";

/**
 * Runtime validation for `GET /api/v1/athlete/{id}/events.json` — the
 * boundary where `response.json()` first becomes TrainIQ data, mirroring
 * `./workout.ts`'s pattern for the workout-library endpoint:
 *
 *   Intervals HTTP JSON -> unknown -> Zod validation -> validated data -> mapper -> TrainIQ ScheduledWorkout
 *
 * `category` is kept as an open `z.string()`, not a closed enum — Intervals.icu
 * may use categories this account's real data never produced (only "WORKOUT"
 * was observed), and an unfamiliar category is a mapper-level skip, not a
 * schema rejection of the whole event.
 */

function optional<Schema extends z.ZodType>(schema: Schema) {
  return schema.nullish().transform((value) => value ?? undefined);
}

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

/** Rejects e.g. "2026-02-30" (matches the regex's field widths but isn't a real day) by round-tripping through Date.UTC — a regex alone can't catch this. Pure validation, not a timezone conversion: the field stays the original local string. */
function isValidLocalDateTime(value: string): boolean {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (hour > 23 || minute > 59 || second > 59) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const IntervalsLocalDateTimeSchema = z
  .string()
  .refine(isValidLocalDateTime, "must be a valid local date-time (YYYY-MM-DDTHH:mm:ss) with a real calendar date");

/** A completed activity's id, once paired — never an i-prefix format requirement (not something this account's data guarantees), just non-empty. */
const CompletedActivityIdSchema = z.string().refine((value) => value.trim().length > 0, "must not be empty or whitespace-only");

export const IntervalsEventSchema = z.object({
  /** Never let a missing/non-numeric/negative/fractional/unsafe id become a fabricated `ScheduledWorkout.id`. */
  id: z.number().int().positive().safe(),
  category: z.string(),
  type: optional(z.string()),
  name: optional(z.string()),
  start_date_local: IntervalsLocalDateTimeSchema,
  /** Planned duration in seconds; negative is never valid, zero is. */
  moving_time: optional(z.number().finite().nonnegative()),
  /** Intervals.icu's planned load; negative is never valid, zero is. */
  icu_training_load: optional(z.number().finite().nonnegative()),
  paired_activity_id: optional(CompletedActivityIdSchema),
});

export type ValidatedIntervalsEvent = z.infer<typeof IntervalsEventSchema>;

/** The response is expected to be a JSON array; nothing about its items is assumed at this stage. */
export const IntervalsEventsResponseSchema = z.array(z.unknown());
