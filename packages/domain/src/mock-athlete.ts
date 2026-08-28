import type { Athlete, AthleteGoal } from "@trainiq/types";

export const mockAthlete: Athlete = {
  id: "athlete-1",
  name: "Alex Morgan",
  sports: ["cycling", "running"],
};

export const mockAthleteGoals: AthleteGoal[] = [
  {
    id: "climbing-performance",
    label: "cycling climbing performance",
    category: "performance",
    priority: "primary",
    sport: "cycling",
  },
  {
    id: "cardiovascular-fitness",
    label: "cardiovascular fitness",
    category: "fitness",
    priority: "secondary",
  },
  {
    id: "body-composition",
    label: "body composition",
    category: "body-composition",
    priority: "secondary",
  },
];
