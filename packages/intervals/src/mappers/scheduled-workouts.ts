import type { ScheduledWorkout, Sport } from "@trainiq/types";
import { IntervalsEventSchema, IntervalsEventsResponseSchema, type ValidatedIntervalsEvent } from "../schemas/event";

const SECONDS_PER_MINUTE = 60;

/** The only category this account's real data has ever produced, and the only one TrainIQ gives domain meaning to in V1. */
const SUPPORTED_CATEGORY = "WORKOUT";

function sportFromIntervalsEventType(type: string): Sport | undefined {
  switch (type) {
    case "Ride":
      return "cycling";
    case "Run":
      return "running";
    case "WeightTraining":
      return "strength";
    default:
      return undefined;
  }
}

export interface SkippedEvent {
  id: string;
  reason: string;
}

export interface ScheduledWorkoutMappingResult {
  scheduledWorkouts: ScheduledWorkout[];
  skipped: SkippedEvent[];
}

type SingleEventResult = { scheduledWorkout: ScheduledWorkout } | { reason: string };

/** A label for a top-level response that isn't the JSON array Intervals.icu is expected to return. */
const INVALID_RESPONSE_ID = "response";

function mapEvent(event: ValidatedIntervalsEvent): SingleEventResult {
  if (event.category !== SUPPORTED_CATEGORY) {
    return { reason: `Unsupported event category (${event.category}).` };
  }

  if (typeof event.name !== "string" || event.name.trim() === "") {
    return { reason: "Event has no name." };
  }

  const sport = event.type === undefined ? undefined : sportFromIntervalsEventType(event.type);
  if (!sport) {
    return { reason: `Unsupported or missing event type (${event.type ?? "none"}).` };
  }

  const plannedDurationMinutes =
    event.moving_time === undefined ? undefined : Math.round(event.moving_time / SECONDS_PER_MINUTE);

  return {
    scheduledWorkout: {
      id: String(event.id),
      // Day-level only: the real payload has no meaningful time-of-day (see IntervalsEvent's doc comment).
      date: event.start_date_local.slice(0, 10),
      sport,
      name: event.name,
      plannedDurationMinutes,
      plannedLoad: event.icu_training_load,
      completedActivityId: event.paired_activity_id,
    },
  };
}

/**
 * Best-effort label for a `SkippedEvent` whose raw data failed schema
 * validation — used only when there's no validated `id` to fall back on.
 * Mirrors `describeUnvalidatedWorkout` in `./workouts.ts`.
 */
function describeUnvalidatedEvent(candidate: unknown, index: number): string {
  if (typeof candidate === "object" && candidate !== null && "id" in candidate) {
    const id = (candidate as { id?: unknown }).id;
    if (typeof id === "number" || typeof id === "string") return String(id);
  }
  return `event at index ${index}`;
}

/**
 * Maps the athlete's Intervals.icu calendar events into TrainIQ
 * ScheduledWorkouts. `rawResponse` is untrusted (`unknown`) — validated with
 * `IntervalsEventSchema` (see `../schemas/event.ts`) before anything is read
 * off of it. Never throws, on any input: a failed validation, an
 * unsupported category, or an unsupported/missing sport type all become a
 * `SkippedEvent` with a reason instead.
 */
export function mapIntervalsEventsToScheduledWorkouts(rawResponse: unknown): ScheduledWorkoutMappingResult {
  const topLevel = IntervalsEventsResponseSchema.safeParse(rawResponse);
  if (!topLevel.success) {
    return {
      scheduledWorkouts: [],
      skipped: [{ id: INVALID_RESPONSE_ID, reason: "Intervals.icu events response was not a JSON array." }],
    };
  }

  const result: ScheduledWorkoutMappingResult = { scheduledWorkouts: [], skipped: [] };

  topLevel.data.forEach((candidate, index) => {
    const parsed = IntervalsEventSchema.safeParse(candidate);
    if (!parsed.success) {
      result.skipped.push({
        id: describeUnvalidatedEvent(candidate, index),
        reason: "Event did not match the expected shape from Intervals.icu.",
      });
      return;
    }

    const mapped = mapEvent(parsed.data);
    if ("scheduledWorkout" in mapped) {
      result.scheduledWorkouts.push(mapped.scheduledWorkout);
    } else {
      result.skipped.push({ id: String(parsed.data.id), reason: mapped.reason });
    }
  });

  return result;
}
