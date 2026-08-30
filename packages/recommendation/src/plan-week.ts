import { DAYS_OF_WEEK } from "@trainiq/types";
import type {
  DayOfWeek,
  EnduranceSport,
  PlanningContext,
  RecommendedTrainingDay,
  TrainingDay,
  WeeklyPlan,
  WorkoutFocus,
  WorkoutIntensity,
} from "@trainiq/types";
import { selectTrainingDays, findLongestSessionDay, selectStrengthDay, TARGET_TRAINING_DAYS } from "./select-training-days";
import { assignSports } from "./assign-sports";
import { planIntensity, hardSessionBudget } from "./plan-intensity";
import { pickWorkout } from "./pick-workout";
import { buildReasoning, buildFixedCommitmentReasoning } from "./build-reasoning";
import { buildWeekSummary } from "./build-week-summary";
import { primaryEnduranceGoal } from "./goals";

/** Training focuses that best support each sport's climbing/quality goal, preferred over other equally-fitting workouts. */
const GOAL_ALIGNED_FOCUS: Record<EnduranceSport, WorkoutFocus[]> = {
  cycling: ["sweet-spot", "threshold", "over-under"],
  running: ["threshold", "tempo"],
};

const STRENGTH_MODERATE_MINUTES = 45;

/** Vitest sets this for every test run, so `planWeek()`'s debug logs stay out of test output without extra config. */
const DEBUG_LOGS_ENABLED = process.env.VITEST === undefined;

function logStage(stage: string, data?: unknown): void {
  if (!DEBUG_LOGS_ENABLED) return;
  if (data === undefined) {
    console.log(`[TrainIQ] ${stage}`);
  } else {
    console.log(`[TrainIQ] ${stage}`, data);
  }
}

/** The workout id a day actually used, if it recommended one — nothing to avoid-repeat against for fixed/unresolved days. */
function usedWorkoutId(day: TrainingDay): string | undefined {
  return day.status === "recommended" ? day.workout.id : undefined;
}

function isQualityDay(day: TrainingDay): day is RecommendedTrainingDay {
  return day.status === "recommended" && (day.workout.intensity === "hard" || day.workout.intensity === "very-hard");
}

/**
 * Deterministically builds a proposed training week from the given context.
 * No LLM involved — every decision is a simple, explicit, inspectable rule.
 *
 * The planner never throws on an impossible request. When availability
 * can't support the ~4 day endurance target, or no library workout fits a
 * day's constraints, that's represented explicitly (`unmetRequirements`, or
 * an `UnresolvedTrainingDay`) rather than crashing, inventing a session, or
 * silently returning fewer days without saying why.
 */
