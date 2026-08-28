import type { TrainingLoadContext } from "@trainiq/types";

/**
 * Slightly fatigued but not depleted: CTL 58 / ATL 64 / TSB -6.
 * Recent sessions cover the 7 days before this planning week.
 */
export const mockTrainingLoad: TrainingLoadContext = {
  ctl: 58,
  atl: 64,
  tsb: -6,
  recentSessions: [
    { date: "2026-08-22", sport: "cycling", durationMinutes: 165, intensity: 4, fatigueCost: 6 },
    { date: "2026-08-24", sport: "running", durationMinutes: 55, intensity: 3, fatigueCost: 4 },
    { date: "2026-08-25", sport: "cycling", durationMinutes: 70, intensity: 7, fatigueCost: 7 },
    { date: "2026-08-26", sport: "running", durationMinutes: 40, intensity: 6, fatigueCost: 5 },
    { date: "2026-08-27", sport: "cycling", durationMinutes: 60, intensity: 3, fatigueCost: 3 },
  ],
};
