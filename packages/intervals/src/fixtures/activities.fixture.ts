import type { IntervalsActivity } from "../api-types";

/**
 * Anonymized, hand-written sample resembling a real Intervals.icu activities
 * response. Not real athlete data. Includes a supported ride, a supported
 * run, an unsupported sport (Swim), and an activity missing `moving_time`.
 */
export const activitiesFixture: IntervalsActivity[] = [
  {
    id: "a1",
    start_date_local: "2026-08-22T07:15:00",
    type: "Ride",
    moving_time: 9900,
    distance: 82000,
    icu_distance: 82000,
    icu_training_load: 78,
    icu_intensity: 62,
  },
  {
    id: "a2",
    start_date_local: "2026-08-24T18:00:00",
    type: "Run",
    moving_time: 3300,
    icu_training_load: 51,
    icu_intensity: 70,
  },
  {
    id: "a3",
    start_date_local: "2026-08-25T06:30:00",
    type: "Swim",
    moving_time: 1800,
  },
  {
    id: "a4",
    start_date_local: "2026-08-26T12:00:00",
    type: "Ride",
  },
];
