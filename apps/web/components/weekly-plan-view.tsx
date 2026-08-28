"use client";

import { useState } from "react";
import type { WeeklyPlan } from "@trainiq/types";
import { Button } from "@/components/ui/button";
import { TrainingDayCard } from "@/components/training-day-card";
import { CheckIcon } from "lucide-react";

export function WeeklyPlanView({ plan }: { plan: WeeklyPlan }) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground">{plan.summary}</p>
        {plan.rationale && <p>{plan.rationale}</p>}
        {plan.unmetRequirements.map((requirement) => (
          <p key={requirement} className="text-destructive">
            {requirement}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {plan.days.map((day) => (
          <TrainingDayCard key={day.dayOfWeek} day={day} />
        ))}
      </div>

      <Button onClick={() => setAccepted(true)} disabled={accepted} className="self-start">
        {accepted ? (
          <>
            <CheckIcon /> Plan accepted
          </>
        ) : (
          "Accept plan"
        )}
      </Button>
    </div>
  );
}
