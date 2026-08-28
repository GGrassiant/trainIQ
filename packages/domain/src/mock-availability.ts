import type { Availability } from "@trainiq/types";

/**
 * ~4 endurance training days/week: a fixed Tuesday running club, one midweek
 * slot, and a bigger Saturday/Sunday weekend window (2-3h) — plus a short
 * Monday window that's too small for a full endurance session but works for
 * a complementary strength session.
 */
export const mockAvailability: Availability = {
  days: {
    monday: { isAvailable: true, maxDurationMinutes: 45 },
    tuesday: {
      isAvailable: true,
      maxDurationMinutes: 60,
      fixedCommitment: {
        label: "Tuesday morning running club",
        sport: "running",
        durationMinutes: 60,
      },
    },
    wednesday: { isAvailable: true, maxDurationMinutes: 75 },
    thursday: { isAvailable: false, maxDurationMinutes: 0 },
    friday: { isAvailable: false, maxDurationMinutes: 0 },
    saturday: { isAvailable: true, maxDurationMinutes: 150 },
    sunday: { isAvailable: true, maxDurationMinutes: 180 },
  },
};
