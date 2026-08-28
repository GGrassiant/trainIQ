import { DAYS_OF_WEEK } from "@trainiq/types";
import type {
  Availability,
  AthleteGoal,
  DayOfWeek,
  EnduranceSport,
  TrainingLoadContext,
  WeatherContext,
  WorkoutIntensity,
} from "@trainiq/types";
import { primaryGoalSport } from "./goals";

export interface DayIntensityPlan {
  targetIntensity: WorkoutIntensity;
  weatherAdjusted: boolean;
}

/** Fatigued athletes get no hard sessions; fresh athletes get up to two. */
export function hardSessionBudget(tsb: number): number {
  if (tsb < -10) return 0;
  if (tsb < 5) return 1;
  return 2;
}

/** Days whose sport matches the athlete's primary goal are ranked first for the hard/"quality" slot(s). */
function compareHardCandidates(aMatchesGoal: boolean, bMatchesGoal: boolean): number {
  if (aMatchesGoal === bMatchesGoal) return 0;
  if (aMatchesGoal) return -1;
  return 1;
}

/** Outdoor structured cycling efforts get downgraded to an easy ride in poor weather. */
function adjustForWeather(
  sport: EnduranceSport,
  intensity: WorkoutIntensity,
  condition: WeatherContext["days"][DayOfWeek]["condition"]
): { intensity: WorkoutIntensity; adjusted: boolean } {
  const isHard = intensity === "hard" || intensity === "very-hard";
  const isPoorWeather = condition === "rain" || condition === "wind";
  return sport === "cycling" && isHard && isPoorWeather
    ? { intensity: "easy", adjusted: true }
    : { intensity, adjusted: false };
}

function resolveBaseIntensity(
  day: DayOfWeek,
  longestDay: DayOfWeek | undefined,
  availability: Availability,
  hardDays: Set<DayOfWeek>
): WorkoutIntensity {
  if (availability.days[day].fixedCommitment || day === longestDay) return "easy";
  if (hardDays.has(day)) return "hard";
  return "moderate";
}

/** Never let two hard/very-hard sessions land on consecutive calendar days. */
function demoteAdjacentHardDays(selectedDays: DayOfWeek[], hardDays: Set<DayOfWeek>): Set<DayOfWeek> {
  const ordered = DAYS_OF_WEEK.filter((day) => selectedDays.includes(day));

  const { kept } = ordered.reduce<{ kept: DayOfWeek[]; previous?: DayOfWeek; previousSurvived: boolean }>(
    (acc, day) => {
      const isCandidate = hardDays.has(day);
      const isCalendarAdjacent =
        acc.previous !== undefined && DAYS_OF_WEEK.indexOf(day) - DAYS_OF_WEEK.indexOf(acc.previous) === 1;
      const survives = isCandidate && !(isCalendarAdjacent && acc.previousSurvived);

      return {
        kept: survives ? [...acc.kept, day] : acc.kept,
        previous: day,
        previousSurvived: survives,
      };
    },
    { kept: [], previousSurvived: false }
  );

  return new Set(kept);
}

export function planIntensity({
  selectedDays,
  sportByDay,
  availability,
  trainingLoad,
  weather,
  goals,
  longestDay,
}: {
  selectedDays: DayOfWeek[];
  sportByDay: Record<DayOfWeek, EnduranceSport>;
  availability: Availability;
  trainingLoad: TrainingLoadContext;
  weather: WeatherContext;
  goals: AthleteGoal[];
  longestDay: DayOfWeek | undefined;
}): Record<DayOfWeek, DayIntensityPlan> {
  const budget = hardSessionBudget(trainingLoad.tsb);
  const preferredSport = primaryGoalSport(goals);

  const hardCandidates = selectedDays.filter(
    (day) => day !== longestDay && !availability.days[day].fixedCommitment
  );
  const rankedHardCandidates = [...hardCandidates].sort((a, b) =>
    compareHardCandidates(sportByDay[a] === preferredSport, sportByDay[b] === preferredSport)
  );

  const hardDays = demoteAdjacentHardDays(selectedDays, new Set(rankedHardCandidates.slice(0, budget)));

  return Object.fromEntries(
    selectedDays.map((day) => {
      const baseIntensity = resolveBaseIntensity(day, longestDay, availability, hardDays);
      const { intensity, adjusted } = adjustForWeather(sportByDay[day], baseIntensity, weather.days[day].condition);
      return [day, { targetIntensity: intensity, weatherAdjusted: adjusted }] as const;
    })
  ) as Record<DayOfWeek, DayIntensityPlan>;
}
