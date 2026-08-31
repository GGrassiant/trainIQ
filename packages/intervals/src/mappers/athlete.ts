import type { AthleteIdentity } from "@trainiq/types";
import type { IntervalsAthlete } from "../api-types";

/**
 * Maps Intervals.icu's athlete profile to TrainIQ's athlete identity —
 * `id` and `name` only.
 *
 * Deliberately does not produce a full `Athlete`: Intervals.icu has no
 * concept of TrainIQ's planning sports, and this mapper must never infer or
 * decide them. Callers compose `sports` separately from TrainIQ-owned data.
 */
export function mapIntervalsAthlete(athlete: IntervalsAthlete): AthleteIdentity {
  return { id: athlete.id, name: athlete.name };
}
