const TRAINIQ_API_URL = 'http://localhost:3000';

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

export async function fetchTrainingOverview(): Promise<TrainingOverview> {
  const response = await fetch(`${TRAINIQ_API_URL}/api/training-overview`);

  if (!response.ok) {
    throw new Error(`TrainIQ API responded ${response.status}`);
  }

  return response.json();
}
