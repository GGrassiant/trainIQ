import type { IntervalsWellnessEntry } from "../api-types";

export interface TrainingLoadFromWellness {
  ctl: number;
  atl: number;
  /** Derived as ctl - atl. Intervals.icu's wellness response does not include TSB directly. */
  tsb: number;
}

export type WellnessMappingResult = { ok: true; trainingLoad: TrainingLoadFromWellness } | { ok: false; reason: string };

/**
 * Selects the most recent wellness entry that has both `ctl` and `atl`, and
 * derives `tsb = ctl - atl` explicitly (Intervals.icu never returns TSB).
 *
 * The wellness response isn't guaranteed to be sorted, and a given day's
 * entry may be missing `ctl`/`atl` (e.g. before enough training history
 * exists), so both are handled explicitly rather than assumed — this
 * returns `ok: false` instead of crashing or inventing a value.
 */
export function mapWellnessToTrainingLoad(entries: IntervalsWellnessEntry[]): WellnessMappingResult {
  if (entries.length === 0) {
    return { ok: false, reason: "Intervals.icu returned no wellness entries." };
  }

  const withLoad = entries.filter((entry): entry is IntervalsWellnessEntry & { ctl: number; atl: number } => {
    return entry.ctl !== undefined && entry.atl !== undefined;
  });

  if (withLoad.length === 0) {
    return { ok: false, reason: "No wellness entry in range has both ctl and atl." };
  }

  const latest = [...withLoad].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))[0];

  return {
    ok: true,
    trainingLoad: { ctl: latest.ctl, atl: latest.atl, tsb: latest.ctl - latest.atl },
  };
}
