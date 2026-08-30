import type { PlanningContext } from "@trainiq/types";
import { mockAthlete, mockAthleteGoals } from "./mock-athlete";
import { mockAvailability } from "./mock-availability";
import { mockWeather } from "./mock-weather";
import { mockTrainingLoad } from "./mock-training-load";
import { mockWorkoutLibrary } from "./mock-workout-library";

export function buildMockPlanningContext(): PlanningContext {
  return {
    weekStartDate: "2026-08-31",
    athlete: mockAthlete,
    goals: mockAthleteGoals,
    availability: mockAvailability,
    trainingLoad: mockTrainingLoad,
    weather: mockWeather,
    workoutLibrary: mockWorkoutLibrary,
  };
}
