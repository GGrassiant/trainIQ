import { connection } from 'next/server';
import { formatLocalActivityDate } from '../lib/formatters/date';
import { formatActivityDuration } from '../lib/formatters/duration';
import { getTrainingOverview } from '../lib/intervals';

const LOCALE = 'en-US';
const MISSING = '—';

const numberFormat = new Intl.NumberFormat(LOCALE);

export default async function Home() {
  await connection();

  const overview = await getTrainingOverview();

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>TrainIQ</h1>

      {overview === null ? (
        <p>Unable to load training data.</p>
      ) : (
        <>
          <h2>Current training state</h2>
          <table style={{ textAlign: 'left', borderSpacing: '1.5rem 0.25rem' }}>
            <tbody>
              <tr>
                <th scope="row">Fitness</th>
                <td>
                  {overview.trainingState.fitness === null
                    ? MISSING
                    : numberFormat.format(overview.trainingState.fitness)}
                </td>
              </tr>
              <tr>
                <th scope="row">Fatigue</th>
                <td>
                  {overview.trainingState.fatigue === null
                    ? MISSING
                    : numberFormat.format(overview.trainingState.fatigue)}
                </td>
              </tr>
              <tr>
                <th scope="row">Form</th>
                <td>
                  {overview.trainingState.form === null
                    ? MISSING
                    : numberFormat.format(overview.trainingState.form)}
                </td>
              </tr>
            </tbody>
          </table>

          <h2>Recent activities</h2>
          {overview.recentActivities.length === 0 ? (
            <p>No activities yet.</p>
          ) : (
            <table style={{ textAlign: 'left', borderSpacing: '1.5rem 0.25rem' }}>
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
                    <td>
                      {activity.startDateLocal === null
                        ? MISSING
                        : formatLocalActivityDate(activity.startDateLocal, LOCALE)}
                    </td>
                    <td>{activity.name ?? MISSING}</td>
                    <td>{activity.type ?? MISSING}</td>
                    <td>
                      {activity.movingTimeSeconds === null
                        ? MISSING
                        : formatActivityDuration(activity.movingTimeSeconds, LOCALE)}
                    </td>
                    <td>
                      {activity.trainingLoad === null
                        ? MISSING
                        : numberFormat.format(activity.trainingLoad)}
                    </td>
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
