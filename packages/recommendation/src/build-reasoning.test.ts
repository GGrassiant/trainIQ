import { describe, expect, it } from "vitest";
import type { Availability, DayWeather, TrainingLoadContext, Workout } from "@trainiq/types";
import { buildReasoning } from "./build-reasoning";

const dayAvailability: Availability["days"]["wednesday"] = { isAvailable: true, maxDurationMinutes: 90 };

const fairWeather: DayWeather = { condition: "clear", temperatureC: 18, precipitationChance: 10 };

const baseTrainingLoad: TrainingLoadContext = { ctl: 58, atl: 90, tsb: -31.955060000000003, recentSessions: [] };

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

const easyWorkout: Workout = { ...moderateWorkout, id: "easy-1", name: "Easy spin", intensity: "easy" };

describe("buildReasoning", () => {
  it("displays a rounded TSB while a real value carries floating-point noise", () => {
    const reasoning = buildReasoning({
      workout: moderateWorkout,
      dayAvailability,
      dayWeather: fairWeather,
      isLongestDay: false,
      weatherAdjusted: false,
      trainingLoad: baseTrainingLoad,
    });

    const lowLoadLine = reasoning.find((r) => r.includes("Recent training load is high"));
    expect(lowLoadLine).toContain("TSB -32");
    expect(lowLoadLine).not.toContain("-31.955060000000003");
  });

  it("does not claim intensity was kept low for a moderate-intensity workout", () => {
    const reasoning = buildReasoning({
      workout: moderateWorkout,
      dayAvailability,
      dayWeather: fairWeather,
      isLongestDay: false,
      weatherAdjusted: false,
      trainingLoad: baseTrainingLoad,
    });

    expect(reasoning.some((r) => r.includes("so a harder effort was avoided today"))).toBe(true);
    expect(reasoning.some((r) => r.toLowerCase().includes("intensity was kept low"))).toBe(false);
  });

  it("still explains the low-load reason for an easy workout", () => {
    const reasoning = buildReasoning({
      workout: easyWorkout,
      dayAvailability,
      dayWeather: fairWeather,
      isLongestDay: false,
      weatherAdjusted: false,
      trainingLoad: baseTrainingLoad,
    });

    expect(reasoning.some((r) => r.includes("so a harder effort was avoided today"))).toBe(true);
  });

  it("does not raise the low-load reason when form is not depleted", () => {
    const healthyLoad: TrainingLoadContext = { ...baseTrainingLoad, tsb: 2 };
    const reasoning = buildReasoning({
      workout: moderateWorkout,
      dayAvailability,
      dayWeather: fairWeather,
      isLongestDay: false,
      weatherAdjusted: false,
      trainingLoad: healthyLoad,
    });

    expect(reasoning.some((r) => r.includes("harder effort was avoided"))).toBe(false);
  });
});
