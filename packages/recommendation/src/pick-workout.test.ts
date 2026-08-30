import { describe, expect, it } from "vitest";
import type { Workout } from "@trainiq/types";
import { pickWorkout } from "./pick-workout";

const easyRun: Workout = {
  id: "run-easy",
  name: "Easy Run",
  sport: "running",
  durationMinutes: 45,
  focus: "endurance",
  intensity: "easy",
  fatigueCost: 3,
  description: "Easy run.",
};

const hardRun: Workout = {
  id: "run-hard",
  name: "Hard Run",
  sport: "running",
  durationMinutes: 50,
  focus: "threshold",
  intensity: "hard",
  fatigueCost: 6,
  description: "Hard run.",
};

const easyRide: Workout = {
  id: "cyc-easy",
  name: "Easy Ride",
  sport: "cycling",
  durationMinutes: 60,
  focus: "endurance",
  intensity: "easy",
  fatigueCost: 3,
  description: "Easy ride.",
};

describe("pickWorkout", () => {
  it("returns found:true with a matching workout when one exists", () => {
    const result = pickWorkout({ sport: "running", intensity: "easy", maxDurationMinutes: 60, library: [easyRun] });

    expect(result.found).toBe(true);
    if (result.found) expect(result.workout.id).toBe("run-easy");
  });

  it("does not throw and explains the gap when no workout fits the requested duration", () => {
    const result = pickWorkout({ sport: "running", intensity: "easy", maxDurationMinutes: 10, library: [easyRun] });

    expect(result.found).toBe(false);
    if (!result.found) expect(result.reason.toLowerCase()).toContain("min");
  });

  it("does not throw and explains the gap when no workout matches the requested sport", () => {
    const result = pickWorkout({
      sport: "cycling",
      intensity: "easy",
      maxDurationMinutes: 60,
      library: [easyRun, hardRun],
    });

    expect(result.found).toBe(false);
    if (!result.found) expect(result.reason.toLowerCase()).toContain("cycling");
  });

  it("does not throw and explains the gap when no workout matches the requested intensity, even one tier down", () => {
    // Only an easy ride exists. A very-hard request steps down to "hard" (still nothing) before giving up —
    // it must not silently fall back further and hand back the easy ride as if it satisfied the request.
    const result = pickWorkout({ sport: "cycling", intensity: "very-hard", maxDurationMinutes: 60, library: [easyRide] });

    expect(result.found).toBe(false);
    if (!result.found) expect(result.reason.toLowerCase()).toContain("intensity");
  });

  it("does not throw and explains the gap when the workout library is empty", () => {
    const result = pickWorkout({ sport: "running", intensity: "easy", maxDurationMinutes: 60, library: [] });

    expect(result.found).toBe(false);
    if (!result.found) expect(result.reason.toLowerCase()).toContain("empty");
  });

  it("steps down exactly one intensity tier before giving up (e.g. moderate falls back to easy)", () => {
    const result = pickWorkout({ sport: "cycling", intensity: "moderate", maxDurationMinutes: 60, library: [easyRide] });

    expect(result.found).toBe(true);
    if (result.found) expect(result.workout.id).toBe("cyc-easy");
  });
});
