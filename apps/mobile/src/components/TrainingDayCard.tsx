import { StyleSheet } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';
import type { Sport, TrainingDay } from '@trainiq/types';
import { capitalize, formatDuration } from '../format';

function SportBadge({ sport }: { sport: Sport }) {
  return (
    <Chip compact style={styles.chip}>
      {capitalize(sport)}
    </Chip>
  );
}

function sessionTitle(day: TrainingDay): string {
  if (day.status === 'recommended') return day.workout.name;
  if (day.status === 'fixed') return day.label;
  return 'No suitable workout found';
}

export function TrainingDayCard({ day, onPress }: { day: TrainingDay; onPress: () => void }) {
  return (
    <Card style={styles.card} mode="outlined" onPress={onPress}>
      <Card.Title
        title={sessionTitle(day)}
        subtitle={capitalize(day.dayOfWeek)}
        right={() => <SportBadge sport={day.sport} />}
      />
      <Card.Content>
        <Text variant="bodyMedium">{formatDuration(day.durationMinutes)}</Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12 },
  chip: { marginRight: 16 },
});
