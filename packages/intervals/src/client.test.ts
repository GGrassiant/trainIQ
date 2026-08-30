import { afterEach, describe, expect, it, vi } from "vitest";
import { IntervalsApiError, IntervalsClient } from "./client";

interface MockResponseInit {
  ok: boolean;
  status?: number;
  statusText?: string;
  body?: unknown;
}

function stubFetch(init: MockResponseInit): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    json: async () => init.body ?? [],
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IntervalsClient", () => {
  it("throws when constructed without an apiKey", () => {
    expect(() => new IntervalsClient({ apiKey: "" })).toThrow();
  });

  it("builds the wellness URL with oldest/newest query params, defaulting to athlete 0", async () => {
    const fetchMock = stubFetch({ ok: true });
    const client = new IntervalsClient({ apiKey: "secret" });

    await client.getWellness({ oldest: "2026-08-01", newest: "2026-08-28" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0];
    const url = new URL(String(calledUrl));
    expect(url.pathname).toBe("/api/v1/athlete/0/wellness");
    expect(url.searchParams.get("oldest")).toBe("2026-08-01");
    expect(url.searchParams.get("newest")).toBe("2026-08-28");
  });

  it("builds the activities URL for a custom athleteId and baseUrl", async () => {
    const fetchMock = stubFetch({ ok: true });
    const client = new IntervalsClient({ apiKey: "secret", athleteId: "123", baseUrl: "https://example.test/api/v1" });

    await client.getActivities({ oldest: "2026-08-01", newest: "2026-08-28" });

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toBe("https://example.test/api/v1/athlete/123/activities?oldest=2026-08-01&newest=2026-08-28");
  });

  it("sends Basic auth with the literal username API_KEY and the given key as the password", async () => {
    const fetchMock = stubFetch({ ok: true });
    const client = new IntervalsClient({ apiKey: "secret-key" });

    await client.getActivities({ oldest: "2026-08-01", newest: "2026-08-28" });

    const [, requestInit] = fetchMock.mock.calls[0];
    const headers = (requestInit as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${btoa("API_KEY:secret-key")}`);
  });

  it("returns the parsed JSON body on a success response", async () => {
    stubFetch({ ok: true, body: [{ id: "2026-08-27", ctl: 58.9, atl: 64.5 }] });
    const client = new IntervalsClient({ apiKey: "secret" });

    const wellness = await client.getWellness({ oldest: "2026-08-01", newest: "2026-08-28" });

    expect(wellness).toEqual([{ id: "2026-08-27", ctl: 58.9, atl: 64.5 }]);
  });

  it("throws an IntervalsApiError carrying the status on a non-success response", async () => {
    stubFetch({ ok: false, status: 401, statusText: "Unauthorized" });
    const client = new IntervalsClient({ apiKey: "bad-key" });

    await expect(client.getWellness({ oldest: "2026-08-01", newest: "2026-08-28" })).rejects.toThrow(IntervalsApiError);
  });

  it("includes the failing status on the thrown error", async () => {
    stubFetch({ ok: false, status: 500, statusText: "Server Error" });
    const client = new IntervalsClient({ apiKey: "secret" });

    try {
      await client.getActivities({ oldest: "2026-08-01", newest: "2026-08-28" });
      throw new Error("expected getActivities to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(IntervalsApiError);
      expect((error as IntervalsApiError).status).toBe(500);
    }
  });
});
