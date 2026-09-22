import { buildPlanningContextWithTrainingLoad } from "@trainiq/domain";
import {
  IntervalsClient,
  mapActivitiesToRecentSessions,
  mapIntervalsAthlete,
  mapIntervalsEventsToScheduledWorkouts,
  mapIntervalsWorkoutsToLibrary,
  mapWellnessToTrainingLoad,
  type IntervalsDateRange,
} from "@trainiq/intervals";
import type { PlanningContext, TrainingLoadContext } from "@trainiq/types";

/**
 * Server-side only. Builds a PlanningContext using real Intervals.icu data
 * for `athlete.id`, `athlete.name`, `trainingLoad` (wellness + recent
 * activities), `workoutLibrary` (the athlete's Intervals.icu workouts,
 * classified by @trainiq/intervals), and `scheduledWorkouts` (what
 * Intervals.icu has scheduled for the planning week itself); every other
 * part of the context — including `athlete.sports`, goals, availability,
 * and weather — stays TrainIQ's own mock data (see
 * buildPlanningContextWithTrainingLoad).
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

/** The Monday (local time) of the week following the one containing `date`, as "YYYY-MM-DD" — used to plan the athlete's upcoming week rather than the current one. */
export function mondayOfNextLocalWeek(date: Date): string {
  const [year, month, day] = mondayOfLocalWeek(date).split("-").map(Number);
  const nextMonday = new Date(year, month - 1, day + 7);
  return formatLocalDate(nextMonday);
}

function addDaysToLocalDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return formatLocalDate(new Date(year, month - 1, day + days));
}

const DAYS_IN_WEEK = 7;

/**
 * The Intervals.icu request range for the planning week starting on
 * `weekStartDate` (Monday-Sunday, matching this repo's week convention) —
 * distinct from `lookbackRange()`, which answers "what already happened
 * before now" for recent activities. Verified against a real account:
 * Intervals.icu's `oldest`/`newest` are both inclusive, so `newest` is
 * `weekStartDate` + 6 days (Sunday), not +7.
 */
export function planningWeekRange(weekStartDate: string): IntervalsDateRange {
  return { oldest: weekStartDate, newest: addDaysToLocalDate(weekStartDate, DAYS_IN_WEEK - 1) };
}

export async function buildPlanningContextFromIntervals(weekStartDate: string): Promise<PlanningContext> {
  const apiKey = process.env.INTERVALS_API_KEY;
  if (!apiKey) {
    throw new Error("INTERVALS_API_KEY is not set. Add it to apps/web/.env.local for local development.");
  }

  const client = new IntervalsClient({ apiKey });
  const range = lookbackRange(ACTIVITY_LOOKBACK_DAYS);
  const eventsRange = planningWeekRange(weekStartDate);

  const [wellness, activities, athlete, intervalsWorkouts, intervalsEvents] = await Promise.all([
    client.getWellness(range),
    client.getActivities(range),
    client.getAthlete(),
    client.getWorkouts(),
    client.getEvents(eventsRange),
  ]);

  const wellnessResult = mapWellnessToTrainingLoad(wellness);
  if (!wellnessResult.ok) {
    throw new Error(`Could not derive training load from Intervals.icu wellness data: ${wellnessResult.reason}`);
  }

  const trainingLoad: TrainingLoadContext = {
    ...wellnessResult.trainingLoad,
    recentSessions: mapActivitiesToRecentSessions(activities),
  };

  // intervalsWorkouts is untrusted JSON (unknown), not an asserted array — mapIntervalsWorkoutsToLibrary
  // validates its shape (and each workout's) before reading anything off of it. No fallback to the mock
  // library: workouts TrainIQ can't truthfully map are left out, and planWeek() represents a library
  // with no fit as unresolved days.
  const { workouts: workoutLibrary, skipped } = mapIntervalsWorkoutsToLibrary(intervalsWorkouts);
  if (skipped.length > 0) {
    console.warn(
      `[TrainIQ] Skipped ${skipped.length} Intervals.icu workout(s):`,
      skipped.map(({ id, reason }) => `${id}: ${reason}`),
    );
  }

  const { scheduledWorkouts, skipped: skippedEvents } = mapIntervalsEventsToScheduledWorkouts(intervalsEvents);
  if (skippedEvents.length > 0) {
    console.warn(
      `[TrainIQ] Skipped ${skippedEvents.length} Intervals.icu event(s):`,
      skippedEvents.map(({ id, reason }) => `${id}: ${reason}`),
    );
  }

  return buildPlanningContextWithTrainingLoad(
    trainingLoad,
    weekStartDate,
    mapIntervalsAthlete(athlete),
    workoutLibrary,
    scheduledWorkouts,
  );
}
