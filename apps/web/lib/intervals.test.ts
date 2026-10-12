import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTrainingOverview } from "./intervals";

// Next.js resolves "server-only" at build time; it is not installed as a package.
vi.mock("server-only", () => ({}));

type IntervalsResponses = {
  athlete: object;
  wellness?: object;
  activities?: object[];
};

function mockIntervals(responses: IntervalsResponses) {
  const fetchMock = vi.fn(async (url: string) => {
    const { pathname } = new URL(url);
    if (pathname.includes("/wellness/")) {
      return Response.json(responses.wellness ?? {});
    }
    if (pathname.endsWith("/activities")) {
      return Response.json(responses.activities ?? []);
    }
    return Response.json(responses.athlete);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedPaths(fetchMock: ReturnType<typeof mockIntervals>): string[] {
  return fetchMock.mock.calls.map(([url]) => new URL(url).pathname);
}

describe("getTrainingOverview", () => {
  beforeEach(() => {
    vi.stubEnv("INTERVALS_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests the wellness record for the athlete's local day, not the server's", async () => {
    vi.stubEnv("TZ", "UTC");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-11T00:30:00Z"));
    const fetchMock = mockIntervals({ athlete: { timezone: "America/Toronto" } });

    await getTrainingOverview();

    expect(requestedPaths(fetchMock)).toContain("/api/v1/athlete/0/wellness/2026-10-10");
  });

  it("returns null without requesting wellness when the athlete has no timezone", async () => {
    const fetchMock = mockIntervals({ athlete: {} });

    const overview = await getTrainingOverview();

    expect(overview).toBeNull();
    expect(requestedPaths(fetchMock)).toEqual(["/api/v1/athlete/0"]);
  });

  it("computes Form from unrounded CTL and ATL", async () => {
    mockIntervals({
      athlete: { timezone: "America/Toronto" },
      wellness: { ctl: 50.4, atl: 49.6 },
    });

    const overview = await getTrainingOverview();

    expect(overview?.trainingState).toEqual({ fitness: 50, fatigue: 50, form: 1 });
  });

  it("keeps a training load of 0", async () => {
    mockIntervals({
      athlete: { timezone: "America/Toronto" },
      activities: [{ id: "i1", icu_training_load: 0 }],
    });

    const overview = await getTrainingOverview();

    expect(overview?.recentActivities[0].trainingLoad).toBe(0);
  });
});
