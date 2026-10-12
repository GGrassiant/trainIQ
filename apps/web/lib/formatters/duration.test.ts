import { describe, expect, it } from "vitest";
import { formatActivityDuration } from "./duration";

describe("formatActivityDuration", () => {
  it("shows total minutes rounded to the nearest minute", () => {
    expect(formatActivityDuration(3827, "en-US")).toBe("64 min");
  });
});
