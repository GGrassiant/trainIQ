import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildMockPlanningContext } from '@trainiq/domain';
import { planWeek } from '@trainiq/recommendation';
import type { TrainingDay } from '@trainiq/types';
import { TrainingDayCard } from '../components/TrainingDayCard';
import { TrainingDayModal } from '../components/TrainingDayModal';

export function WeeklyPlanScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const plan = useMemo(() => planWeek(buildMockPlanningContext()), []);
  const [selectedDay, setSelectedDay] = useState<TrainingDay | null>(null);
  const [accepted, setAccepted] = useState(false);

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
