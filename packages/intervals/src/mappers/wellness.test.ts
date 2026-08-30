import { describe, expect, it } from "vitest";
import { wellnessFixture, wellnessFixtureMissingLoad } from "../fixtures/wellness.fixture";
import { mapWellnessToTrainingLoad } from "./wellness";

describe("mapWellnessToTrainingLoad", () => {
  it("selects the latest entry (by date) that has both ctl and atl", () => {
    const result = mapWellnessToTrainingLoad(wellnessFixture);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.trainingLoad.ctl).toBe(58.9);
    expect(result.trainingLoad.atl).toBe(64.5);
  });

  it("derives tsb as ctl - atl rather than reading a returned field", () => {
    const result = mapWellnessToTrainingLoad(wellnessFixture);

    if (!result.ok) throw new Error("expected ok result");
    expect(result.trainingLoad.tsb).toBeCloseTo(58.9 - 64.5);
  });

  it("is not sensitive to input array order", () => {
    const result = mapWellnessToTrainingLoad([...wellnessFixture].reverse());

    if (!result.ok) throw new Error("expected ok result");
    expect(result.trainingLoad.ctl).toBe(58.9);
    expect(result.trainingLoad.atl).toBe(64.5);
  });

  it("returns ok:false for an empty wellness response instead of inventing zeros", () => {
    const result = mapWellnessToTrainingLoad([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("returns ok:false when no entry has both ctl and atl", () => {
    const result = mapWellnessToTrainingLoad(wellnessFixtureMissingLoad);

    expect(result.ok).toBe(false);
  });

  it("skips an entry missing ctl or atl and falls back to the latest complete one", () => {
    const mixed = [...wellnessFixture, { id: "2026-08-28", atl: 70 }];

    const result = mapWellnessToTrainingLoad(mixed);

    if (!result.ok) throw new Error("expected ok result");
    expect(result.trainingLoad.ctl).toBe(58.9);
    expect(result.trainingLoad.atl).toBe(64.5);
  });
});
