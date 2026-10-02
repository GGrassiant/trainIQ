# Original vision (archived)

## Initial product vision

TrainIQ was meant to be a planning companion for
[Intervals.icu](https://intervals.icu):

- fetch the athlete's training data;
- build a cycling/running week;
- optionally take fatigue/fitness and weather into account;
- reuse existing workouts from the athlete's library;
- generate a workout only when no suitable one exists;
- eventually write the plan back to Intervals;
- run on Web and React Native;
- possibly become multi-user later.

## What was explored

- A deterministic `planWeek()` recommendation engine.
- A `PlanningContext` aggregating athlete, load, availability, library and weather.
- Dedicated `intervals` and `weather` packages (clients, validation, mappers,
  workout classification).
- tRPC, with Next.js as the planning backend for both clients.
- Supabase Auth (GitHub login, server-side cookie sessions).
- A generated TypeScript contract shared between Web and React Native.
- An architecture anticipating multiple users.

## Why it was reset

- The architecture grew faster than the product.
- Abstractions were introduced before they were needed.
- The system became increasingly hard to understand and change.
- We want to rebuild progressively, starting from concrete needs.

The Git history remains the technical archive of that prototype.

None of the previous architectural choices are commitments for the rebooted project.
