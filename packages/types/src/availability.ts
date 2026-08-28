export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

import type { EnduranceSport } from "./athlete";

/** A recurring commitment that pins part (or all) of a day's session, e.g. a run club. */
export interface FixedCommitment {
  label: string;
  sport: EnduranceSport;
  durationMinutes: number;
}

export interface DayAvailability {
  isAvailable: boolean;
  maxDurationMinutes: number;
  fixedCommitment?: FixedCommitment;
}

export interface Availability {
  days: Record<DayOfWeek, DayAvailability>;
}
