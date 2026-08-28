"use client";

import type { TrainingDay } from "@trainiq/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { capitalize, formatDuration } from "@/lib/format";

const SPORT_BADGE_VARIANT = { cycling: "default", running: "secondary", strength: "outline" } as const;

function sessionTitle(day: TrainingDay): string {
  if (day.status === "recommended") return day.workout.name;
  if (day.status === "fixed") return day.label;
  return "No suitable workout found";
}

function sessionReasoning(day: TrainingDay): string[] {
  return day.status === "unresolved" ? [day.reason] : day.reasoning;
}

export function TrainingDayCard({ day }: { day: TrainingDay }) {
  return (
    <Dialog>
      <DialogTrigger className="w-full text-left">
        <Card className="transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardDescription className="truncate">{capitalize(day.dayOfWeek)}</CardDescription>
            <CardTitle className="truncate">{sessionTitle(day)}</CardTitle>
            <CardAction>
              <Badge variant={SPORT_BADGE_VARIANT[day.sport]}>{capitalize(day.sport)}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="text-muted-foreground">{formatDuration(day.durationMinutes)}</CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sessionTitle(day)}</DialogTitle>
          <DialogDescription>
            {capitalize(day.dayOfWeek)} · {capitalize(day.sport)} · {formatDuration(day.durationMinutes)}
          </DialogDescription>
        </DialogHeader>
        {day.status === "recommended" && <p>{day.workout.description}</p>}
        <Separator />
        <div className="flex flex-col gap-2">
          <p className="font-medium">{day.status === "unresolved" ? "Why unresolved" : "Why this session"}</p>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {sessionReasoning(day).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
