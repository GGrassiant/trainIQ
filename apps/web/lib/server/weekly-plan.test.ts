import { afterEach, expect, it, vi } from "vitest";
import { planWeek } from "@trainiq/recommendation";
import { buildServerPlanningContext } from "./planning-context";
import { generateWeeklyPlan } from "./weekly-plan";
import { stubProviders } from "./test-support/providers";

vi.mock("server-only", () => ({}));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("generates from the composed server context, preserving an empty provider library", async () => {
  stubProviders();
  const now = new Date("2026-09-28T01:00:00Z");
  const expected = planWeek(await buildServerPlanningContext(now));
  const plan = await generateWeeklyPlan(now);
  expect(plan).toEqual(expected);
  expect(plan.weekStartDate).toBe("2026-09-28");
  expect(plan.days.some(day => day.status === "unresolved")).toBe(true);
  expect(plan.days.some(day => day.status === "recommended")).toBe(false);
});

it("still generates when weather fails, but never replaces an Intervals failure with mocks", async () => {
  stubProviders(true);
  await expect(generateWeeklyPlan(new Date("2026-09-28T01:00:00Z"))).resolves.toHaveProperty("days");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Provider unavailable")));
  await expect(generateWeeklyPlan(new Date())).rejects.toThrow("Provider unavailable");
});
