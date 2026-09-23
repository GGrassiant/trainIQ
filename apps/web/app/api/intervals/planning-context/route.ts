import { planWeek } from "@trainiq/recommendation";
import { isIntervalsDemoRouteEnabled } from "@/lib/server/intervals-planning-context";
import { buildServerPlanningContext } from "@/lib/server/planning-context";

/**
 * Development-only composition of Intervals.icu and Open-Meteo data.
 * The guard runs before provider requests so production cannot expose athlete data.
 */
export async function GET(): Promise<Response> {
  if (!isIntervalsDemoRouteEnabled()) {
    return new Response(null, { status: 404 });
  }

  try {
    const context = await buildServerPlanningContext(new Date());
    const plan = planWeek(context);
    return Response.json({ context, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error building the Intervals.icu planning context.";
    return Response.json({ error: message }, { status: 500 });
  }
}
