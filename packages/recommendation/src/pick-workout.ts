import type { Sport, Workout, WorkoutFocus, WorkoutIntensity } from "@trainiq/types";

export type PickWorkoutResult =
  | { found: true; workout: Workout; avoidedRepeat: boolean }
  | { found: false; reason: string };

const INTENSITY_TIERS: WorkoutIntensity[] = ["easy", "moderate", "hard", "very-hard"];

function rankByFocusThenDuration(focusPriority: WorkoutFocus[]) {
  return (a: Workout, b: Workout) => {
    const aRank = focusPriority.indexOf(a.focus);
    const bRank = focusPriority.indexOf(b.focus);
    const aScore = aRank === -1 ? focusPriority.length : aRank;
    const bScore = bRank === -1 ? focusPriority.length : bRank;
    if (aScore !== bScore) return aScore - bScore;
    return b.durationMinutes - a.durationMinutes;
  };
}

function findMatching(
  sport: Sport,
  intensity: WorkoutIntensity,
  maxDurationMinutes: number,
  library: Workout[],
  focusPriority: WorkoutFocus[]
): Workout[] {
  return library
    .filter((w) => w.sport === sport && w.intensity === intensity && w.durationMinutes <= maxDurationMinutes)
    .sort(rankByFocusThenDuration(focusPriority));
}

/** Explains, as precisely as possible, which constraint blocked a match — checked in the order a person would diagnose it. */
function describeNoMatch(sport: Sport, intensity: WorkoutIntensity, maxDurationMinutes: number, library: Workout[]): string {
  if (library.length === 0) {
    return "The workout library is empty.";
  }
  const sameSport = library.filter((w) => w.sport === sport);
  if (sameSport.length === 0) {
    return `No ${sport} workouts exist in the workout library.`;
  }
  const fitsDuration = sameSport.filter((w) => w.durationMinutes <= maxDurationMinutes);
  if (fitsDuration.length === 0) {
    return `No existing ${sport} workout fits within ${maxDurationMinutes} min.`;
  }
  return `No existing ${sport} workout matches ${intensity} intensity within ${maxDurationMinutes} min.`;
}

/**
 * Selects an existing workout matching the sport and target intensity that
 * best uses the available time. When several fit equally well, `focusPriority`
 * breaks the tie toward a training focus that supports the athlete's goals
 * (e.g. sweet-spot/threshold over VO2max for a climbing goal). When
 * `excludeWorkoutId` is set (the previous day's workout, if calendar-adjacent),
 * that workout is avoided in favor of another equally-eligible option — but
 * only when one exists, since a session should never be dropped just to
 * avoid a repeat.
 *
 * If the sport has no workout at the exact target tier (e.g. no "moderate"
 * cycling workout exists in the library), steps down one tier before giving
 * up — a missing "moderate" ride falls back to an easy endurance ride. If
 * still nothing fits, this returns `found: false` with a plain-language
 * reason instead of inventing a workout or throwing: not finding a suitable
 * existing workout is an expected, representable outcome, not a bug.
 */
export function pickWorkout({
  sport,
  intensity,
  maxDurationMinutes,
  library,
  focusPriority = [],
  excludeWorkoutId,
}: {
  sport: Sport;
  intensity: WorkoutIntensity;
  maxDurationMinutes: number;
  library: Workout[];
  focusPriority?: WorkoutFocus[];
  excludeWorkoutId?: string;
}): PickWorkoutResult {
  const exactMatches = findMatching(sport, intensity, maxDurationMinutes, library, focusPriority);

  const tierIndex = INTENSITY_TIERS.indexOf(intensity);
  const easierTierMatches =
    exactMatches.length === 0 && tierIndex > 0
      ? findMatching(sport, INTENSITY_TIERS[tierIndex - 1], maxDurationMinutes, library, focusPriority)
      : [];

  const matching = exactMatches.length > 0 ? exactMatches : easierTierMatches;

  if (matching.length === 0) {
    return { found: false, reason: describeNoMatch(sport, intensity, maxDurationMinutes, library) };
  }

  const withoutRepeat = matching.filter((w) => w.id !== excludeWorkoutId);
  const workout = withoutRepeat[0] ?? matching[0];

  return { found: true, workout, avoidedRepeat: workout.id !== matching[0].id };
}
