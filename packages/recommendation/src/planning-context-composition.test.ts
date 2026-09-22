import { describe, expect, it } from "vitest";
import type { AthleteIdentity, TrainingLoadContext, Workout } from "@trainiq/types";
import { buildPlanningContextWithTrainingLoad, mockAthlete, mockTrainingLoad, mockWorkoutLibrary } from "@trainiq/domain";
import { planWeek } from "./plan-week";

/** Shaped like what @trainiq/intervals' mappers would produce — this test never imports that package. */
const realTrainingLoad: TrainingLoadContext = {
  ctl: 62.3,
  atl: 70.1,
  tsb: 62.3 - 70.1,
  recentSessions: [
    { date: "2026-08-24", sport: "cycling", durationMinutes: 165, intervalsTrainingLoad: 78 },
    { date: "2026-08-26", sport: "running", durationMinutes: 55, intervalsTrainingLoad: 51 },
  ],
};

/** Shaped like what @trainiq/intervals' workout mapper would produce — this test never imports that package. */
const realWorkoutLibrary: Workout[] = [
  { id: "245", name: "Z2 Ride", sport: "cycling", durationMinutes: 120, focus: "endurance", intensity: "easy", fatigueCost: 4, intervalsLoad: 72, description: "- 2h 60%" },
  { id: "290", name: "Threshold Builder", sport: "cycling", durationMinutes: 60, focus: "threshold", intensity: "hard", fatigueCost: 6, intervalsLoad: 85, description: "" },
  { id: "401", name: "Easy Run", sport: "running", durationMinutes: 45, focus: "endurance", intensity: "easy", fatigueCost: 3, intervalsLoad: 38, description: "" },
  { id: "402", name: "Tempo Run", sport: "running", durationMinutes: 40, focus: "tempo", intensity: "moderate", fatigueCost: 5, intervalsLoad: 55, description: "" },
];

describe("buildPlanningContextWithTrainingLoad", () => {
  it("replaces only the trainingLoad, keeping the rest of the context TrainIQ-owned mock data", () => {
    const context = buildPlanningContextWithTrainingLoad(realTrainingLoad, "2026-08-31");

    expect(context.trainingLoad).toEqual(realTrainingLoad);
    expect(context.trainingLoad).not.toEqual(mockTrainingLoad);
    expect(context.weekStartDate).toBe("2026-08-31");
  });

  it("falls back to the mock context's own weekStartDate when none is given", () => {
    const context = buildPlanningContextWithTrainingLoad(realTrainingLoad);

    expect(context.weekStartDate.length).toBeGreaterThan(0);
  });

  it("produces a PlanningContext planWeek() accepts and plans from, with no special-casing for real vs mock trainingLoad", () => {
    const context = buildPlanningContextWithTrainingLoad(realTrainingLoad, "2026-08-31");

    expect(() => planWeek(context)).not.toThrow();

    const plan = planWeek(context);
    expect(plan.weekStartDate).toBe("2026-08-31");
    expect(plan.days.length).toBeGreaterThan(0);
  });

  it("keeps the mock athlete identity when no athleteIdentity is given", () => {
    const context = buildPlanningContextWithTrainingLoad(realTrainingLoad, "2026-08-31");

    expect(context.athlete).toEqual(mockAthlete);
  });

  it("overrides only athlete id/name when given a real athleteIdentity, keeping TrainIQ-owned sports", () => {
    /** Shaped like what @trainiq/intervals' athlete mapper would produce — this test never imports that package. */
    const realAthleteIdentity: AthleteIdentity = { id: "i123456", name: "Jamie Rivera" };

    const context = buildPlanningContextWithTrainingLoad(realTrainingLoad, "2026-08-31", realAthleteIdentity);

    expect(context.athlete.id).toBe("i123456");
    expect(context.athlete.name).toBe("Jamie Rivera");
    expect(context.athlete.sports).toEqual(mockAthlete.sports);
  });

  describe("workout library", () => {
    it("keeps the mock workout library when none is given", () => {
      const context = buildPlanningContextWithTrainingLoad(realTrainingLoad, "2026-08-31");

      expect(context.workoutLibrary).toEqual(mockWorkoutLibrary);
    });

    it("uses the given workout library instead of the mock one, leaving the rest of the context alone", () => {
      const context = buildPlanningContextWithTrainingLoad(realTrainingLoad, "2026-08-31", undefined, realWorkoutLibrary);

      expect(context.workoutLibrary).toEqual(realWorkoutLibrary);
      expect(context.trainingLoad).toEqual(realTrainingLoad);
      expect(context.athlete).toEqual(mockAthlete);
    });

    it("respects an empty library rather than silently falling back to the mock one", () => {
      const context = buildPlanningContextWithTrainingLoad(realTrainingLoad, "2026-08-31", undefined, []);

      expect(context.workoutLibrary).toEqual([]);
    });

    it("lets planWeek() plan only from the given library, with no special-casing for where it came from", () => {
      const context = buildPlanningContextWithTrainingLoad(realTrainingLoad, "2026-08-31", undefined, realWorkoutLibrary);

      const plan = planWeek(context);

      const recommended = plan.days.flatMap((day) => (day.status === "recommended" ? [day.workout] : []));
      const mockIds = new Set(mockWorkoutLibrary.map((workout) => workout.id));
      expect(recommended.length).toBeGreaterThan(0);
      expect(recommended.every((workout) => realWorkoutLibrary.some((w) => w.id === workout.id))).toBe(true);
      expect(recommended.some((workout) => mockIds.has(workout.id))).toBe(false);
    });

    it("represents an empty library as unresolved days instead of throwing", () => {
      const context = buildPlanningContextWithTrainingLoad(realTrainingLoad, "2026-08-31", undefined, []);

      const plan = planWeek(context);

      expect(plan.days.some((day) => day.status === "recommended")).toBe(false);
      expect(plan.days.some((day) => day.status === "unresolved")).toBe(true);
    });
  });
});
