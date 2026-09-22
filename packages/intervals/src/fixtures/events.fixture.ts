import type { IntervalsEvent } from "../api-types";

/**
 * Anonymized, hand-written samples resembling the real
 * `GET /api/v1/athlete/0/events.json` response. Not real athlete data.
 */

/** A future, not-yet-completed scheduled ride: no paired_activity_id. */
export const scheduledRideEvent: IntervalsEvent = {
  id: 137241313,
  category: "WORKOUT",
  type: "Ride",
  name: "MAP",
  start_date_local: "2026-09-23T00:00:00",
  moving_time: 3600,
  icu_training_load: 70,
};

/** A past, completed scheduled run: paired to a completed activity, with planned values that differ from what actually happened. */
export const completedScheduledRunEvent: IntervalsEvent = {
  id: 137241043,
  category: "WORKOUT",
  type: "Run",
  name: "Run - Endurance",
  start_date_local: "2026-09-22T00:00:00",
  moving_time: 1800,
  icu_training_load: 32,
  paired_activity_id: "i189162915",
};

/** A scheduled strength session — Intervals.icu doesn't model training load for these the same way as endurance. */
export const scheduledStrengthEvent: IntervalsEvent = {
  id: 115193410,
  category: "WORKOUT",
  type: "WeightTraining",
  name: "Strength training",
  start_date_local: "2026-06-10T00:00:00",
  moving_time: 1200,
  paired_activity_id: "i156085769",
};

/** A calendar entry TrainIQ has no real payload evidence for the semantics of — must be skipped, not guessed at. */
export const unsupportedCategoryEvent: IntervalsEvent = {
  id: 999001,
  category: "NOTE",
  type: "Ride",
  name: "Race day nutrition reminder",
  start_date_local: "2026-09-25T00:00:00",
};
