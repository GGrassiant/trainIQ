import { DAYS_OF_WEEK } from "@trainiq/types";
import type { Availability, DayOfWeek } from "@trainiq/types";

export const TARGET_TRAINING_DAYS = 4;

const isWeekend = (day: DayOfWeek): boolean => day === "saturday" || day === "sunday";

/**
 * Picks ~4 training days: any fixed commitments (e.g. a running club) are
 * always included, then the remaining slots are filled from available days,
 * preferring weekend days and longer availability windows.
 */
export function selectTrainingDays(availability: Availability): DayOfWeek[] {
  const availableDays = DAYS_OF_WEEK.filter((day) => availability.days[day].isAvailable);
  const fixedDays = availableDays.filter((day) => availability.days[day].fixedCommitment);
  const flexibleDays = availableDays.filter((day) => !availability.days[day].fixedCommitment);

  const remainingSlots = Math.max(0, TARGET_TRAINING_DAYS - fixedDays.length);

  const rankedFlexibleDays = [...flexibleDays].sort((a, b) => {
    if (isWeekend(a) !== isWeekend(b)) return isWeekend(a) ? -1 : 1;
    return availability.days[b].maxDurationMinutes - availability.days[a].maxDurationMinutes;
  });

  const chosenFlexibleDays = new Set(rankedFlexibleDays.slice(0, remainingSlots));

  return DAYS_OF_WEEK.filter((day) => fixedDays.includes(day) || chosenFlexibleDays.has(day));
}

/**
 * The selected day with the most available time — the week's long session.
 * Returns undefined when there are no selected days (e.g. no availability
 * at all this week) rather than throwing on an empty reduce.
 */
export function findLongestSessionDay(selectedDays: DayOfWeek[], availability: Availability): DayOfWeek | undefined {
  if (selectedDays.length === 0) return undefined;
  return selectedDays.reduce((longest, day) =>
    availability.days[day].maxDurationMinutes > availability.days[longest].maxDurationMinutes ? day : longest
  );
}

/** Matches the shortest strength workout in the mock library, so a candidate day always has something that fits. */
const MIN_STRENGTH_MINUTES = 30;

/**
 * Picks at most one day for a complementary strength session, from
 * whatever availability the endurance days didn't already use. Strength is
 * optional — this returns undefined when no day has both spare
 * availability and enough time for even a short session. Among candidates,
 * a day that isn't calendar-adjacent to a hard endurance day is preferred,
 * so strength doesn't compound fatigue right before or after a quality
 * session.
 */
export function selectStrengthDay(
  enduranceDays: DayOfWeek[],
  availability: Availability,
  hardDays: Set<DayOfWeek>
): DayOfWeek | undefined {
  const candidates = DAYS_OF_WEEK.filter(
    (day) =>
      !enduranceDays.includes(day) &&
      availability.days[day].isAvailable &&
      availability.days[day].maxDurationMinutes >= MIN_STRENGTH_MINUTES
  );

  const isCalendarAdjacentToHardDay = (day: DayOfWeek) =>
    [...hardDays].some((hardDay) => Math.abs(DAYS_OF_WEEK.indexOf(day) - DAYS_OF_WEEK.indexOf(hardDay)) === 1);

  const restfulCandidate = candidates.find((day) => !isCalendarAdjacentToHardDay(day));

  return restfulCandidate ?? candidates[0];
}
