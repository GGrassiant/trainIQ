import { describe, expect, it } from "vitest";
import { athleteFixture } from "../fixtures/athlete.fixture";
import { mapIntervalsAthlete } from "./athlete";

describe("mapIntervalsAthlete", () => {
  it("maps id from the Intervals.icu athlete response", () => {
    expect(mapIntervalsAthlete(athleteFixture).id).toBe("i123456");
  });

  it("maps name from the Intervals.icu athlete response", () => {
    expect(mapIntervalsAthlete(athleteFixture).name).toBe("Jamie Rivera");
  });

  it("produces only id and name — never a sports field", () => {
    const result = mapIntervalsAthlete(athleteFixture);

    expect(Object.keys(result).sort()).toEqual(["id", "name"]);
  });
});
