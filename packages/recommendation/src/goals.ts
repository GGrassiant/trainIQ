import type { AthleteGoal, EnduranceSport } from "@trainiq/types";

/**
 * The athlete's primary goal, if it's tied to an endurance sport. This is
 * what should currently bias day/session allocation — secondary goals
 * (fitness, body composition) inform context but don't drive sport bias.
 */
export function primaryEnduranceGoal(goals: AthleteGoal[]): AthleteGoal | undefined {
  return goals.find((goal) => goal.priority === "primary" && goal.sport !== undefined);
}

/** The endurance sport (if any) tied to the athlete's primary goal. */
export function primaryGoalSport(goals: AthleteGoal[]): EnduranceSport | undefined {
  return primaryEnduranceGoal(goals)?.sport;
}
