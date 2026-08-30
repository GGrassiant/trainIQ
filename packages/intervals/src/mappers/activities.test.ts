import { describe, expect, it } from "vitest";
import type { IntervalsActivity } from "../api-types";
import { activitiesFixture } from "../fixtures/activities.fixture";
import { mapActivitiesToRecentSessions } from "./activities";

describe("mapActivitiesToRecentSessions", () => {
  it("maps a Ride to a cycling RecentSession", () => {
    const [ride] = mapActivitiesToRecentSessions([activitiesFixture[0]]);

    expect(ride).toMatchObject({ date: "2026-08-22", sport: "cycling", durationMinutes: 165 });
  });

  it("maps a Run to a running RecentSession", () => {
    const [run] = mapActivitiesToRecentSessions([activitiesFixture[1]]);

    expect(run).toMatchObject({ date: "2026-08-24", sport: "running", durationMinutes: 55 });
  });

  it("converts moving_time seconds to whole minutes", () => {
    const activity: IntervalsActivity = { id: "x", start_date_local: "2026-08-01T00:00:00", type: "Run", moving_time: 1830 };

    const [session] = mapActivitiesToRecentSessions([activity]);

    expect(session.durationMinutes).toBe(31);
  });

  it("preserves Intervals.icu training load as intervalsTrainingLoad, never as fatigueCost", () => {
    const [ride] = mapActivitiesToRecentSessions([activitiesFixture[0]]);

    expect(ride.intervalsTrainingLoad).toBe(78);
    expect(ride.fatigueCost).toBeUndefined();
  });

  it("does not map icu_intensity to intensity — they are different concepts", () => {
    const [ride] = mapActivitiesToRecentSessions([activitiesFixture[0]]);

    expect(ride.intensity).toBeUndefined();
  });

  it("skips activity types TrainIQ doesn't plan for, without throwing", () => {
    expect(() => mapActivitiesToRecentSessions(activitiesFixture)).not.toThrow();

    const sessions = mapActivitiesToRecentSessions(activitiesFixture);
    expect(sessions.some((s) => s.date === "2026-08-25")).toBe(false); // Swim (a3)
  });

  it("skips an activity missing moving_time rather than inventing a duration", () => {
    const sessions = mapActivitiesToRecentSessions(activitiesFixture);

    expect(sessions.some((s) => s.date === "2026-08-26")).toBe(false); // a4 has no moving_time
  });

  it("handles a missing optional icu_training_load without crashing", () => {
    const activity: IntervalsActivity = { id: "y", start_date_local: "2026-08-01T00:00:00", type: "Ride", moving_time: 3600 };

    const [session] = mapActivitiesToRecentSessions([activity]);

    expect(session.intervalsTrainingLoad).toBeUndefined();
  });

  it("returns an empty array for an empty input", () => {
    expect(mapActivitiesToRecentSessions([])).toEqual([]);
  });
});
