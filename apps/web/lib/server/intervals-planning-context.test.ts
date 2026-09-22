import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMockPlanningContext, mockWorkoutLibrary } from "@trainiq/domain";
import { planWeek } from "@trainiq/recommendation";
import {
  buildPlanningContextFromIntervals,
  isIntervalsDemoRouteEnabled,
  mondayOfLocalWeek,
  mondayOfNextLocalWeek,
} from "./intervals-planning-context";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isIntervalsDemoRouteEnabled", () => {
  it("is disabled in production, so the demo route fails closed if deployed", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isIntervalsDemoRouteEnabled()).toBe(false);
  });

  it("is disabled in test", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(isIntervalsDemoRouteEnabled()).toBe(false);
  });

  it("is enabled only in local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isIntervalsDemoRouteEnabled()).toBe(true);
  });
});

describe("mondayOfLocalWeek", () => {
  it("returns the same date when given a Monday", () => {
    expect(mondayOfLocalWeek(new Date(2026, 7, 24))).toBe("2026-08-24"); // Monday
  });

  it("returns the Monday earlier in the week for a mid-week date", () => {
    expect(mondayOfLocalWeek(new Date(2026, 7, 26))).toBe("2026-08-24"); // Wednesday -> that week's Monday
  });

  it("returns the Monday of the same week for a Sunday, not the following week", () => {
    expect(mondayOfLocalWeek(new Date(2026, 7, 30))).toBe("2026-08-24"); // Sunday -> Monday that started this week
  });

  it("rolls back across a month boundary correctly", () => {
    expect(mondayOfLocalWeek(new Date(2026, 8, 1))).toBe("2026-08-31"); // Tuesday, Sep 1 2026 -> Monday, Aug 31 2026
  });
});

describe("mondayOfNextLocalWeek", () => {
  it("rolls forward a full week when given a Monday", () => {
    expect(mondayOfNextLocalWeek(new Date(2026, 7, 24))).toBe("2026-08-31"); // Monday -> next Monday
  });

  it("returns next week's Monday for a mid-week date", () => {
    expect(mondayOfNextLocalWeek(new Date(2026, 7, 26))).toBe("2026-08-31"); // Wednesday -> next Monday
  });

  it("returns tomorrow's date for a Sunday, not the Monday just passed", () => {
    expect(mondayOfNextLocalWeek(new Date(2026, 7, 30))).toBe("2026-08-31"); // Sunday 2026-08-30 -> Monday 2026-08-31
  });

  it("rolls forward across a month boundary correctly", () => {
    expect(mondayOfNextLocalWeek(new Date(2026, 7, 31))).toBe("2026-09-07"); // Monday, Aug 31 2026 -> Monday, Sep 7 2026
  });

  it("rolls forward across a year boundary correctly", () => {
    expect(mondayOfNextLocalWeek(new Date(2025, 11, 31))).toBe("2026-01-05"); // Wednesday, Dec 31 2025 -> Monday, Jan 5 2026
  });
});

