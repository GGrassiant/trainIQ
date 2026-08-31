import type { IntervalsActivity, IntervalsAthlete, IntervalsWellnessEntry } from "./api-types";

const DEFAULT_BASE_URL = "https://intervals.icu/api/v1";
/** Intervals.icu convention: athlete id "0" resolves to the authenticated athlete. */
const DEFAULT_ATHLETE_ID = "0";

export interface IntervalsClientConfig {
  /** The athlete's personal Intervals.icu API key. Never hardcode this — pass it in from server-side config. */
  apiKey: string;
  athleteId?: string;
  baseUrl?: string;
}

export interface IntervalsDateRange {
  /** Inclusive start date, "YYYY-MM-DD". */
  oldest: string;
  /** Inclusive end date, "YYYY-MM-DD". */
  newest: string;
}

/** A non-success HTTP response from the Intervals.icu API. Never carries the request's Authorization header. */
export class IntervalsApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, statusText: string, url: string) {
    super(`Intervals.icu request failed: ${status} ${statusText} (${url})`);
    this.name = "IntervalsApiError";
    this.status = status;
    this.url = url;
  }
}

/**
 * Thin, read-only client for the Intervals.icu endpoints TrainIQ currently
 * needs. Not a general-purpose HTTP abstraction — just enough to fetch
 * wellness, activities, and athlete identity with Basic auth and typed
 * responses.
 */
export class IntervalsClient {
  private readonly apiKey: string;
  private readonly athleteId: string;
  private readonly baseUrl: string;

  constructor(config: IntervalsClientConfig) {
    if (!config.apiKey) {
      throw new Error("IntervalsClient requires a non-empty apiKey.");
    }
    this.apiKey = config.apiKey;
    this.athleteId = config.athleteId ?? DEFAULT_ATHLETE_ID;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  getWellness(range: IntervalsDateRange): Promise<IntervalsWellnessEntry[]> {
    return this.get<IntervalsWellnessEntry[]>(`/athlete/${this.athleteId}/wellness`, { oldest: range.oldest, newest: range.newest });
  }

  getActivities(range: IntervalsDateRange): Promise<IntervalsActivity[]> {
    return this.get<IntervalsActivity[]>(`/athlete/${this.athleteId}/activities`, { oldest: range.oldest, newest: range.newest });
  }

  /** Fetches the authenticated athlete's profile (`GET /api/v1/athlete/{id}`). */
  getAthlete(): Promise<IntervalsAthlete> {
    return this.get<IntervalsAthlete>(`/athlete/${this.athleteId}`);
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }

    // Intervals.icu's documented scheme for personal use: Basic auth with
    // the literal username "API_KEY" and the personal API key as the password.
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${btoa(`API_KEY:${this.apiKey}`)}` },
    });

    if (!response.ok) {
      throw new IntervalsApiError(response.status, response.statusText, url.toString());
    }

    return (await response.json()) as T;
  }
}
