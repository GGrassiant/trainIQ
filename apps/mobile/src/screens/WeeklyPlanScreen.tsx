import { useEffect, useState } from 'react';
import { TRPCClientError } from '@trpc/client';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TrainingDay, WeeklyPlan } from '@trainiq/types';
import { trpc } from '../api/trpc';
import { TrainingDayCard } from '../components/TrainingDayCard';
import { TrainingDayModal } from '../components/TrainingDayModal';

export function WeeklyPlanScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedDay, setSelectedDay] = useState<TrainingDay | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let active = true;

    trpc.planning.getWeeklyPlan.query(undefined, { signal: controller.signal })
      .then(result => {
        if (active) setPlan(result);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        const serverError = failure instanceof TRPCClientError && failure.data?.code;
        setError(serverError
          ? 'The server could not load the weekly plan. Check its configuration and try again.'
          : 'Cannot reach the planning server. Check your connection and backend URL.');
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  if (!plan) {
    return (
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text variant="headlineMedium">TrainIQ</Text>
        <Text accessibilityRole={error ? 'alert' : 'text'}>
          {error ?? 'Loading weekly plan…'}
        </Text>
        {error && (
          <Button onPress={() => {
            setError(null);
            setAttempt(attempt + 1);
          }}>
            Try again
          </Button>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
    >
      <View style={styles.header}>
        <Text variant="headlineMedium">TrainIQ</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Plan my next week
        </Text>
        <Text variant="bodyMedium" style={styles.summary}>
          {plan.summary}
        </Text>
        <Text variant="bodyMedium" style={styles.rationale}>
          {plan.rationale}
        </Text>
        {plan.unmetRequirements.map((requirement) => (
          <Text key={requirement} variant="bodyMedium" style={[styles.rationale, { color: theme.colors.error }]}>
            {requirement}
          </Text>
        ))}
      </View>

      {plan.days.map((day) => (
        <TrainingDayCard key={day.dayOfWeek} day={day} onPress={() => setSelectedDay(day)} />
      ))}

      <Button mode="contained" onPress={() => setAccepted(true)} disabled={accepted} style={styles.acceptButton}>
        {accepted ? 'Plan accepted' : 'Accept plan'}
      </Button>

      <TrainingDayModal day={selectedDay} visible={selectedDay !== null} onDismiss={() => setSelectedDay(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 16, gap: 4 },
  subtitle: { opacity: 0.7 },
  summary: { marginTop: 8 },
  rationale: { marginTop: 8 },
  acceptButton: { marginHorizontal: 16, marginTop: 8, alignSelf: 'flex-start' },
});
