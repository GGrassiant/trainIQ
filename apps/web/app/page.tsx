import { connection } from "next/server";
import { getTrainingOverview } from "../lib/intervals";

const MISSING = "—";

function formatNumber(value: number | null): string {
  return value === null ? MISSING : String(value);
}

// Preserve the activity's local calendar date across server time zones.
function formatDate(startDateLocal: string | null): string {
  if (startDateLocal === null) {
    return MISSING;
  }

  const date = new Date(`${startDateLocal.slice(0, 10)}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return MISSING;
  }

  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

export default async function Home() {
  // Render on every request so the dashboard never shows a build-time snapshot.
  await connection();

  const overview = await getTrainingOverview();

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>TrainIQ</h1>

      {overview === null ? (
        <p>Unable to load training data.</p>
      ) : (
        <>
          <h2>Current training state</h2>
          <table style={{ textAlign: "left", borderSpacing: "1.5rem 0.25rem" }}>
            <tbody>
              <tr>
                <th scope="row">Fitness</th>
                <td>{formatNumber(overview.trainingState.fitness)}</td>
              </tr>
              <tr>
                <th scope="row">Fatigue</th>
                <td>{formatNumber(overview.trainingState.fatigue)}</td>
              </tr>
              <tr>
                <th scope="row">Form</th>
                <td>{formatNumber(overview.trainingState.form)}</td>
              </tr>
            </tbody>
          </table>

          <h2>Recent activities</h2>
          {overview.recentActivities.length === 0 ? (
            <p>No activities yet.</p>
          ) : (
            <table style={{ textAlign: "left", borderSpacing: "1.5rem 0.25rem" }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Moving time</th>
                  <th>Load</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentActivities.map((activity) => (
                  <tr key={activity.id}>
                    <td>{formatDate(activity.startDateLocal)}</td>
                    <td>{activity.name ?? MISSING}</td>
                    <td>{activity.type ?? MISSING}</td>
                    <td>{formatDuration(activity.movingTimeSeconds)}</td>
                    <td>{formatNumber(activity.trainingLoad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  );
}
