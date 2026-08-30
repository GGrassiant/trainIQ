import { describe, expect, it } from "vitest";
import { buildMockPlanningContext } from "@trainiq/domain";
import type { PlanningContext, RecommendedTrainingDay, TrainingDay } from "@trainiq/types";
import { planWeek } from "./plan-week";

const DAY_INDEX: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

const UNAVAILABLE = { isAvailable: false, maxDurationMinutes: 0 } as const;

function isEndurance(sport: string): sport is "cycling" | "running" {
  return sport === "cycling" || sport === "running";
}

function isQuality(day: TrainingDay): day is RecommendedTrainingDay {
  return day.status === "recommended" && (day.workout.intensity === "hard" || day.workout.intensity === "very-hard");
}

/** `reasoning` only exists on fixed/recommended days — unresolved days carry a `reason` string instead. */
function reasoningOf(day: TrainingDay): string[] {
  return day.status === "unresolved" ? [] : day.reasoning;
}

describe("planWeek", () => {
  describe("normal availability", () => {
    it("keeps the Tuesday running club as a fixed running session", () => {
      const plan = planWeek(buildMockPlanningContext());
      const tuesday = plan.days.find((d) => d.dayOfWeek === "tuesday");

      expect(tuesday).toBeDefined();
      expect(tuesday!.status).toBe("fixed");
      expect(tuesday!.sport).toBe("running");
      expect(tuesday!.durationMinutes).toBeLessThanOrEqual(60);
      expect(reasoningOf(tuesday!).some((r) => r.includes("running club"))).toBe(true);
    });

    it("schedules approximately 4 endurance training days, separate from any strength day", () => {
      const plan = planWeek(buildMockPlanningContext());
      const enduranceDays = plan.days.filter((d) => isEndurance(d.sport));

      expect(enduranceDays.length).toBe(4);
      expect(plan.totalTrainingDays).toBe(4);
      expect(plan.unmetRequirements).toEqual([]);
    });

    it("balances cycling and running across the endurance days", () => {
      const plan = planWeek(buildMockPlanningContext());
      const cycling = plan.days.filter((d) => d.sport === "cycling").length;
      const running = plan.days.filter((d) => d.sport === "running").length;

      expect(cycling).toBeGreaterThanOrEqual(1);
      expect(running).toBeGreaterThanOrEqual(1);
      expect(cycling + running).toBe(4);
    });

    it("does not count a strength session toward the endurance day quota", () => {
      const plan = planWeek(buildMockPlanningContext());
      const strengthDay = plan.days.find((d) => d.sport === "strength");

      expect(strengthDay).toBeDefined();
      expect(plan.totalTrainingDays).toBe(plan.days.filter((d) => isEndurance(d.sport)).length);
      expect(plan.totalTrainingDays).not.toBe(plan.days.length);
    });

    it("never schedules a strength session on an unavailable day", () => {
      const base = buildMockPlanningContext();
      const noStrengthSlot: PlanningContext = {
        ...base,
        availability: { days: { ...base.availability.days, monday: UNAVAILABLE } },
      };

      const plan = planWeek(noStrengthSlot);
      expect(plan.days.some((d) => d.sport === "strength")).toBe(false);
    });

    it("keeps hard/very-hard sessions off calendar-adjacent days for recovery", () => {
      const base = buildMockPlanningContext();
      const adjacentCandidates: PlanningContext = {
        ...base,
        availability: {
          days: {
            monday: UNAVAILABLE,
            tuesday: base.availability.days.tuesday,
            wednesday: { isAvailable: true, maxDurationMinutes: 70 },
            thursday: { isAvailable: true, maxDurationMinutes: 70 },
            friday: UNAVAILABLE,
            saturday: UNAVAILABLE,
            sunday: { isAvailable: true, maxDurationMinutes: 180 },
          },
        },
        trainingLoad: { ...base.trainingLoad, tsb: 10 },
      };

      const plan = planWeek(adjacentCandidates);
      const hardDays = plan.days.filter(isQuality);

      for (let i = 0; i < hardDays.length; i++) {
        for (let j = i + 1; j < hardDays.length; j++) {
          const gap = Math.abs(DAY_INDEX[hardDays[i].dayOfWeek] - DAY_INDEX[hardDays[j].dayOfWeek]);
          expect(gap).toBeGreaterThan(1);
        }
      }
    });

    it("places the longest session on a weekend day", () => {
      const plan = planWeek(buildMockPlanningContext());
      const longest = plan.days.reduce((a, b) => (b.durationMinutes > a.durationMinutes ? b : a));

      expect(["saturday", "sunday"]).toContain(longest.dayOfWeek);
      expect(reasoningOf(longest).some((r) => r.toLowerCase().includes("longest"))).toBe(true);
    });

    it("lets the athlete's primary goal influence which sport gets the quality session and its focus", () => {
      const base = buildMockPlanningContext();
      const plan = planWeek({ ...base, trainingLoad: { ...base.trainingLoad, tsb: 10 } });

      const cyclingQuality = plan.days.find((d): d is RecommendedTrainingDay => isQuality(d) && d.sport === "cycling");

      expect(cyclingQuality).toBeDefined();
      expect(["sweet-spot", "threshold", "over-under"]).toContain(cyclingQuality!.workout.focus);
      expect(cyclingQuality!.reasoning.some((r) => r.includes("climbing performance"))).toBe(true);
    });

    it("respects each day's available duration", () => {
      const base = buildMockPlanningContext();
      const plan = planWeek(base);

      for (const day of plan.days) {
        if (day.status === "unresolved") continue; // represents unfilled availability, not a scheduled duration
        expect(day.durationMinutes).toBeLessThanOrEqual(base.availability.days[day.dayOfWeek].maxDurationMinutes);
      }
    });

    it("never schedules a day the athlete marked unavailable", () => {
      const base = buildMockPlanningContext();
      const fridayOff: PlanningContext = {
        ...base,
        availability: { days: { ...base.availability.days, friday: UNAVAILABLE } },
      };

      const plan = planWeek(fridayOff);
      expect(plan.days.some((d) => d.dayOfWeek === "friday")).toBe(false);
    });
  });

  describe("fixed commitments are hard constraints (P1 #3)", () => {
    it("cannot be replaced by a better-scoring recommended workout, and keeps its own duration", () => {
      const base = buildMockPlanningContext();
      // A library full of short running workouts that would "win" on duration/focus scoring
      // if the fixed day were ever routed through pickWorkout.
      const temptingLibrary = base.workoutLibrary.map((w) =>
        w.sport === "running" ? { ...w, durationMinutes: 30 } : w
      );

      const plan = planWeek({ ...base, workoutLibrary: temptingLibrary });
      const tuesday = plan.days.find((d) => d.dayOfWeek === "tuesday")!;

      expect(tuesday.status).toBe("fixed");
      // The commitment's own 60 min duration survives untouched, not some library workout's duration.
      expect(tuesday.durationMinutes).toBe(60);
    });

    it("is never assigned to a different day", () => {
      const plan = planWeek(buildMockPlanningContext());
      const fixedDays = plan.days.filter((d) => d.status === "fixed");

      expect(fixedDays).toHaveLength(1);
      expect(fixedDays[0].dayOfWeek).toBe("tuesday");
    });

    it("counts toward the weekly running target", () => {
      const plan = planWeek(buildMockPlanningContext());
      const runningDays = plan.days.filter((d) => isEndurance(d.sport) && d.sport === "running");

      expect(runningDays.some((d) => d.status === "fixed")).toBe(true);
      expect(runningDays.length).toBe(2);
    });

    it("still lets the remaining sessions be planned normally around it", () => {
      const plan = planWeek(buildMockPlanningContext());
      const wednesday = plan.days.find((d) => d.dayOfWeek === "wednesday")!;

      expect(wednesday.status).toBe("recommended");
    });
  });

  describe("impossible or constrained availability never crashes the planner (P1 #1)", () => {
    it("returns a valid, empty-but-truthful plan when there are zero available training days", () => {
      const base = buildMockPlanningContext();
      const noAvailability: PlanningContext = {
        ...base,
        availability: {
          days: {
            monday: UNAVAILABLE,
            tuesday: UNAVAILABLE,
            wednesday: UNAVAILABLE,
            thursday: UNAVAILABLE,
            friday: UNAVAILABLE,
            saturday: UNAVAILABLE,
            sunday: UNAVAILABLE,
          },
        },
      };

      expect(() => planWeek(noAvailability)).not.toThrow();

      const plan = planWeek(noAvailability);
      expect(plan.days).toEqual([]);
      expect(plan.totalTrainingDays).toBe(0);
      expect(plan.totalDurationMinutes).toBe(0);
      expect(plan.unmetRequirements.length).toBeGreaterThan(0);
      expect(plan.unmetRequirements[0].toLowerCase()).toContain("no endurance training days");
    });

    it("reports an explicit unmet requirement when fewer days are available than the ~4 day target", () => {
      const base = buildMockPlanningContext();
      // Only Tuesday (fixed) and Saturday available — well short of the target.
      const scarce: PlanningContext = {
        ...base,
        availability: {
          days: {
            monday: UNAVAILABLE,
            tuesday: base.availability.days.tuesday,
            wednesday: UNAVAILABLE,
            thursday: UNAVAILABLE,
            friday: UNAVAILABLE,
            saturday: base.availability.days.saturday,
            sunday: UNAVAILABLE,
          },
        },
      };

      expect(() => planWeek(scarce)).not.toThrow();

      const plan = planWeek(scarce);
      expect(plan.totalTrainingDays).toBe(2);
      expect(plan.unmetRequirements.length).toBeGreaterThan(0);
      expect(plan.unmetRequirements[0]).toContain("2 of the 4");
    });

    it("reports a milder unmet requirement for a partially constrained week (one day short)", () => {
      const base = buildMockPlanningContext();
      // Disable both Monday (the strength-only slot) and Sunday, leaving exactly 3
      // available endurance days (Tuesday fixed + Wednesday + Saturday) with no
      // spare day to fill the gap — a genuine one-short shortfall.
      const partial: PlanningContext = {
        ...base,
        availability: { days: { ...base.availability.days, monday: UNAVAILABLE, sunday: UNAVAILABLE } },
      };

      expect(() => planWeek(partial)).not.toThrow();

      const plan = planWeek(partial);
      expect(plan.totalTrainingDays).toBe(3);
      expect(plan.unmetRequirements.length).toBeGreaterThan(0);
      expect(plan.unmetRequirements[0]).toContain("3 of the 4");
    });
  });

  describe("no compatible workout never crashes the planner (P1 #2)", () => {
    it("represents an unresolved day, with a reason, instead of throwing when no workout matches the sport", () => {
      const base = buildMockPlanningContext();
      const noRunningWorkouts = base.workoutLibrary.filter((w) => w.sport !== "running");

      expect(() => planWeek({ ...base, workoutLibrary: noRunningWorkouts })).not.toThrow();

      const plan = planWeek({ ...base, workoutLibrary: noRunningWorkouts });
      // Wednesday is the non-fixed running day in the default mock.
      const wednesday = plan.days.find((d) => d.dayOfWeek === "wednesday")!;

      expect(wednesday.status).toBe("unresolved");
      if (wednesday.status === "unresolved") {
        expect(wednesday.reason.toLowerCase()).toContain("running");
      }
    });

    it("represents an unresolved day instead of throwing when the workout library is empty", () => {
      const base = buildMockPlanningContext();

      expect(() => planWeek({ ...base, workoutLibrary: [] })).not.toThrow();

      const plan = planWeek({ ...base, workoutLibrary: [] });
      const nonFixedDays = plan.days.filter((d) => d.status !== "fixed");

      expect(nonFixedDays.length).toBeGreaterThan(0);
      expect(nonFixedDays.every((d) => d.status === "unresolved")).toBe(true);
    });

    it("does not invent a workout or drop the day — the fixed commitment still plans normally alongside unresolved days", () => {
      const base = buildMockPlanningContext();
      const noRunningWorkouts = base.workoutLibrary.filter((w) => w.sport !== "running");

      const plan = planWeek({ ...base, workoutLibrary: noRunningWorkouts });
      const tuesday = plan.days.find((d) => d.dayOfWeek === "tuesday")!;

      // The fixed commitment doesn't need a library workout at all, so it's unaffected.
      expect(tuesday.status).toBe("fixed");
    });
  });
});