describe("buildPlanningContextFromIntervals", () => {
  /** Shaped like the real Intervals.icu responses (trimmed). Not real athlete data. */
  const responsesByPath: Record<string, unknown> = {
    "/api/v1/athlete/0": { id: "i123456", name: "Jamie Rivera" },
    "/api/v1/athlete/0/wellness": [{ id: "2026-08-27", ctl: 62.3, atl: 70.1 }],
    "/api/v1/athlete/0/activities": [
      { id: "a1", start_date_local: "2026-08-24T18:00:00", type: "Ride", moving_time: 9900, icu_training_load: 78 },
    ],
    "/api/v1/athlete/0/workouts": [
      {
        id: 245,
        name: "Z2 Ride",
        description: "- 2h 60%",
        type: "Ride",
        moving_time: 7200,
        icu_training_load: 72,
        workout_doc: { zoneTimes: [{ id: "Z2", secs: 7200 }, { id: "SS", secs: 0 }] },
      },
      {
        id: 312,
        name: "Race Ready",
        type: "Ride",
        moving_time: 3960,
        icu_training_load: 88,
        workout_doc: {
          zoneTimes: [
            { id: "Z1", secs: 1020 },
            { id: "Z2", secs: 1500 },
            { id: "Z5", secs: 1080 },
            { id: "Z7", secs: 360 },
          ],
        },
      },
      { id: 401, name: "Easy Run", type: "Run", moving_time: 2700, workout_doc: { zoneTimes: [{ id: "Z2", secs: 2700 }] } },
      { id: 500, name: "Easy Swim", type: "Swim", moving_time: 1800, workout_doc: { zoneTimes: [{ id: "Z2", secs: 1800 }] } },
      { id: 600, name: "Free-text ride", type: "Ride", moving_time: 10800 },
    ],
  };

  function stubIntervalsApi(overrides: Record<string, unknown> = {}): void {
    const responses = { ...responsesByPath, ...overrides };
    vi.stubEnv("INTERVALS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | string) => {
        const body = responses[new URL(String(input)).pathname];
        return body === undefined
          ? { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) }
          : { ok: true, status: 200, statusText: "OK", json: async () => body };
      }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds the workout library from the athlete's Intervals.icu workouts, not the mock library", async () => {
    stubIntervalsApi();

    const context = await buildPlanningContextFromIntervals("2026-08-31");

    expect(context.workoutLibrary.map((workout) => workout.id)).toEqual(["245", "312", "401"]);
    const mockIds = new Set(mockWorkoutLibrary.map((workout) => workout.id));
    expect(context.workoutLibrary.some((workout) => mockIds.has(workout.id))).toBe(false);
  });

  it("carries Intervals.icu's Load as intervalsLoad and classifies each workout with TrainIQ's own rules", async () => {
    stubIntervalsApi();

    const { workoutLibrary } = await buildPlanningContextFromIntervals("2026-08-31");

    const z2Ride = workoutLibrary.find((workout) => workout.id === "245");
    const raceReady = workoutLibrary.find((workout) => workout.id === "312");
    expect(z2Ride).toMatchObject({ sport: "cycling", durationMinutes: 120, intervalsLoad: 72, intensity: "easy", focus: "endurance" });
    expect(z2Ride?.fatigueCost).not.toBe(72);
    expect(raceReady).toMatchObject({ sport: "cycling", durationMinutes: 66, intervalsLoad: 88, intensity: "very-hard", focus: "vo2max" });
  });

  it("leaves out workouts TrainIQ can't map truthfully (unsupported sport, nothing to classify from), and says so", async () => {
    stubIntervalsApi();

    const { workoutLibrary } = await buildPlanningContextFromIntervals("2026-08-31");

    expect(workoutLibrary.some((workout) => workout.name === "Easy Swim" || workout.name === "Free-text ride")).toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("still takes identity, training load and recent activities from Intervals.icu, and everything else from TrainIQ's mock data", async () => {
    stubIntervalsApi();

    const context = await buildPlanningContextFromIntervals("2026-08-31");
    const mock = buildMockPlanningContext();

    expect(context.athlete).toEqual({ ...mock.athlete, id: "i123456", name: "Jamie Rivera" });
    expect(context.trainingLoad.ctl).toBe(62.3);
    expect(context.trainingLoad.recentSessions).toEqual([
      { date: "2026-08-24", sport: "cycling", durationMinutes: 165, intervalsTrainingLoad: 78 },
    ]);
    expect(context.goals).toEqual(mock.goals);
    expect(context.availability).toEqual(mock.availability);
    expect(context.weather).toEqual(mock.weather);
  });

  it("produces a context planWeek() plans from using only the real library's workouts", async () => {
    stubIntervalsApi();

    const context = await buildPlanningContextFromIntervals("2026-08-31");
    const plan = planWeek(context);

    const recommended = plan.days.flatMap((day) => (day.status === "recommended" ? [day.workout] : []));
    expect(recommended.length).toBeGreaterThan(0);
    expect(recommended.every((workout) => ["245", "312", "401"].includes(workout.id))).toBe(true);
  });

  it("does not fall back to the mock library when Intervals.icu has no usable workouts", async () => {
    stubIntervalsApi({ "/api/v1/athlete/0/workouts": [] });

    const context = await buildPlanningContextFromIntervals("2026-08-31");

    expect(context.workoutLibrary).toEqual([]);
  });
});
