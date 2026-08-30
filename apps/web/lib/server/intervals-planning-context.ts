import { buildPlanningContextWithTrainingLoad } from "@trainiq/domain";
import { IntervalsClient, mapActivitiesToRecentSessions, mapWellnessToTrainingLoad } from "@trainiq/intervals";
import type { PlanningContext, TrainingLoadContext } from "@trainiq/types";

/**
 * Server-side only. Builds a PlanningContext using real Intervals.icu
 * wellness + recent-activity data for `trainingLoad`; every other part of
 * the context stays TrainIQ's own mock data (see buildPlanningContextWithTrainingLoad).
 *
 * Reads INTERVALS_API_KEY from the server process environment and calls the
 * real Intervals.icu API — never import this from a client component, a
 * "use client" file, or the mobile app.
 */

const ACTIVITY_LOOKBACK_DAYS = 28;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lookbackRange(days: number): { oldest: string; newest: string } {
  const newest = new Date();
  const oldest = new Date(newest);
  oldest.setUTCDate(oldest.getUTCDate() - days);
  return { oldest: isoDate(oldest), newest: isoDate(newest) };
}

/** Only the local Next.js dev server may reach the Intervals.icu demo route — fails closed everywhere else, including production. */
export function isIntervalsDemoRouteEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The Monday (local time) of the week containing `date`, as "YYYY-MM-DD" — matches this repo's Monday-first week convention. */
export function mondayOfLocalWeek(date: Date): string {
  const dayOfWeek = date.getDay(); // 0 (Sun) - 6 (Sat), local time
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diffToMonday);
  return formatLocalDate(monday);
}

export async function buildPlanningContextFromIntervals(weekStartDate: string): Promise<PlanningContext> {
  const apiKey = process.env.INTERVALS_API_KEY;
  if (!apiKey) {
    throw new Error("INTERVALS_API_KEY is not set. Add it to apps/web/.env.local for local development.");
  }

  const client = new IntervalsClient({ apiKey });
  const range = lookbackRange(ACTIVITY_LOOKBACK_DAYS);

  const [wellness, activities] = await Promise.all([client.getWellness(range), client.getActivities(range)]);

  const wellnessResult = mapWellnessToTrainingLoad(wellness);
  if (!wellnessResult.ok) {
    throw new Error(`Could not derive training load from Intervals.icu wellness data: ${wellnessResult.reason}`);
  }

  const trainingLoad: TrainingLoadContext = {
    ...wellnessResult.trainingLoad,
    recentSessions: mapActivitiesToRecentSessions(activities),
  };

  return buildPlanningContextWithTrainingLoad(trainingLoad, weekStartDate);
}
