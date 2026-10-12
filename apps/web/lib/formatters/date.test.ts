import { afterEach, describe, expect, it, vi } from "vitest";
import { formatLocalActivityDate } from "./date";

describe("formatLocalActivityDate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the activity's calendar date when it does not exist in the server time zone", () => {
    vi.stubEnv("TZ", "Pacific/Apia");

    expect(formatLocalActivityDate("2011-12-30T12:00:00", "en-US")).toBe("Dec 30");
  });

  it("orders month and day according to the locale", () => {
    expect(formatLocalActivityDate("2026-10-10T23:30:00", "en-GB")).toBe("10 Oct");
  });
});
