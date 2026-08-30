import type { IntervalsWellnessEntry } from "../api-types";

/** Anonymized, hand-written sample resembling a real Intervals.icu wellness response. Not real athlete data. */
export const wellnessFixture: IntervalsWellnessEntry[] = [
  { id: "2026-08-20", ctl: 57.1, atl: 58.9 },
  { id: "2026-08-25", ctl: 58.4, atl: 61.2 },
  { id: "2026-08-27", ctl: 58.9, atl: 64.5 },
];

/** Entries with no ctl/atl at all — represents an athlete with no training-load history yet. */
export const wellnessFixtureMissingLoad: IntervalsWellnessEntry[] = [{ id: "2026-08-26" }, { id: "2026-08-27" }];
