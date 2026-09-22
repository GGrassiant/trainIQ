import { describe, expect, it } from "vitest";
import type { IntervalsEvent } from "../api-types";
import { completedScheduledRunEvent, scheduledRideEvent, scheduledStrengthEvent, unsupportedCategoryEvent } from "../fixtures/events.fixture";
import { mapIntervalsEventsToScheduledWorkouts } from "./scheduled-workouts";

function mapOne(event: IntervalsEvent) {
  return mapIntervalsEventsToScheduledWorkouts([event]);
}

describe("mapIntervalsEventsToScheduledWorkouts", () => {
  describe("direct mappings", () => {
    it("maps id, date, sport, name, planned duration and planned load from a WORKOUT event", () => {
      const { scheduledWorkouts } = mapOne(scheduledRideEvent);

      expect(scheduledWorkouts).toEqual([
        {
          id: "137241313",
          date: "2026-09-23",
          sport: "cycling",
          name: "MAP",
          plannedDurationMinutes: 60,
          plannedLoad: 70,
          completedActivityId: undefined,
        },
      ]);
    });

    it("maps a Ride to cycling, a Run to running, and WeightTraining to strength", () => {
      const { scheduledWorkouts } = mapIntervalsEventsToScheduledWorkouts([
        scheduledRideEvent,
        completedScheduledRunEvent,
        scheduledStrengthEvent,
      ]);

      expect(scheduledWorkouts.map((s) => s.sport)).toEqual(["cycling", "running", "strength"]);
    });

    it("preserves the completed activity id when the event is paired to a completed activity", () => {
      const { scheduledWorkouts } = mapOne(completedScheduledRunEvent);

      expect(scheduledWorkouts[0].completedActivityId).toBe("i189162915");
    });

    it("leaves completedActivityId unset for a future, not-yet-completed event", () => {
      const { scheduledWorkouts } = mapOne(scheduledRideEvent);

      expect(scheduledWorkouts[0].completedActivityId).toBeUndefined();
    });

    it("keeps the plan's own duration/load even once paired to a completed activity, never substituting the actual", () => {
      const { scheduledWorkouts } = mapOne(completedScheduledRunEvent);

      // Real account evidence: this exact event's paired activity actually ran 2139s / load 41 — plannedLoad/plannedDurationMinutes must stay the plan's values, not the activity's.
      expect(scheduledWorkouts[0]).toMatchObject({ plannedDurationMinutes: 30, plannedLoad: 32 });
    });

    it("leaves plannedLoad unset when Intervals reports none, e.g. a strength event", () => {
      const { scheduledWorkouts } = mapOne(scheduledStrengthEvent);

      expect(scheduledWorkouts[0].plannedLoad).toBeUndefined();
      expect(scheduledWorkouts[0].plannedDurationMinutes).toBe(20);
    });

    it("uses only the date portion of start_date_local, since Intervals.icu gives no real time-of-day here", () => {
      const { scheduledWorkouts } = mapOne(scheduledRideEvent);

      expect(scheduledWorkouts[0].date).toBe("2026-09-23");
    });
  });

  describe("category filtering", () => {
    it("skips a non-WORKOUT category event rather than inventing semantics for it", () => {
      const { scheduledWorkouts, skipped } = mapOne(unsupportedCategoryEvent);

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped).toEqual([{ id: "999001", reason: "Unsupported event category (NOTE)." }]);
    });

    it("maps only the WORKOUT events out of a mixed batch, skipping the rest", () => {
      const { scheduledWorkouts, skipped } = mapIntervalsEventsToScheduledWorkouts([scheduledRideEvent, unsupportedCategoryEvent]);

      expect(scheduledWorkouts).toHaveLength(1);
      expect(scheduledWorkouts[0].id).toBe("137241313");
      expect(skipped).toHaveLength(1);
    });
  });

  describe("unsupported/missing sport type", () => {
    it("skips an unsupported type while preserving a valid sibling event", () => {
      const { scheduledWorkouts, skipped } = mapIntervalsEventsToScheduledWorkouts([
        { ...scheduledRideEvent, id: 1, type: "Swim" },
        scheduledRideEvent,
      ]);

      expect(skipped).toEqual([{ id: "1", reason: "Unsupported or missing event type (Swim)." }]);
      expect(scheduledWorkouts).toEqual(mapOne(scheduledRideEvent).scheduledWorkouts);
    });

    it("skips an event with no type", () => {
      const { scheduledWorkouts, skipped } = mapOne({ ...scheduledRideEvent, type: undefined });

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped[0].reason).toBe("Unsupported or missing event type (none).");
    });
  });

  describe("start_date_local validity", () => {
    it("rejects a non-date-shaped string", () => {
      const { scheduledWorkouts, skipped } = mapOne({ ...scheduledRideEvent, start_date_local: "oops" });

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped[0].reason).toBe("Event did not match the expected shape from Intervals.icu.");
    });

    it("rejects a date that matches the expected format but isn't a real calendar date", () => {
      const { scheduledWorkouts, skipped } = mapOne({ ...scheduledRideEvent, start_date_local: "2026-02-30T00:00:00" });

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped[0].reason).toBe("Event did not match the expected shape from Intervals.icu.");
    });

    it("accepts a real leap-day date", () => {
      const { scheduledWorkouts } = mapOne({ ...scheduledRideEvent, start_date_local: "2024-02-29T00:00:00" });

      expect(scheduledWorkouts[0].date).toBe("2024-02-29");
    });
  });

  describe("negative planned duration/load", () => {
    it("rejects a negative moving_time", () => {
      const { scheduledWorkouts, skipped } = mapOne({ ...scheduledRideEvent, moving_time: -1 });

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped[0].reason).toBe("Event did not match the expected shape from Intervals.icu.");
    });

    it("rejects a negative icu_training_load", () => {
      const { scheduledWorkouts, skipped } = mapOne({ ...scheduledRideEvent, icu_training_load: -1 });

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped[0].reason).toBe("Event did not match the expected shape from Intervals.icu.");
    });

    it("accepts zero as a valid planned duration and load", () => {
      const { scheduledWorkouts } = mapOne({ ...scheduledRideEvent, moving_time: 0, icu_training_load: 0 });

      expect(scheduledWorkouts[0]).toMatchObject({ plannedDurationMinutes: 0, plannedLoad: 0 });
    });

    it("still maps a valid sibling event when another event in the batch has a negative value", () => {
      const { scheduledWorkouts, skipped } = mapIntervalsEventsToScheduledWorkouts([
        { ...scheduledRideEvent, id: 1, moving_time: -1 },
        scheduledRideEvent,
      ]);

      expect(skipped).toHaveLength(1);
      expect(scheduledWorkouts).toEqual([expect.objectContaining({ id: "137241313" })]);
    });
  });

  describe("id validity", () => {
    it.each([
      ["a negative id", -137241313],
      ["a zero id", 0],
      ["a fractional id", 137241313.5],
      ["an id outside the safe integer range", Number.MAX_SAFE_INTEGER + 10],
    ])("rejects %s", (_label, id) => {
      const { scheduledWorkouts, skipped } = mapOne({ ...scheduledRideEvent, id });

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped[0].reason).toBe("Event did not match the expected shape from Intervals.icu.");
    });

    it("still maps a valid sibling event when another event in the batch has an invalid id", () => {
      const { scheduledWorkouts, skipped } = mapIntervalsEventsToScheduledWorkouts([
        { ...scheduledRideEvent, id: -1 },
        scheduledRideEvent,
      ]);

      expect(skipped).toHaveLength(1);
      expect(scheduledWorkouts).toEqual([expect.objectContaining({ id: "137241313" })]);
    });
  });

  describe("completedActivityId validity", () => {
    it("rejects an empty string", () => {
      const { scheduledWorkouts, skipped } = mapOne({ ...completedScheduledRunEvent, paired_activity_id: "" });

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped[0].reason).toBe("Event did not match the expected shape from Intervals.icu.");
    });

    it("rejects a whitespace-only string", () => {
      const { scheduledWorkouts, skipped } = mapOne({ ...completedScheduledRunEvent, paired_activity_id: "   " });

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped[0].reason).toBe("Event did not match the expected shape from Intervals.icu.");
    });

    it("preserves a valid value exactly as received, without requiring or normalizing an i-prefix", () => {
      const { scheduledWorkouts } = mapOne({ ...completedScheduledRunEvent, paired_activity_id: "not-an-i-id-42" });

      expect(scheduledWorkouts[0].completedActivityId).toBe("not-an-i-id-42");
    });
  });

  describe("malformed input", () => {
    it("never throws on a response that isn't a JSON array", () => {
      expect(() => mapIntervalsEventsToScheduledWorkouts({ not: "an array" })).not.toThrow();

      const { scheduledWorkouts, skipped } = mapIntervalsEventsToScheduledWorkouts({ not: "an array" });
      expect(scheduledWorkouts).toEqual([]);
      expect(skipped).toEqual([{ id: "response", reason: "Intervals.icu events response was not a JSON array." }]);
    });

    it("skips an entry missing a numeric id instead of fabricating one", () => {
      const { scheduledWorkouts, skipped } = mapIntervalsEventsToScheduledWorkouts([{ ...scheduledRideEvent, id: undefined }]);

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped[0].reason).toBe("Event did not match the expected shape from Intervals.icu.");
    });

    it("skips a non-object array entry without throwing", () => {
      const { scheduledWorkouts, skipped } = mapIntervalsEventsToScheduledWorkouts([null, "oops", 42]);

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped).toHaveLength(3);
    });

    it("skips an event with no name", () => {
      const { scheduledWorkouts, skipped } = mapOne({ ...scheduledRideEvent, name: undefined });

      expect(scheduledWorkouts).toEqual([]);
      expect(skipped[0].reason).toBe("Event has no name.");
    });
  });
});
