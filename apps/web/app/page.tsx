import { buildMockPlanningContext } from "@trainiq/domain";
import { planWeek } from "@trainiq/recommendation";
import { WeeklyPlanView } from "@/components/weekly-plan-view";

export default function Home() {
  const plan = planWeek(buildMockPlanningContext());

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 self-center px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">TrainIQ</h1>
        <p className="text-muted-foreground">Plan my next week</p>
      </div>
      <WeeklyPlanView plan={plan} />
    </main>
  );
}
