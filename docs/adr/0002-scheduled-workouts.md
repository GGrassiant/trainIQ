# ADR 0002 — Scheduled workouts are planning context, not fixed commitments

## Status

Accepted

## Context

Intervals.icu exposes date-scheduled workouts through its calendar API.

A scheduled workout tells TrainIQ what is currently planned on a given
date, but the observed API data provides no reliable indication that the
workout is immovable.

A calendar workout may have been manually scheduled by the athlete,
created by another planning system, or eventually written by TrainIQ
itself.

Treating every scheduled workout as a fixed commitment would prevent
TrainIQ from recommending changes to an existing plan.

## Decision

TrainIQ models Intervals calendar workouts as `ScheduledWorkout`.

The following concepts remain separate:

- `Workout` / `workoutLibrary`: workouts available for selection.
- `ScheduledWorkout` / `scheduledWorkouts`: workouts currently planned
  on specific dates.
- Availability / fixed commitments: TrainIQ-owned constraints describing
  when training is possible and what must not be moved.

In V1, `scheduledWorkouts` is included in `PlanningContext` but is not
consumed by `planWeek()`.

Intervals calendar events are therefore not automatically converted into
`FixedCommitmentDay`.

Only observed `WORKOUT` events are mapped. Other Intervals calendar
categories remain unsupported until their semantics are understood from
real data.

## Consequences

TrainIQ can observe an existing Intervals plan without treating it as
authoritative.

A future recommendation layer can compare the existing plan with the
TrainIQ recommendation and explicitly decide whether to keep, replace,
or move scheduled workouts.

Determining whether something is genuinely fixed requires TrainIQ-owned
information or another reliable signal; it is not inferred from the
presence of an Intervals calendar event.
