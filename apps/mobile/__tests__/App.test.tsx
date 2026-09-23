import React from 'react';
import { Text } from 'react-native';
import { Button, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TRPCClientError } from '@trpc/client';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { WeeklyPlan } from '@trainiq/types';
import { trpc } from '../src/api/trpc';
import { WeeklyPlanScreen } from '../src/screens/WeeklyPlanScreen';

jest.mock('../src/api/trpc', () => ({
  trpc: { planning: { getWeeklyPlan: { query: jest.fn() } } },
}));

const query = jest.mocked(trpc.planning.getWeeklyPlan.query);
const plan: WeeklyPlan = {
  weekStartDate: '2026-09-28',
  days: [{ dayOfWeek: 'monday', status: 'unresolved', sport: 'strength', durationMinutes: 45, reason: 'No provider workout fits.' }],
  totalTrainingDays: 0,
  totalDurationMinutes: 0,
  summary: 'Plan returned by the backend',
  rationale: 'Server-generated rationale',
  unmetRequirements: ['Not enough available days'],
};
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
let renderer: ReactTestRenderer.ReactTestRenderer;

async function renderScreen() {
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={metrics}>
        <PaperProvider><WeeklyPlanScreen /></PaperProvider>
      </SafeAreaProvider>,
    );
  });
}

function texts() {
  return renderer.root.findAllByType(Text).map(node => node.props.children).flat().join(' ');
}

afterEach(async () => {
  await act(async () => renderer?.unmount());
  jest.resetAllMocks();
});

test('shows loading, then the received plan including unresolved sessions', async () => {
  let resolvePlan!: (value: WeeklyPlan) => void;
  query.mockReturnValueOnce(new Promise(resolve => { resolvePlan = resolve; }));
  await renderScreen();
  expect(texts()).toContain('Loading weekly plan');
  await act(async () => resolvePlan(plan));
  expect(texts()).toContain(plan.summary);
  expect(texts()).toContain('No suitable workout found');
  expect(texts()).toContain(plan.unmetRequirements[0]);
  expect(texts()).not.toContain('Loading weekly plan');
});

test('shows a network error and retries successfully', async () => {
  query.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce(plan);
  await renderScreen();
  expect(texts()).toContain('Cannot reach the planning server');
  await act(async () => renderer.root.findByType(Button).props.onPress());
  expect(texts()).toContain(plan.summary);
  expect(texts()).not.toContain('Cannot reach');
});

test('shows a backend error without rendering its internal details', async () => {
  const error = TRPCClientError.from({ error: {
    message: 'Internal server detail', code: -32603,
    data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
  } });
  query.mockRejectedValueOnce(error);
  await renderScreen();
  expect(texts()).toContain('The server could not load the weekly plan');
  expect(texts()).not.toContain('Internal server detail');
});
