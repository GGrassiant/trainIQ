import { describe, expect, it } from "vitest";
import type { AthleteIdentity, ScheduledWorkout, TrainingLoadContext, Workout } from "@trainiq/types";
import { buildPlanningContextWithMockDefaults, mockAthlete, mockTrainingLoad, mockWorkoutLibrary } from "@trainiq/domain";
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

describe("buildPlanningContextWithMockDefaults", () => {
  it("replaces only the trainingLoad, keeping the rest of the context TrainIQ-owned mock data", () => {
    const context = buildPlanningContextWithMockDefaults({
      trainingLoad: realTrainingLoad,
      weekStartDate: "2026-08-31",
    });

    expect(context.trainingLoad).toEqual(realTrainingLoad);
    expect(context.trainingLoad).not.toEqual(mockTrainingLoad);
    expect(context.weekStartDate).toBe("2026-08-31");
  });

  it("falls back to the mock context's own weekStartDate when none is given", () => {
    const context = buildPlanningContextWithMockDefaults({
      trainingLoad: realTrainingLoad,
    });

    expect(context.weekStartDate.length).toBeGreaterThan(0);
  });

  it("produces a PlanningContext planWeek() accepts and plans from, with no special-casing for real vs mock trainingLoad", () => {
    const context = buildPlanningContextWithMockDefaults({
      trainingLoad: realTrainingLoad,
      weekStartDate: "2026-08-31",
    });

    expect(() => planWeek(context)).not.toThrow();

    const plan = planWeek(context);
    expect(plan.weekStartDate).toBe("2026-08-31");
    expect(plan.days.length).toBeGreaterThan(0);
  });

  it("keeps the mock athlete identity when no athleteIdentity is given", () => {
    const context = buildPlanningContextWithMockDefaults({
      trainingLoad: realTrainingLoad,
      weekStartDate: "2026-08-31",
    });

    expect(context.athlete).toEqual(mockAthlete);
  });

  it("overrides only athlete id/name when given a real athleteIdentity, keeping TrainIQ-owned sports", () => {
    /** Shaped like what @trainiq/intervals' athlete mapper would produce — this test never imports that package. */
    const realAthleteIdentity: AthleteIdentity = { id: "i123456", name: "Jamie Rivera" };

    const context = buildPlanningContextWithMockDefaults({
      trainingLoad: realTrainingLoad,
      weekStartDate: "2026-08-31",
      athleteIdentity: realAthleteIdentity,
    });

    expect(context.athlete.id).toBe("i123456");
    expect(context.athlete.name).toBe("Jamie Rivera");
    expect(context.athlete.sports).toEqual(mockAthlete.sports);
  });

  describe("workout library", () => {
    it("keeps the mock workout library when none is given", () => {
      const context = buildPlanningContextWithMockDefaults({
        trainingLoad: realTrainingLoad,
        weekStartDate: "2026-08-31",
      });

      expect(context.workoutLibrary).toEqual(mockWorkoutLibrary);
    });

    it("uses the given workout library instead of the mock one, leaving the rest of the context alone", () => {
      const context = buildPlanningContextWithMockDefaults({
        trainingLoad: realTrainingLoad,
        weekStartDate: "2026-08-31",
        workoutLibrary: realWorkoutLibrary,
      });

      expect(context.workoutLibrary).toEqual(realWorkoutLibrary);
      expect(context.trainingLoad).toEqual(realTrainingLoad);
      expect(context.athlete).toEqual(mockAthlete);
    });

    it("respects an empty library rather than silently falling back to the mock one", () => {
      const context = buildPlanningContextWithMockDefaults({
        trainingLoad: realTrainingLoad,
        weekStartDate: "2026-08-31",
        workoutLibrary: [],
      });

      expect(context.workoutLibrary).toEqual([]);
    });

    it("lets planWeek() plan only from the given library, with no special-casing for where it came from", () => {
      const context = buildPlanningContextWithMockDefaults({
        trainingLoad: realTrainingLoad,
        weekStartDate: "2026-08-31",
        workoutLibrary: realWorkoutLibrary,
      });

      const plan = planWeek(context);

      const recommended = plan.days.flatMap((day) => (day.status === "recommended" ? [day.workout] : []));
      const mockIds = new Set(mockWorkoutLibrary.map((workout) => workout.id));
      expect(recommended.length).toBeGreaterThan(0);
      expect(recommended.every((workout) => realWorkoutLibrary.some((w) => w.id === workout.id))).toBe(true);
      expect(recommended.some((workout) => mockIds.has(workout.id))).toBe(false);
    });

    it("represents an empty library as unresolved days instead of throwing", () => {
      const context = buildPlanningContextWithMockDefaults({
        trainingLoad: realTrainingLoad,
        weekStartDate: "2026-08-31",
        workoutLibrary: [],
      });

      const plan = planWeek(context);

      expect(plan.days.some((day) => day.status === "recommended")).toBe(false);
      expect(plan.days.some((day) => day.status === "unresolved")).toBe(true);
    });
  });

  describe("scheduled workouts", () => {
    /** Shaped like what @trainiq/intervals' events mapper would produce — this test never imports that package. */
    const realScheduledWorkouts: ScheduledWorkout[] = [
      { id: "137241313", date: "2026-09-23", sport: "cycling", name: "MAP", plannedDurationMinutes: 60, plannedLoad: 70 },
      {
        id: "137241043",
        date: "2026-09-22",
        sport: "running",
        name: "Run - Endurance",
        plannedDurationMinutes: 30,
        plannedLoad: 32,
        completedActivityId: "i189162915",
      },
    ];

    it("keeps the mock (empty) scheduledWorkouts when none is given", () => {
      const context = buildPlanningContextWithMockDefaults({
        trainingLoad: realTrainingLoad,
        weekStartDate: "2026-08-31",
      });

      expect(context.scheduledWorkouts).toEqual([]);
    });

    it("uses the given scheduledWorkouts instead of the mock ones, leaving the rest of the context alone", () => {
      const context = buildPlanningContextWithMockDefaults({
        trainingLoad: realTrainingLoad,
        weekStartDate: "2026-08-31",
        scheduledWorkouts: realScheduledWorkouts,
      });

      expect(context.scheduledWorkouts).toEqual(realScheduledWorkouts);
      expect(context.trainingLoad).toEqual(realTrainingLoad);
      expect(context.workoutLibrary).toEqual(mockWorkoutLibrary);
      expect(context.athlete).toEqual(mockAthlete);
    });

    /**
     * Scheduled entries cover the planning week's used dates, including Monday's
     * strength slot. The library also supports an actual strength recommendation.
     * Overlapping dates and sports ensure accidental use of scheduledWorkouts can affect the plan and fail this guard.
     */
    const realWorkoutLibraryWithStrength: Workout[] = [
      ...realWorkoutLibrary,
      { id: "900", name: "Full-Body Strength", sport: "strength", durationMinutes: 30, focus: "strength", intensity: "moderate", fatigueCost: 4, description: "" },
    ];

    const scheduledWorkoutsAcrossThePlanningWeek: ScheduledWorkout[] = [
      { id: "500", date: "2026-08-31", sport: "strength", name: "Strength training", plannedDurationMinutes: 20 }, // Monday: the plan's strength day
      { id: "501", date: "2026-09-01", sport: "running", name: "Tempo", plannedDurationMinutes: 45, plannedLoad: 50 }, // Tuesday: the fixed running-club day
      { id: "502", date: "2026-09-02", sport: "cycling", name: "Sweet Spot", plannedDurationMinutes: 75, plannedLoad: 80 }, // Wednesday
      { id: "503", date: "2026-09-05", sport: "cycling", name: "Z2 Ride", plannedDurationMinutes: 150, plannedLoad: 90 }, // Saturday
      { id: "504", date: "2026-09-06", sport: "running", name: "Long Run", plannedDurationMinutes: 90, plannedLoad: 95, completedActivityId: "i900" }, // Sunday
    ];

    it("never changes planWeek()'s complete WeeklyPlan, even with scheduledWorkouts covering every day and sport (including strength) the plan itself uses", () => {
      const contextWithout = buildPlanningContextWithMockDefaults({
        trainingLoad: realTrainingLoad,
        weekStartDate: "2026-08-31",
        workoutLibrary: realWorkoutLibraryWithStrength,
        scheduledWorkouts: [],
      });
      const contextWith = buildPlanningContextWithMockDefaults({
        trainingLoad: realTrainingLoad,
        weekStartDate: "2026-08-31",
        workoutLibrary: realWorkoutLibraryWithStrength,
        scheduledWorkouts: scheduledWorkoutsAcrossThePlanningWeek,
      });

      const planWithout = planWeek(contextWithout);
      const planWith = planWeek(contextWith);

      // Sanity: the plan this test isolates against actually does have a strength day, so the comparison below is meaningful.
      expect(planWithout.days.some((day) => day.sport === "strength")).toBe(true);
      expect(planWith).toEqual(planWithout);
    });
  });
});
