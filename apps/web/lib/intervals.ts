import "server-only";

// Athlete id 0 means "the athlete who owns the API key".
const ATHLETE_URL = "https://intervals.icu/api/v1/athlete/0";

type IntervalsAthlete = {
  timezone?: string | null;
};

type IntervalsWellness = {
  ctl?: number | null;
  atl?: number | null;
};

type IntervalsActivity = {
  id: string;
  name?: string | null;
  type?: string | null;
  start_date_local?: string | null;
  moving_time?: number | null;
  icu_training_load?: number | null;
};

export type TrainingState = {
  fitness: number | null;
  fatigue: number | null;
  form: number | null;
};

export type Activity = {
  id: string;
  name: string | null;
  type: string | null;
  startDateLocal: string | null;
  movingTimeSeconds: number | null;
  trainingLoad: number | null;
};

export type TrainingOverview = {
  trainingState: TrainingState;
  recentActivities: Activity[];
};

async function fetchIntervals<T>(apiKey: string, path: string): Promise<T> {
  const response = await fetch(`${ATHLETE_URL}${path}`, {
    headers: {
      // Intervals uses Basic auth with the literal username "API_KEY".
      Authorization: `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString("base64")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Intervals.icu responded ${response.status} for ${path || "/"}`);
  }

  return response.json();
}

// Form (CTL - ATL) is computed before rounding, so it can differ by 1 from
// the displayed Fitness - Fatigue.
function toTrainingState(wellness: IntervalsWellness): TrainingState {
  const ctl = wellness.ctl ?? null;
  const atl = wellness.atl ?? null;

  let form: number | null = null;
  if (ctl !== null && atl !== null) {
    form = Math.round(ctl - atl);
  }

  return {
    fitness: ctl === null ? null : Math.round(ctl),
    fatigue: atl === null ? null : Math.round(atl),
    form,
  };
}

function toActivity(activity: IntervalsActivity): Activity {
  return {
    id: activity.id,
    name: activity.name ?? null,
    type: activity.type ?? null,
    startDateLocal: activity.start_date_local ?? null,
    movingTimeSeconds: activity.moving_time ?? null,
    trainingLoad: activity.icu_training_load ?? null,
  };
}

function formatLocalDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

export async function getTrainingOverview(): Promise<TrainingOverview | null> {
  const apiKey = process.env.INTERVALS_API_KEY;
  if (!apiKey) {
    throw new Error("INTERVALS_API_KEY is required.");
  }

  try {
    const athlete = await fetchIntervals<IntervalsAthlete>(apiKey, "");
    if (!athlete.timezone) {
      throw new Error("Intervals.icu athlete has no timezone");
    }
    const today = formatLocalDate(new Date(), athlete.timezone);

    const [wellness, activities] = await Promise.all([
      fetchIntervals<IntervalsWellness>(apiKey, `/wellness/${today}`),
      fetchIntervals<IntervalsActivity[]>(
        apiKey,
        "/activities?oldest=1970-01-01&limit=5",
      ),
    ]);

    return {
      trainingState: toTrainingState(wellness),
      recentActivities: activities.map(toActivity),
    };
  } catch (error) {
    console.error("Unable to load Intervals.icu data:", error);
    return null;
  }
}
