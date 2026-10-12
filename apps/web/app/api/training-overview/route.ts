import { getTrainingOverview } from "../../../lib/intervals";

export async function GET() {
  const overview = await getTrainingOverview();

  if (overview === null) {
    return Response.json({ error: "Unable to load training data." }, { status: 502 });
  }

  return Response.json(overview);
}
