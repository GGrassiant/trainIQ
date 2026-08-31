import { describe, expect, it } from "vitest";
import { formatTsb } from "./format-tsb";

describe("formatTsb", () => {
  it("rounds a real-world Intervals.icu TSB value to a whole number", () => {
    expect(formatTsb(-31.955060000000003)).toBe("-32");
  });

  it("rounds a positive fractional value to the nearest whole number", () => {
    expect(formatTsb(4.4)).toBe("4");
    expect(formatTsb(4.5)).toBe("5");
  });

  it("leaves an already-whole value unchanged", () => {
    expect(formatTsb(-6)).toBe("-6");
  });

  it("does not mutate the raw value it was given", () => {
    const raw = -31.955060000000003;
    formatTsb(raw);
    expect(raw).toBe(-31.955060000000003);
  });
});
