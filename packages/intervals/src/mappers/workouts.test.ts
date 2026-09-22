import { describe, expect, it } from "vitest";
import type { IntervalsWorkout } from "../api-types";
import {
  easyRunWorkout,
  freeTextWorkout,
  raceReadyWorkout,
  sweetSpotBlocksWorkout,
  swimWorkout,
  thresholdIntervalsInLongRideWorkout,
  vo2WorkInLongRideWorkout,
  warmupLadderAndSprintsWorkout,
  z2RideWorkout,
  zoneTimesFixture,
} from "../fixtures/workouts.fixture";
import { mapIntervalsWorkoutsToLibrary } from "./workouts";

function mapOne(workout: IntervalsWorkout) {
  return mapIntervalsWorkoutsToLibrary([workout]);
}

describe("mapIntervalsWorkoutsToLibrary", () => {
  describe("direct mappings", () => {
    it("maps id, name, description, sport, duration and Intervals load from an Intervals workout", () => {
      const { workouts } = mapOne(z2RideWorkout);

      expect(workouts).toHaveLength(1);
      expect(workouts[0]).toMatchObject({
        id: "245",
        name: "Z2 Ride",
        description: "- 2h 60%",
        sport: "cycling",
        durationMinutes: 120,
        intervalsLoad: 72,
      });
    });

    it("maps a Ride to cycling and a Run to running", () => {
      const { workouts } = mapIntervalsWorkoutsToLibrary([z2RideWorkout, easyRunWorkout]);

      expect(workouts.map((w) => w.sport)).toEqual(["cycling", "running"]);
    });

    it.each([
      ["VirtualRide", "cycling"],
      ["GravelRide", "cycling"],
      ["MountainBikeRide", "cycling"],
      ["VirtualRun", "running"],
      ["TrailRun", "running"],
    ])("maps the %s variant to %s, matching how activities are mapped", (type, sport) => {
      const { workouts } = mapOne({ ...z2RideWorkout, type });

      expect(workouts[0].sport).toBe(sport);
    });

    it("converts moving_time seconds to whole minutes", () => {
      const { workouts } = mapOne({ ...z2RideWorkout, moving_time: 3990 });

      expect(workouts[0].durationMinutes).toBe(67); // 66.5 min rounds up
    });

    it("uses an empty description when Intervals has none", () => {
      const { workouts } = mapOne({ ...z2RideWorkout, description: undefined });

      expect(workouts[0].description).toBe("");
    });

    it("leaves intervalsLoad unset when Intervals reports no training load", () => {
      const { workouts } = mapOne({ ...z2RideWorkout, icu_training_load: undefined });

      expect(workouts[0].intervalsLoad).toBeUndefined();
    });
  });

  describe("Intervals load is not TrainIQ fatigue cost", () => {
    it("keeps icu_training_load as intervalsLoad without using it as fatigueCost", () => {
      const { workouts } = mapOne(z2RideWorkout);

      expect(workouts[0].intervalsLoad).toBe(72);
      expect(workouts[0].fatigueCost).not.toBe(72);
      expect(workouts[0].fatigueCost).toBeLessThanOrEqual(10);
    });

    it("produces the same classification and fatigueCost whatever Load Intervals reports", () => {
      const lowLoad = mapOne({ ...z2RideWorkout, icu_training_load: 10 }).workouts[0];
      const highLoad = mapOne({ ...z2RideWorkout, icu_training_load: 400 }).workouts[0];

      expect(highLoad.intervalsLoad).toBe(400);
      expect(highLoad.intensity).toBe(lowLoad.intensity);
      expect(highLoad.focus).toBe(lowLoad.focus);
      expect(highLoad.fatigueCost).toBe(lowLoad.fatigueCost);
    });
  });

  describe("classification", () => {
    it("maps a Z2 Ride to an easy endurance workout", () => {
      const { workouts } = mapOne(z2RideWorkout);

      expect(workouts[0]).toMatchObject({ intensity: "easy", focus: "endurance" });
    });

    it("does not classify a Race Ready-style session as easy merely because warmup and recovery time dominates", () => {
      const { workouts } = mapOne(raceReadyWorkout);

      expect(workouts[0]).toMatchObject({ durationMinutes: 66, intensity: "very-hard", focus: "vo2max" });
    });

    it("classifies focus and intensity independently: VO2 work diluted in a long ride is moderate intensity with a vo2max focus", () => {
      const { workouts } = mapOne(vo2WorkInLongRideWorkout);

      expect(workouts[0]).toMatchObject({ intensity: "moderate", focus: "vo2max" });
    });

    it("does not let total duration hide meaningful threshold work in a long ride", () => {
      const { workouts } = mapOne(thresholdIntervalsInLongRideWorkout);

      expect(workouts[0]).toMatchObject({ durationMinutes: 181, intensity: "hard", focus: "threshold" });
    });

    it("keeps a warm-up ladder plus a few sprints easy / endurance, the conservative fallback (an opener structure can't be inferred from zones)", () => {
      const { workouts } = mapOne(warmupLadderAndSprintsWorkout);

      expect(workouts[0]).toMatchObject({ intensity: "easy", focus: "endurance" });
    });

    it("uses the overlapping Sweet Spot band as a focus signal only: sweet-spot focus, with intensity still from Z1-Z7", () => {
      const { workouts } = mapOne(sweetSpotBlocksWorkout);

      expect(workouts[0]).toMatchObject({ intensity: "moderate", focus: "sweet-spot" });
    });

    it("threads the sport through: the same zone times classify differently as a Ride and as a Run, because absolute minutes are cycling-only", () => {
      const asRide = mapOne(vo2WorkInLongRideWorkout).workouts[0];
      const asRun = mapOne({ ...vo2WorkInLongRideWorkout, type: "Run" }).workouts[0];

      expect(asRide).toMatchObject({ sport: "cycling", intensity: "moderate", focus: "vo2max" });
      expect(asRun).toMatchObject({ sport: "running", intensity: "easy", focus: "endurance" });
    });

    it("ignores the Sweet Spot entry for a Run, which has no sweet-spot focus", () => {
      const { workouts } = mapOne({ ...sweetSpotBlocksWorkout, type: "Run" });

      expect(workouts[0].focus).toBe("tempo");
    });

    it("does not add the overlapping Sweet Spot entry to the zone totals", () => {
      // A large "SS" value on an otherwise pure-Z2 workout must not change how it is classified.
      const withSweetSpot: IntervalsWorkout = { ...z2RideWorkout, workout_doc: { zoneTimes: zoneTimesFixture({ Z2: 7200, SS: 7200 }) } };

      const { workouts } = mapOne(withSweetSpot);

      expect(workouts[0]).toMatchObject({ intensity: "easy", focus: "endurance" });
    });

    it("ignores unknown zone ids and malformed seconds instead of coercing them", () => {
      const messy = {
        ...z2RideWorkout,
        workout_doc: {
          zoneTimes: [
            { id: "Z2", secs: 7200 },
            { id: "Z5", secs: Number.NaN },
            { id: "Z6", secs: -600 },
            { id: "Z7", secs: "900" },
            { id: "X9", secs: 5000 },
          ],
        },
      };

      const { workouts, skipped } = mapIntervalsWorkoutsToLibrary([messy]);

      expect(skipped).toEqual([]);
      expect(workouts[0]).toMatchObject({ intensity: "easy", focus: "endurance" });
    });
  });

  describe("unsupported and incomplete workouts", () => {
    it("skips a sport TrainIQ doesn't plan for, with a reason, rather than guessing", () => {
      const result = mapOne(swimWorkout);

      expect(result.workouts).toEqual([]);
      expect(result.skipped).toEqual([{ id: "500", reason: expect.stringContaining("Swim") }]);
    });

    it("skips a workout with no type", () => {
      const result = mapOne({ ...z2RideWorkout, type: undefined });

      expect(result.workouts).toEqual([]);
      expect(result.skipped).toHaveLength(1);
    });

    it("skips a workout without a name", () => {
      expect(mapOne({ ...z2RideWorkout, name: undefined }).workouts).toEqual([]);
      expect(mapOne({ ...z2RideWorkout, name: "   " }).workouts).toEqual([]);
    });

    it.each([undefined, 0, -60, Number.NaN])("skips a workout whose moving_time is %s rather than inventing a duration", (movingTime) => {
      const result = mapOne({ ...z2RideWorkout, moving_time: movingTime });

      expect(result.workouts).toEqual([]);
      expect(result.skipped).toHaveLength(1);
    });

    it("skips a free-text workout with no workout_doc, since there's nothing to classify from", () => {
      const result = mapOne(freeTextWorkout);

      expect(result.workouts).toEqual([]);
      expect(result.skipped).toEqual([{ id: "600", reason: expect.stringContaining("zoneTimes") }]);
    });

    it("skips a workout whose zoneTimes are empty or all zero", () => {
      const empty = mapOne({ ...z2RideWorkout, workout_doc: { zoneTimes: [] } });
      const allZero = mapOne({ ...z2RideWorkout, workout_doc: { zoneTimes: zoneTimesFixture({}) } });

      expect(empty.workouts).toEqual([]);
      expect(allZero.workouts).toEqual([]);
    });

    it("keeps the usable workouts and reports the rest when a library mixes both, without throwing", () => {
      const library = [z2RideWorkout, swimWorkout, freeTextWorkout, raceReadyWorkout, easyRunWorkout];

      expect(() => mapIntervalsWorkoutsToLibrary(library)).not.toThrow();

      const { workouts, skipped } = mapIntervalsWorkoutsToLibrary(library);
      expect(workouts.map((w) => w.id)).toEqual(["245", "312", "401"]);
      expect(skipped.map((s) => s.id)).toEqual(["500", "600"]);
    });
  });

  it("returns an empty library for an empty input", () => {
    expect(mapIntervalsWorkoutsToLibrary([])).toEqual({ workouts: [], skipped: [] });
  });

  describe("validates untrusted JSON at the boundary", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["an object instead of an array", {}],
      ["a bare string", "not a workout library"],
      ["a number", 42],
    ])("does not throw, and returns an empty library with a diagnostic skip entry, when the top-level response is %s", (_label, rawResponse) => {
      expect(() => mapIntervalsWorkoutsToLibrary(rawResponse)).not.toThrow();

      const result = mapIntervalsWorkoutsToLibrary(rawResponse);
      expect(result.workouts).toEqual([]);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].id).not.toBe("undefined");
      expect(result.skipped[0].id).not.toBe("null");
    });

    it.each([
      ["null", { id: null }],
      ["a non-numeric string", { id: "245" }],
      ["a boolean", { id: true }],
      ["an object", { id: {} }],
    ])("never fabricates a workout id when the raw id is %s: the workout is skipped, not mapped with a fake id", (_label, malformed) => {
      const rawResponse = [{ ...z2RideWorkout, ...malformed }];

      const result = mapIntervalsWorkoutsToLibrary(rawResponse);

      expect(result.workouts).toEqual([]);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].id).not.toBe("undefined");
      expect(result.skipped[0].id).not.toBe("null");
      expect(result.skipped[0].reason.length).toBeGreaterThan(0);
    });

    it("never fabricates a workout id when the raw id is missing entirely: the workout is skipped, not mapped with a fake id", () => {
      const { id: _omittedId, ...withoutId } = z2RideWorkout;
      const rawResponse = [withoutId];

      const result = mapIntervalsWorkoutsToLibrary(rawResponse);

      expect(result.workouts).toEqual([]);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].id).not.toBe("undefined");
      expect(result.skipped[0].id).not.toBe("null");
      expect(result.skipped[0].reason.length).toBeGreaterThan(0);
    });

    it("does not throw when the response array itself contains null or a non-object entry", () => {
      const rawResponse = [z2RideWorkout, null, "not a workout", 42, raceReadyWorkout];

      expect(() => mapIntervalsWorkoutsToLibrary(rawResponse)).not.toThrow();

      const { workouts, skipped } = mapIntervalsWorkoutsToLibrary(rawResponse);
      expect(workouts.map((w) => w.id)).toEqual(["245", "312"]);
      expect(skipped).toHaveLength(3);
      expect(skipped.every((s) => s.id !== "undefined" && s.id !== "null")).toBe(true);
    });

    it("maps a malformed workout's valid siblings in the same response rather than discarding the whole batch", () => {
      const rawResponse = [{ id: "not-a-number" }, z2RideWorkout, { notAWorkout: true }, raceReadyWorkout];

      const { workouts, skipped } = mapIntervalsWorkoutsToLibrary(rawResponse);

      expect(workouts.map((w) => w.id)).toEqual(["245", "312"]);
      expect(skipped).toHaveLength(2);
    });

    it("does not throw on malformed nested workout_doc/zoneTimes data, and still maps the workout from whatever is well-formed", () => {
      const nullZoneEntry: IntervalsWorkout = {
        ...z2RideWorkout,
        workout_doc: { zoneTimes: [null, { id: "Z2", secs: 7200 }] as never },
      };
      const nonObjectWorkoutDoc = { ...z2RideWorkout, workout_doc: "not an object" as never };
      const nonArrayZoneTimes = { ...z2RideWorkout, workout_doc: { zoneTimes: "not an array" as never } };

      expect(() => mapIntervalsWorkoutsToLibrary([nullZoneEntry, nonObjectWorkoutDoc, nonArrayZoneTimes])).not.toThrow();

      const { workouts, skipped } = mapIntervalsWorkoutsToLibrary([nullZoneEntry, nonObjectWorkoutDoc, nonArrayZoneTimes]);
      expect(workouts).toHaveLength(1);
      expect(workouts[0]).toMatchObject({ intensity: "easy", focus: "endurance" });
      expect(skipped).toHaveLength(2);
    });

    it("treats an explicit workout_doc: null the same as a missing workout_doc, rather than crashing", () => {
      const result = mapOne({ ...z2RideWorkout, workout_doc: null as never });

      expect(result.workouts).toEqual([]);
      expect(result.skipped).toEqual([{ id: "245", reason: expect.stringContaining("zoneTimes") }]);
    });
  });

  describe("fatigueCost uses the precise duration, not one already rounded to a whole minute (Codex P3)", () => {
    it("does not give a 44:31 workout the duration point intended for an actual 45-minute workout", () => {
      // 44 min 31 sec = 2671 s -> 44.5167 min, which rounds to 45 (Math.round) but is still < 45.
      const fortyFourThirtyOne = mapOne({ ...z2RideWorkout, moving_time: 2671 }).workouts[0];
      const trueFortyFive = mapOne({ ...z2RideWorkout, moving_time: 2700 }).workouts[0];

      expect(fortyFourThirtyOne.durationMinutes).toBe(45); // the rounded display value is still 45...
      expect(fortyFourThirtyOne.fatigueCost).toBeLessThan(trueFortyFive.fatigueCost); // ...but its fatigueCost must not match a true 45-minute workout.
    });

    it("does not give an 89:31 workout the duration point intended for an actual 90-minute workout", () => {
      // 89 min 31 sec = 5371 s -> 89.5167 min, rounds to 90 but is still < 90.
      const eightyNineThirtyOne = mapOne({ ...z2RideWorkout, moving_time: 5371 }).workouts[0];
      const trueNinety = mapOne({ ...z2RideWorkout, moving_time: 5400 }).workouts[0];

      expect(eightyNineThirtyOne.durationMinutes).toBe(90);
      expect(eightyNineThirtyOne.fatigueCost).toBeLessThan(trueNinety.fatigueCost);
    });

    it("still gives a genuine 45:00 workout the duration point (the fix narrows the boundary, it doesn't remove it)", () => {
      const trueFortyFive = mapOne({ ...z2RideWorkout, moving_time: 2700 }).workouts[0];
      const fortyFour = mapOne({ ...z2RideWorkout, moving_time: 2640 }).workouts[0];

      expect(trueFortyFive.fatigueCost).toBeGreaterThan(fortyFour.fatigueCost);
    });
  });
});
