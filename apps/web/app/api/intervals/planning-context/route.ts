import { planWeek } from "@trainiq/recommendation";
import { buildPlanningContextFromIntervals, isIntervalsDemoRouteEnabled, mondayOfLocalWeek } from "@/lib/server/intervals-planning-context";

/**
 * Local-development-only demonstration route: builds a PlanningContext from
 * real Intervals.icu wellness/activity data and runs it through planWeek()
 * unchanged, to show planWeek() has no idea the trainingLoad came from
 * Intervals.icu. Requires INTERVALS_API_KEY to be set (see apps/web/.env.example).
 * Not part of the product UI yet — see README for V0.3 scope.
 *
 * Disabled everywhere except `next dev` (see isIntervalsDemoRouteEnabled):
 * fails closed with a 404 before touching Intervals.icu or athlete data, so
 * this can never expose real training data if the app is deployed.
 */
export async function GET(): Promise<Response> {
  if (!isIntervalsDemoRouteEnabled()) {
    return new Response(null, { status: 404 });
  }

  try {
    const weekStartDate = mondayOfLocalWeek(new Date());
    const context = await buildPlanningContextFromIntervals(weekStartDate);
    const plan = planWeek(context);
    return Response.json({ context, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error building the Intervals.icu planning context.";
    return Response.json({ error: message }, { status: 500 });
  }
}