export function planWeek(context: PlanningContext): WeeklyPlan {
  logStage("planWeek:start", { weekStartDate: context.weekStartDate });

  const { availability, weather, trainingLoad, goals, workoutLibrary, weekStartDate } = context;

  const selectedDays = selectTrainingDays(availability);
  logStage("selectTrainingDays", { selectedDays });

  const longestDay = findLongestSessionDay(selectedDays, availability);
  logStage("findLongestSessionDay", { longestDay });

  const sportByDay = assignSports({ selectedDays, availability, goals });
  logStage("assignSports", { sportByDay });

  const intensityByDay = planIntensity({
    selectedDays,
    sportByDay,
    availability,
    trainingLoad,
    weather,
    goals,
    longestDay,
  });
  logStage("planIntensity", {
    intensityByDay: Object.fromEntries(selectedDays.map((day) => [day, intensityByDay[day].targetIntensity])),
  });

  const preferredGoal = primaryEnduranceGoal(goals);
  logStage("primaryEnduranceGoal", { sport: preferredGoal?.sport });

  const enduranceDays = selectedDays.reduce<{ days: TrainingDay[]; previous?: TrainingDay }>(
    (acc, day) => {
      const sport = sportByDay[day];
      const dayAvailability = availability.days[day];
      const { targetIntensity, weatherAdjusted } = intensityByDay[day];

      const fixedCommitment = dayAvailability.fixedCommitment;
      if (fixedCommitment) {
        const trainingDay: TrainingDay = {
          dayOfWeek: day,
          status: "fixed",
          sport: fixedCommitment.sport,
          label: fixedCommitment.label,
          durationMinutes: fixedCommitment.durationMinutes,
          reasoning: buildFixedCommitmentReasoning(fixedCommitment, dayAvailability),
        };
        return { days: [...acc.days, trainingDay], previous: trainingDay };
      }

      const isCalendarAdjacentToPrevious =
        acc.previous !== undefined && DAYS_OF_WEEK.indexOf(day) - DAYS_OF_WEEK.indexOf(acc.previous.dayOfWeek) === 1;

      const result = pickWorkout({
        sport,
        intensity: targetIntensity,
        maxDurationMinutes: dayAvailability.maxDurationMinutes,
        library: workoutLibrary,
        focusPriority: preferredGoal && sport === preferredGoal.sport ? GOAL_ALIGNED_FOCUS[sport] : undefined,
        excludeWorkoutId: isCalendarAdjacentToPrevious ? usedWorkoutId(acc.previous!) : undefined,
      });

      if (!result.found) {
        const trainingDay: TrainingDay = {
          dayOfWeek: day,
          status: "unresolved",
          sport,
          durationMinutes: dayAvailability.maxDurationMinutes,
          reason: result.reason,
        };
        return { days: [...acc.days, trainingDay], previous: trainingDay };
      }

      const { workout, avoidedRepeat } = result;
      const isQuality = workout.intensity === "hard" || workout.intensity === "very-hard";
      const goalLabel = isQuality && preferredGoal && sport === preferredGoal.sport ? preferredGoal.label : undefined;

      const reasoning = buildReasoning({
        workout,
        dayAvailability,
        dayWeather: weather.days[day],
        isLongestDay: day === longestDay,
        weatherAdjusted,
        trainingLoad,
        goalLabel,
        avoidedRepeat,
      });

      const trainingDay: TrainingDay = {
        dayOfWeek: day,
        status: "recommended",
        sport,
        workout,
        durationMinutes: workout.durationMinutes,
        reasoning,
      };

      return { days: [...acc.days, trainingDay], previous: trainingDay };
    },
    { days: [] }
  ).days;
  logStage("buildTrainingDays", {
    statusByDay: Object.fromEntries(enduranceDays.map((d) => [d.dayOfWeek, d.status])),
  });

  const hardDays = new Set(enduranceDays.filter(isQualityDay).map((d) => d.dayOfWeek));

  const strengthDayOfWeek = selectStrengthDay(selectedDays, availability, hardDays);
  logStage("selectStrengthDay", { strengthDayOfWeek });

  const strengthDay = strengthDayOfWeek ? buildStrengthDay(strengthDayOfWeek, context) : undefined;
  const strengthKeptApart =
    strengthDayOfWeek !== undefined &&
    ![...hardDays].some((hardDay) => Math.abs(DAYS_OF_WEEK.indexOf(strengthDayOfWeek) - DAYS_OF_WEEK.indexOf(hardDay)) === 1);

  const days = DAYS_OF_WEEK.filter((day) => selectedDays.includes(day) || day === strengthDayOfWeek).map(
    (day) => (day === strengthDayOfWeek ? strengthDay! : enduranceDays.find((d) => d.dayOfWeek === day)!)
  );

  const plannedEnduranceDays = enduranceDays.filter((d) => d.status !== "unresolved");
  const scheduledDays = days.filter((d) => d.status !== "unresolved");
  const totalDurationMinutes = scheduledDays.reduce((sum, d) => sum + d.durationMinutes, 0);
  const cyclingDays = plannedEnduranceDays.filter((d) => d.sport === "cycling").length;
  const runningDays = plannedEnduranceDays.filter((d) => d.sport === "running").length;

  const summary =
    `${plannedEnduranceDays.length} endurance training days this week (${cyclingDays} cycling, ${runningDays} running)` +
    (strengthDay && strengthDay.status === "recommended" ? " plus 1 strength session" : "") +
    `, about ${Math.round((totalDurationMinutes / 60) * 10) / 10} hours total.`;

  const unmetRequirements = buildUnmetRequirements(selectedDays.length);

  const rationale = buildWeekSummary({
    enduranceDays,
    longestDay,
    weather,
    preferredGoal,
    trainingLoad,
    hardBudget: hardSessionBudget(trainingLoad.tsb),
    weatherAdjustedDays: selectedDays.filter((day) => intensityByDay[day].weatherAdjusted),
    strengthDay,
    strengthKeptApart,
  });
  logStage("buildWeekSummary", { summary });

  logStage("planWeek:complete", {
    totalTrainingDays: plannedEnduranceDays.length,
    totalDurationMinutes,
  });

  return {
    weekStartDate,
    days,
    totalTrainingDays: plannedEnduranceDays.length,
    totalDurationMinutes,
    summary,
    rationale,
    unmetRequirements,
  };
}

/** Explains any gap between the ~4 day endurance target and what availability could actually support. */
function buildUnmetRequirements(scheduledDayCount: number): string[] {
  if (scheduledDayCount >= TARGET_TRAINING_DAYS) return [];

  if (scheduledDayCount === 0) {
    return [
      `No endurance training days could be scheduled this week — none of the week's days are marked available. ` +
        `The target is ${TARGET_TRAINING_DAYS} endurance training days.`,
    ];
  }

  const missing = TARGET_TRAINING_DAYS - scheduledDayCount;
  return [
    `Only ${scheduledDayCount} of the ${TARGET_TRAINING_DAYS} target endurance training days could be scheduled given ` +
      `current availability (${missing} fewer session${missing === 1 ? "" : "s"} than planned).`,
  ];
}

function buildStrengthDay(day: DayOfWeek, context: PlanningContext): TrainingDay {
  const { availability, weather, trainingLoad, workoutLibrary } = context;
  const dayAvailability = availability.days[day];
  const intensity: WorkoutIntensity = dayAvailability.maxDurationMinutes >= STRENGTH_MODERATE_MINUTES ? "moderate" : "easy";

  const result = pickWorkout({
    sport: "strength",
    intensity,
    maxDurationMinutes: dayAvailability.maxDurationMinutes,
    library: workoutLibrary,
  });

  if (!result.found) {
    return {
      dayOfWeek: day,
      status: "unresolved",
      sport: "strength",
      durationMinutes: dayAvailability.maxDurationMinutes,
      reason: result.reason,
    };
  }

  const { workout } = result;
  const reasoning = buildReasoning({
    workout,
    dayAvailability,
    dayWeather: weather.days[day],
    isLongestDay: false,
    weatherAdjusted: false,
    trainingLoad,
  });

  return { dayOfWeek: day, status: "recommended", sport: "strength", workout, durationMinutes: workout.durationMinutes, reasoning };
}
