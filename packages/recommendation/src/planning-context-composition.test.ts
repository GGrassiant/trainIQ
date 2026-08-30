import { describe, expect, it } from "vitest";
import type { TrainingLoadContext } from "@trainiq/types";
import { buildPlanningContextWithTrainingLoad, mockTrainingLoad } from "@trainiq/domain";
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
});
