import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { formatActivityDuration, formatLocalActivityDate } from './formatters';
import { Activity, fetchTrainingOverview } from './trainingOverview';

const LOCALE = 'en-US';
const MISSING = '—';

const numberFormat = new Intl.NumberFormat(LOCALE);

type TextColor = { color: string };

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontWeight: '600',
  },
  activity: {
    paddingVertical: 8,
  },
});

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: TextColor;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, color]}>{label}</Text>
      <Text style={color}>
        {value === null ? MISSING : numberFormat.format(value)}
      </Text>
    </View>
  );
}

function ActivityRow({
  activity,
  color,
}: {
  activity: Activity;
  color: TextColor;
}) {
  const date =
    activity.startDateLocal === null
      ? MISSING
      : formatLocalActivityDate(activity.startDateLocal, LOCALE);
  const duration =
    activity.movingTimeSeconds === null
      ? MISSING
      : formatActivityDuration(activity.movingTimeSeconds, LOCALE);
  const load =
    activity.trainingLoad === null
      ? MISSING
      : numberFormat.format(activity.trainingLoad);

  return (
    <View style={styles.activity}>
      <Text style={[styles.label, color]}>{activity.name ?? MISSING}</Text>
      <Text style={color}>
        {date} · {activity.type ?? MISSING}
      </Text>
      <Text style={color}>
        {duration} · Load {load}
      </Text>
    </View>
  );
}

function TrainingOverviewScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const textColor = { color: isDarkMode ? '#fff' : '#000' };

  const { data, isPending, isError } = useQuery({
    queryKey: ['trainingOverview'],
    queryFn: fetchTrainingOverview,
  });

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel="Loading training data" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={textColor}>Unable to load training data.</Text>
      </View>
    );
  }

  const { trainingState, recentActivities } = data;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, textColor]}>TrainIQ</Text>

      <Text style={[styles.heading, textColor]}>Current training state</Text>
      <StatRow
        label="Fitness"
        value={trainingState.fitness}
        color={textColor}
      />
      <StatRow
        label="Fatigue"
        value={trainingState.fatigue}
        color={textColor}
      />
      <StatRow label="Form" value={trainingState.form} color={textColor} />

      <Text style={[styles.heading, textColor]}>Recent activities</Text>
      {recentActivities.length === 0 ? (
        <Text style={textColor}>No activities yet.</Text>
      ) : (
        recentActivities.map(activity => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            color={textColor}
          />
        ))
      )}
    </ScrollView>
  );
}

export default TrainingOverviewScreen;
