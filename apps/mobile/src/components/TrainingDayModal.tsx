import { StyleSheet, View } from 'react-native';
import { Button, Divider, Modal, Portal, Text, useTheme } from 'react-native-paper';
import type { TrainingDay } from '@trainiq/types';
import { capitalize, formatDuration } from '../format';

function sessionTitle(day: TrainingDay): string {
  if (day.status === 'recommended') return day.workout.name;
  if (day.status === 'fixed') return day.label;
  return 'No suitable workout found';
}

function sessionReasoning(day: TrainingDay): string[] {
  return day.status === 'unresolved' ? [day.reason] : day.reasoning;
}

export function TrainingDayModal({
  day,
  visible,
  onDismiss,
}: {
  day: TrainingDay | null;
  visible: boolean;
  onDismiss: () => void;
}) {
  const theme = useTheme();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.container, { backgroundColor: theme.colors.elevation.level2 }]}
      >
        {day && (
          <View>
            <Text variant="titleLarge">{sessionTitle(day)}</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              {capitalize(day.dayOfWeek)} · {capitalize(day.sport)} · {formatDuration(day.durationMinutes)}
            </Text>
            {day.status === 'recommended' && (
              <Text variant="bodyMedium" style={styles.description}>
                {day.workout.description}
              </Text>
            )}
            <Divider style={styles.divider} />
            <Text variant="titleMedium">{day.status === 'unresolved' ? 'Why unresolved' : 'Why this session'}</Text>
            {sessionReasoning(day).map((reason) => (
              <Text key={reason} variant="bodyMedium" style={styles.reason}>
                • {reason}
              </Text>
            ))}
            <Button mode="outlined" onPress={onDismiss} style={styles.closeButton}>
              Close
            </Button>
          </View>
        )}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: { margin: 24, padding: 20, borderRadius: 12 },
  subtitle: { marginTop: 4, opacity: 0.7 },
  description: { marginTop: 12 },
  divider: { marginVertical: 16 },
  reason: { marginTop: 6 },
  closeButton: { marginTop: 20, alignSelf: 'flex-start' },
});
