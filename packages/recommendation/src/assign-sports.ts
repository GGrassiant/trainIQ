import type { Availability, AthleteGoal, DayOfWeek, EnduranceSport } from "@trainiq/types";
import { primaryGoalSport } from "./goals";

const DEFAULT_SPORT_QUOTA: Record<EnduranceSport, number> = { cycling: 2, running: 2 };
const LONG_SLOT_MINUTES = 90;
const EXTRA_SLOTS_REQUIRED_FOR_BUMP = 3;

function nextSportWithQuota(
  quota: Record<EnduranceSport, number>,
  primary: EnduranceSport,
  secondary: EnduranceSport
): EnduranceSport {
  if (quota[primary] > 0) return primary;
  if (quota[secondary] > 0) return secondary;
  return primary;
}

/**
 * Splits selected endurance days between cycling and running: fixed
 * commitments keep their sport, then the default is 2+2. Whichever sport is
 * tied to the athlete's primary goal (if any) is biased toward the bigger
 * flexible slots, and can bump the split to 3+1 when there's enough
 * long-duration capacity to actually support it.
 */
export function assignSports({
  selectedDays,
  availability,
  goals,
}: {
  selectedDays: DayOfWeek[];
  availability: Availability;
  goals: AthleteGoal[];
}): Record<DayOfWeek, EnduranceSport> {
  const fixedDays = selectedDays.filter((day) => availability.days[day].fixedCommitment);
  const flexibleDays = selectedDays.filter((day) => !availability.days[day].fixedCommitment);

  const { assignment: fixedAssignment, quota: quotaAfterFixed } = fixedDays.reduce(
    (acc, day) => {
      const sport = availability.days[day].fixedCommitment!.sport;
      return {
        assignment: { ...acc.assignment, [day]: sport },
        quota: { ...acc.quota, [sport]: acc.quota[sport] - 1 },
      };
    },
    { assignment: {} as Record<DayOfWeek, EnduranceSport>, quota: { ...DEFAULT_SPORT_QUOTA } }
  );

  const primary: EnduranceSport = primaryGoalSport(goals) ?? "running";
  const secondary: EnduranceSport = primary === "cycling" ? "running" : "cycling";

  const longFlexibleSlots = flexibleDays.filter(
    (day) => availability.days[day].maxDurationMinutes >= LONG_SLOT_MINUTES
  ).length;
  const shouldBumpPrimary = quotaAfterFixed[secondary] > 0 && longFlexibleSlots >= EXTRA_SLOTS_REQUIRED_FOR_BUMP;

  const startingQuota = shouldBumpPrimary
    ? { ...quotaAfterFixed, [primary]: quotaAfterFixed[primary] + 1, [secondary]: quotaAfterFixed[secondary] - 1 }
    : quotaAfterFixed;

  const rankedFlexibleDays = [...flexibleDays].sort(
    (a, b) => availability.days[b].maxDurationMinutes - availability.days[a].maxDurationMinutes
  );

  const { assignment: flexibleAssignment } = rankedFlexibleDays.reduce(
    (acc, day) => {
      const sport = nextSportWithQuota(acc.quota, primary, secondary);
      return {
        assignment: { ...acc.assignment, [day]: sport },
        quota: { ...acc.quota, [sport]: acc.quota[sport] - 1 },
      };
    },
    { assignment: {} as Record<DayOfWeek, EnduranceSport>, quota: startingQuota }
  );

  return { ...fixedAssignment, ...flexibleAssignment };
}
