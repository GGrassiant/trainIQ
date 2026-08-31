import { describe, expect, it } from "vitest";
import type { RecommendedTrainingDay, TrainingDay, TrainingLoadContext, WeatherContext, Workout } from "@trainiq/types";
import { buildWeekSummary } from "./build-week-summary";

const weather: WeatherContext = {
  days: {
    monday: { condition: "clear", temperatureC: 18, precipitationChance: 10 },
    tuesday: { condition: "clear", temperatureC: 18, precipitationChance: 10 },
    wednesday: { condition: "clear", temperatureC: 18, precipitationChance: 10 },
    thursday: { condition: "clear", temperatureC: 18, precipitationChance: 10 },
    friday: { condition: "clear", temperatureC: 18, precipitationChance: 10 },
    saturday: { condition: "clear", temperatureC: 18, precipitationChance: 10 },
    sunday: { condition: "clear", temperatureC: 18, precipitationChance: 10 },
  },
};

const moderateWorkout: Workout = {
  id: "tempo-1",
  name: "Tempo ride",
  sport: "cycling",
  durationMinutes: 60,
  focus: "tempo",
  intensity: "moderate",
  fatigueCost: 5,
  description: "Steady tempo effort.",
};

const moderateDay: RecommendedTrainingDay = {
  dayOfWeek: "wednesday",
  status: "recommended",
  sport: "cycling",
  workout: moderateWorkout,
  durationMinutes: 60,
  reasoning: [],
};

const depletedLoad: TrainingLoadContext = { ctl: 58, atl: 90, tsb: -31.955060000000003, recentSessions: [] };

describe("buildWeekSummary", () => {
  it("says hard sessions were avoided, not that the week stays easy, when the hard budget is zero", () => {
    const enduranceDays: TrainingDay[] = [moderateDay];

    const rationale = buildWeekSummary({
      enduranceDays,
      longestDay: undefined,
      weather,
      trainingLoad: depletedLoad,
      hardBudget: 0,
      weatherAdjustedDays: [],
      strengthKeptApart: false,
    });

    expect(rationale).toContain("hard sessions were avoided this week to support recovery");
    expect(rationale).not.toContain("stays easy across the board");
  });

  it("displays a rounded TSB in the low-form sentence", () => {
    const rationale = buildWeekSummary({
      enduranceDays: [moderateDay],
      longestDay: undefined,
      weather,
      trainingLoad: depletedLoad,
      hardBudget: 0,
      weatherAdjustedDays: [],
      strengthKeptApart: false,
    });

    expect(rationale).toContain("TSB -32");
    expect(rationale).not.toContain("-31.955060000000003");
  });

  it("does not falsely claim the whole week is easy when a moderate session is present alongside the zero-hard-budget sentence", () => {
    const rationale = buildWeekSummary({
      enduranceDays: [moderateDay],
      longestDay: undefined,
      weather,
      trainingLoad: depletedLoad,
      hardBudget: 0,
      weatherAdjustedDays: [],
      strengthKeptApart: false,
    });

    expect(rationale.toLowerCase()).not.toContain("easy across the board");
  });
});
