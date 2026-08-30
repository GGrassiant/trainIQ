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
