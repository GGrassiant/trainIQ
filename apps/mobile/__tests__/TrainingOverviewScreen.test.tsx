import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import TrainingOverviewScreen from '../TrainingOverviewScreen';
import { TrainingOverview } from '../trainingOverview';

async function renderScreen(response: Response) {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  await render(
    <QueryClientProvider client={queryClient}>
      <TrainingOverviewScreen />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders the training state and recent activities', async () => {
  const overview: TrainingOverview = {
    trainingState: { fitness: 1234, fatigue: 56, form: -7 },
    recentActivities: [
      {
        id: 'i1',
        name: 'Morning ride',
        type: 'Ride',
        startDateLocal: '2026-10-11T23:30:00',
        movingTimeSeconds: 3827,
        trainingLoad: 88,
      },
    ],
  };

  await renderScreen(Response.json(overview));

  expect(await screen.findByText('Current training state')).toBeOnTheScreen();
  expect(globalThis.fetch).toHaveBeenCalledWith(
    'http://localhost:3000/api/training-overview',
  );
  expect(screen.getByText('Fitness')).toBeOnTheScreen();
  expect(screen.getByText('1,234')).toBeOnTheScreen();
  expect(screen.getByText('Fatigue')).toBeOnTheScreen();
  expect(screen.getByText('56')).toBeOnTheScreen();
  expect(screen.getByText('Form')).toBeOnTheScreen();
  expect(screen.getByText('-7')).toBeOnTheScreen();
  expect(screen.getByText('Recent activities')).toBeOnTheScreen();
  expect(screen.getByText('Morning ride')).toBeOnTheScreen();
  expect(screen.getByText('Oct 11 · Ride')).toBeOnTheScreen();
  expect(screen.getByText('64 min · Load 88')).toBeOnTheScreen();
});

test('shows zero values instead of treating them as missing', async () => {
  const overview: TrainingOverview = {
    trainingState: { fitness: 0, fatigue: 0, form: 0 },
    recentActivities: [
      {
        id: 'i1',
        name: 'Stretching',
        type: 'Yoga',
        startDateLocal: '2026-10-11T08:00:00',
        movingTimeSeconds: 0,
        trainingLoad: 0,
      },
    ],
  };

  await renderScreen(Response.json(overview));

  expect(await screen.findByText('0 min · Load 0')).toBeOnTheScreen();
  expect(screen.getAllByText('0')).toHaveLength(3);
  expect(screen.queryByText(/—/)).not.toBeOnTheScreen();
});

test('shows missing values as a dash', async () => {
  const overview: TrainingOverview = {
    trainingState: { fitness: null, fatigue: null, form: null },
    recentActivities: [
      {
        id: 'i1',
        name: null,
        type: null,
        startDateLocal: null,
        movingTimeSeconds: null,
        trainingLoad: null,
      },
    ],
  };

  await renderScreen(Response.json(overview));

  expect(await screen.findByText('— · —')).toBeOnTheScreen();
  expect(screen.getByText('— · Load —')).toBeOnTheScreen();
  expect(screen.getAllByText('—')).toHaveLength(4);
});

test('says when there are no recent activities', async () => {
  const overview: TrainingOverview = {
    trainingState: { fitness: 50, fatigue: 40, form: 10 },
    recentActivities: [],
  };

  await renderScreen(Response.json(overview));

  expect(await screen.findByText('No activities yet.')).toBeOnTheScreen();
});

test('shows an error when the API responds with a failure', async () => {
  await renderScreen(
    Response.json({ error: 'Unable to load training data.' }, { status: 502 }),
  );

  expect(
    await screen.findByText('Unable to load training data.'),
  ).toBeOnTheScreen();
  expect(screen.queryByText('Current training state')).not.toBeOnTheScreen();
});
