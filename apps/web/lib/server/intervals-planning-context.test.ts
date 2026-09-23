import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMockPlanningContext, mockWorkoutLibrary } from "@trainiq/domain";
import { planWeek } from "@trainiq/recommendation";
import {
  buildPlanningContextFromIntervals,
  planningWeekRange,
} from "./intervals-planning-context";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("planningWeekRange", () => {
  it("requests the planning week's own Monday-Sunday span, inclusive on both ends", () => {
    // Verified against the real Intervals.icu API: oldest/newest are both inclusive,
    // so a Monday-Sunday week is oldest=Monday, newest=Monday+6 (Sunday), not +7.
    expect(planningWeekRange("2026-09-21")).toEqual({ oldest: "2026-09-21", newest: "2026-09-27" });
  });

  it("is a different range than a recent-activity lookback would produce for the same date — Calendar answers what's planned, not what already happened", () => {
    const range = planningWeekRange("2026-09-21");

    expect(range.oldest).toBe("2026-09-21"); // the week's own start, not N days in the past
    expect(new Date(range.newest).getTime()).toBeGreaterThan(new Date(range.oldest).getTime());
  });

  it("rolls forward across a month boundary correctly", () => {
    expect(planningWeekRange("2026-09-28")).toEqual({ oldest: "2026-09-28", newest: "2026-10-04" });
  });

  it("rolls forward across a year boundary correctly", () => {
    expect(planningWeekRange("2025-12-29")).toEqual({ oldest: "2025-12-29", newest: "2026-01-04" });
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
    "/api/v1/athlete/0/events.json": [
      { id: 137241313, category: "WORKOUT", type: "Ride", name: "MAP", start_date_local: "2026-08-31T00:00:00", moving_time: 3600, icu_training_load: 70 },
      {
        id: 137241043,
        category: "WORKOUT",
        type: "Run",
        name: "Run - Endurance",
        start_date_local: "2026-09-01T00:00:00",
        moving_time: 1800,
        icu_training_load: 32,
        paired_activity_id: "i189162915",
      },
      { id: 999001, category: "NOTE", type: "Ride", name: "Race day nutrition reminder", start_date_local: "2026-09-02T00:00:00" },
    ],
  };

  function stubIntervalsApi(overrides: Record<string, unknown> = {}): ReturnType<typeof vi.fn> {
    const responses = { ...responsesByPath, ...overrides };
    vi.stubEnv("INTERVALS_API_KEY", "test-key");
    const fetchMock = vi.fn(async (input: URL | string) => {
      const body = responses[new URL(String(input)).pathname];
      return body === undefined
        ? { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) }
        : { ok: true, status: 200, statusText: "OK", json: async () => body };
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    return fetchMock;
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
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Intervals.icu workout(s)"), expect.anything());
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

  describe("scheduled workouts", () => {
    it("requests events.json with the planning week's own oldest/newest, not the recent-activity lookback range", async () => {
      const fetchMock = stubIntervalsApi();

      await buildPlanningContextFromIntervals("2026-08-31");

      const eventsCall = fetchMock.mock.calls.find(([input]) => new URL(String(input)).pathname === "/api/v1/athlete/0/events.json");
      expect(eventsCall).toBeDefined();
      const url = new URL(String(eventsCall![0]));
      expect(url.searchParams.get("oldest")).toBe("2026-08-31");
      expect(url.searchParams.get("newest")).toBe("2026-09-06");

      const activitiesCall = fetchMock.mock.calls.find(([input]) => new URL(String(input)).pathname === "/api/v1/athlete/0/activities");
      const activitiesUrl = new URL(String(activitiesCall![0]));
      expect(activitiesUrl.searchParams.get("oldest")).not.toBe(url.searchParams.get("oldest"));
    });

    it("maps only the WORKOUT-category events into scheduledWorkouts, skipping the rest", async () => {
      stubIntervalsApi();

      const context = await buildPlanningContextFromIntervals("2026-08-31");

      expect(context.scheduledWorkouts).toEqual([
        { id: "137241313", date: "2026-08-31", sport: "cycling", name: "MAP", plannedDurationMinutes: 60, plannedLoad: 70, completedActivityId: undefined },
        {
          id: "137241043",
          date: "2026-09-01",
          sport: "running",
          name: "Run - Endurance",
          plannedDurationMinutes: 30,
          plannedLoad: 32,
          completedActivityId: "i189162915",
        },
      ]);
    });

    it("does not fall back to a mock fixture when Intervals.icu has no scheduled workouts", async () => {
      stubIntervalsApi({ "/api/v1/athlete/0/events.json": [] });

      const context = await buildPlanningContextFromIntervals("2026-08-31");

      expect(context.scheduledWorkouts).toEqual([]);
    });

    it("does not change planWeek()'s output — scheduledWorkouts is visibility only", async () => {
      stubIntervalsApi();
      const context = await buildPlanningContextFromIntervals("2026-08-31");

      const contextWithoutScheduled = { ...context, scheduledWorkouts: [] };

      expect(planWeek(context)).toEqual(planWeek(contextWithoutScheduled));
    });
  });
});
