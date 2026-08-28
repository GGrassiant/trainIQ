/** The two endurance disciplines TrainIQ plans around today. */
export type EnduranceSport = "cycling" | "running";

/**
 * Every modality a training day can carry. Strength is a complementary
 * modality, not a third endurance sport: it never counts toward the
 * "2 cycling + 2 running"-style endurance day quota.
 */
export type Sport = EnduranceSport | "strength";

export type GoalCategory = "performance" | "fitness" | "body-composition";

export interface AthleteGoal {
  id: string;
  label: string;
  category: GoalCategory;
  /** Whether this goal should currently drive session/focus selection, or just inform context. */
  priority: "primary" | "secondary";
  /** Endurance sport this goal is most associated with, if any. */
  sport?: EnduranceSport;
}

export interface Athlete {
  id: string;
  name: string;
  sports: EnduranceSport[];
}
