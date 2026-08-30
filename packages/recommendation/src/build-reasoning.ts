import type { Availability, DayOfWeek, DayWeather, FixedCommitment, TrainingLoadContext, Workout } from "@trainiq/types";

/** Reasoning for a fixed commitment day — it's a real calendar fact, not a scored recommendation. */
export function buildFixedCommitmentReasoning(
  commitment: FixedCommitment,
  dayAvailability: Availability["days"][DayOfWeek]
): string[] {
  return [
    `Recurring commitment: ${commitment.label}.`,
    `Fits within today's ${dayAvailability.maxDurationMinutes} min availability.`,
  ];
}

function buildIntensityReason(
  workout: Workout,
  weatherAdjusted: boolean,
  dayWeather: DayWeather,
  trainingLoad: TrainingLoadContext,
  goalLabel: string | undefined
): string[] {
  if (weatherAdjusted) {
    const cause = dayWeather.condition === "rain" ? "Rain" : "Wind";
    return [`${cause} in the forecast — swapped a structured effort for an easier ride.`];
  }
  if (workout.intensity === "hard" || workout.intensity === "very-hard") {
    return goalLabel
      ? [`This is your quality session, chosen to support your ${goalLabel} goal.`]
      : [`Current form (TSB ${trainingLoad.tsb}) supported one focused, harder effort this week.`];
  }
  return [];
}

/** Reasoning for a recommended (library-matched) day. */
export function buildReasoning({
  workout,
  dayAvailability,
  dayWeather,
  isLongestDay,
  weatherAdjusted,
  trainingLoad,
  goalLabel,
  avoidedRepeat,
}: {
  workout: Workout;
  dayAvailability: Availability["days"][DayOfWeek];
  dayWeather: DayWeather;
  isLongestDay: boolean;
  weatherAdjusted: boolean;
  trainingLoad: TrainingLoadContext;
  /** Set when this day's workout is the one supporting the athlete's primary goal. */
  goalLabel?: string;
  /** Set when a same-workout repeat from the previous day was avoided. */
  avoidedRepeat?: boolean;
}): string[] {
  const longestDayReason = isLongestDay
    ? ["Longest session of the week, placed on the weekend to match your availability."]
    : [];

  const intensityReason = buildIntensityReason(workout, weatherAdjusted, dayWeather, trainingLoad, goalLabel);

  const lowLoadReason =
    trainingLoad.tsb < -10 && (workout.intensity === "easy" || workout.intensity === "moderate")
      ? [`Recent training load is high (TSB ${trainingLoad.tsb}), so intensity was kept low.`]
      : [];

  const strengthReason =
    workout.sport === "strength" ? ["Complementary strength work, kept light relative to your endurance sessions."] : [];

  const avoidedRepeatReason = avoidedRepeat
    ? ["Varied from the previous day's session to avoid repeating the same workout two days in a row."]
    : [];

  const durationReason = [`Fits within today's ${dayAvailability.maxDurationMinutes} min availability.`];

  return [
    ...longestDayReason,
    ...intensityReason,
    ...lowLoadReason,
    ...strengthReason,
    ...avoidedRepeatReason,
    ...durationReason,
  ];
}
