import { afterEach, expect, it, vi } from "vitest";
import { appRouter } from "./router";
import { GET } from "../../../app/api/trpc/[trpc]/route";
import { stubProviders } from "../test-support/providers";

vi.mock("server-only", () => ({}));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

const request = () => new Request("http://localhost:3000/api/trpc/planning.getWeeklyPlan");

it("returns the same WeeklyPlan locally and over HTTP without exposing its context", async () => {
  stubProviders();
  vi.stubEnv("NODE_ENV", "development");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T01:00:00Z"));
  const plan = await appRouter.createCaller({}).planning.getWeeklyPlan();
  expect(plan.weekStartDate).toBe("2026-09-28");
  expect(plan.days.some(day => day.status === "unresolved")).toBe(true);
  expect(Object.keys(plan).sort()).toEqual([
    "days", "rationale", "summary", "totalDurationMinutes", "totalTrainingDays", "unmetRequirements", "weekStartDate",
  ]);
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ result: { data: plan } });
});

it.each(["production", "test"])("refuses %s access before any provider request", async environment => {
  vi.stubEnv("NODE_ENV", environment);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(appRouter.createCaller({}).planning.getWeeklyPlan()).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await GET(request())).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});

it("preserves provider failures on the server without exposing their cause, secrets, context or stack", async () => {
  stubProviders();
  vi.stubEnv("NODE_ENV", "development");
  const providerError = new Error("secret-key internal-provider-detail");
  const logError = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(providerError));
  await expect(appRouter.createCaller({}).planning.getWeeklyPlan()).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
    cause: providerError,
  });
  expect(logError).toHaveBeenCalledWith("[TrainIQ] Weekly plan generation failed:", providerError);
  logError.mockClear();
  const response = await GET(request());
  expect(response.status).toBe(500);
  const body = await response.json();
  expect(body.error.message).toBe("Unable to generate the weekly plan. Check the server configuration and provider availability.");
  expect(logError).toHaveBeenCalledWith("[TrainIQ] Weekly plan generation failed:", providerError);
  expect(body.error.data.stack).toBeUndefined();
  expect(JSON.stringify(body)).not.toMatch(/cause|secret-key|internal-provider-detail|trainingLoad|workoutLibrary/);
});
