import type {
  AthleteGoal,
  DayOfWeek,
  TrainingDay,
  TrainingLoadContext,
  WeatherCondition,
  WeatherContext,
} from "@trainiq/types";
import { formatTsb } from "./format-tsb";

const FAVORABLE_CONDITIONS: WeatherCondition[] = ["clear", "clouds"];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Composes the week's plain-language training rationale from a handful of
 * deterministic sentence templates — one per decision that actually applied
 * this week. No LLM: every sentence is a plain template filled from the
 * same data the engine used to build the plan.
 */
export function buildWeekSummary({
  enduranceDays,
  longestDay,
  weather,
  preferredGoal,
  trainingLoad,
  hardBudget,
  weatherAdjustedDays,
  strengthDay,
  strengthKeptApart,
}: {
  enduranceDays: TrainingDay[];
  longestDay: DayOfWeek | undefined;
  weather: WeatherContext;
  preferredGoal?: AthleteGoal;
  trainingLoad: TrainingLoadContext;
  hardBudget: number;
  weatherAdjustedDays: DayOfWeek[];
  strengthDay?: TrainingDay;
  strengthKeptApart: boolean;
}): string {
  const longestSession = longestDay ? enduranceDays.find((d) => d.dayOfWeek === longestDay) : undefined;
  const longestSentence =
    longestSession && longestDay
      ? [
          `${capitalize(longestDay)} is your longest available window` +
            (FAVORABLE_CONDITIONS.includes(weather.days[longestDay].condition) ? " and the weather is favorable" : "") +
            `, so we placed your longer ${longestSession.sport} session there.`,
        ]
      : [];

  const fixedDay = enduranceDays.find((d) => d.status === "fixed");
  const fixedSentence = fixedDay && fixedDay.status === "fixed"
    ? [`The ${fixedDay.label} provides your fixed ${fixedDay.sport} session.`]
    : [];

  const qualityDays = enduranceDays.filter(
    (d) => d.status === "recommended" && (d.workout.intensity === "hard" || d.workout.intensity === "very-hard")
  );
  const qualitySentences = qualityDays.map((d) => {
    const workoutName = d.status === "recommended" ? d.workout.name : "";
    return preferredGoal && d.sport === preferredGoal.sport
      ? `${capitalize(d.dayOfWeek)}'s ${workoutName} is your ${d.sport} quality session, chosen to support your ${preferredGoal.label} goal.`
      : `${capitalize(d.dayOfWeek)}'s ${workoutName} is your ${d.sport} quality session this week.`;
  });
  const recoverySentence =
    qualityDays.length >= 2 ? ["The quality sessions are kept apart to allow recovery between hard efforts."] : [];

  const noQualitySentence: string[] = [];
  if (qualityDays.length === 0 && weatherAdjustedDays.length > 0) {
    const day = weatherAdjustedDays[0];
    noQualitySentence.push(
      `A planned quality effort on ${capitalize(day)} was swapped for an easier session due to ${weather.days[day].condition} in the forecast.`
    );
  } else if (qualityDays.length === 0 && hardBudget === 0) {
    noQualitySentence.push(
      `Current form (TSB ${formatTsb(trainingLoad.tsb)}) is low, so hard sessions were avoided this week to support recovery.`
    );
  }

  const strengthSentence =
    strengthDay && strengthDay.status === "recommended"
      ? [
          `${capitalize(strengthDay.dayOfWeek)}'s ${strengthDay.workout.name} adds a complementary strength session` +
            (strengthKeptApart ? ", kept apart from your harder endurance days." : "."),
        ]
      : [];

  return [...longestSentence, ...fixedSentence, ...qualitySentences, ...recoverySentence, ...noQualitySentence, ...strengthSentence].join(
    " "
  );
}
