/**
 * Minimal external Intervals.icu API types — only the fields TrainIQ
 * currently reads. This is deliberately not a full mirror of Intervals.icu's
 * OpenAPI schema, and is kept distinct from TrainIQ's own domain types
 * (see mappers/) so the two are never accidentally conflated.
 */

/** A single day's wellness record from `GET /api/v1/athlete/{id}/wellness`. */
export interface IntervalsWellnessEntry {
  /** ISO date (e.g. "2026-08-27") — Intervals.icu addresses wellness records by date. */
  id: string;
  /** Chronic Training Load, when Intervals.icu has computed one for this date. */
  ctl?: number;
  /** Acute Training Load, when Intervals.icu has computed one for this date. */
  atl?: number;
}

/**
 * The athlete identity fields from `GET /api/v1/athlete/{id}`. The real
 * response carries dozens of account/settings fields (email, device sync
 * config, units preferences, etc.) — only `id` and `name` are modeled here,
 * since that's all TrainIQ's athlete identity currently needs.
 */
export interface IntervalsAthlete {
  id: string;
  name: string;
}

/** A single activity from `GET /api/v1/athlete/{id}/activities`. */
export interface IntervalsActivity {
  id: string;
  /** Local start time, e.g. "2026-08-24T18:00:00". */
  start_date_local: string;
  /** Intervals.icu activity type, e.g. "Ride", "VirtualRide", "Run". Not a closed enum on the API side. */
  type: string;
  /** Moving time in seconds. */
  moving_time?: number;
  /** Distance in meters, as recorded by the source device/file. */
  distance?: number;
  /** Distance in meters, as computed/corrected by Intervals.icu. */
  icu_distance?: number;
  /** Intervals.icu's modeled training load for this activity. Not the same concept as TrainIQ's `fatigueCost`. */
  icu_training_load?: number;
  /** Intervals.icu's relative intensity for this activity (not a perceived-exertion rating). */
  icu_intensity?: number;
}

/**
 * One entry of `workout_doc.zoneTimes`: seconds a workout spends in a zone.
 * The real array carries Z1-Z7 plus an overlapping "SS" (Sweet Spot) entry,
 * and per-zone metadata (name, color, watt ranges) that TrainIQ doesn't read.
 */
export interface IntervalsZoneTime {
  /** "Z1"-"Z7", or "SS" (Sweet Spot), which overlaps Z3/Z4 rather than partitioning time. */
  id: string;
  secs: number;
}

/**
 * A workout from the athlete's library, `GET /api/v1/athlete/{id}/workouts`.
 * Only the fields TrainIQ reads are modeled. Everything except `id` is
 * optional because the mapper must cope with incomplete library entries
 * (e.g. free-text workouts with no `workout_doc`) instead of trusting them.
 */
export interface IntervalsWorkout {
  /** Numeric on the API side; TrainIQ's `Workout.id` is a string. */
  id: number;
  name?: string;
  description?: string;
  /** Intervals.icu sport type, e.g. "Ride", "Run". Not a closed enum on the API side. */
  type?: string;
  /** Planned duration in seconds. */
  moving_time?: number;
  /** Intervals.icu's modeled training load for this workout. Not the same concept as TrainIQ's `fatigueCost`. */
  icu_training_load?: number;
  workout_doc?: {
    zoneTimes?: IntervalsZoneTime[];
  };
}

/**
 * A calendar entry from `GET /api/v1/athlete/{id}/events.json`. The real
 * payload carries dozens of fields (training-load projections, nutrition
 * targets, sharing/permissions, ...) — only what
 * `mapIntervalsEventsToScheduledWorkouts` reads is modeled here. Confirmed
 * against a real account: `category` is "WORKOUT" for every event observed
 * (no NOTE/RACE_* seen), `oldest`/`newest` on the request are both
 * inclusive, and `start_date_local`/`end_date_local` are day-granularity
 * only (always midnight, no real time-of-day signal).
 */
export interface IntervalsEvent {
  id: number;
  /**
   * Not a closed enum on the API side. TrainIQ currently only understands
   * "WORKOUT" — every other value (e.g. NOTE, RACE_A) is left unmapped
   * rather than guessed at, since we have no real payload evidence for what
   * those mean.
   */
  category: string;
  /** Intervals.icu sport type, e.g. "Ride", "Run", "WeightTraining". Not a closed enum on the API side. */
  type?: string;
  name?: string;
  /** Local date/time, day-granularity in practice, e.g. "2026-09-22T00:00:00". */
  start_date_local: string;
  /** Planned duration in seconds. */
  moving_time?: number;
  /** Intervals.icu's modeled PLANNED training load for this event — stays the plan's value even once paired to a completed activity. */
  icu_training_load?: number;
  /** The matching `IntervalsActivity.id` once the athlete has completed this scheduled workout. */
  paired_activity_id?: string;
}
