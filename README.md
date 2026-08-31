# TrainIQ

TrainIQ is a training-planning companion for [Intervals.icu](https://intervals.icu).
It is designed to help an athlete plan training around real life, then continuously
adapt that plan as availability, weather, and training status change.

Intervals.icu remains the source of truth for training data and the calendar. TrainIQ
is intended to be the decision-making and adaptation layer on top of that data.

## Product inspiration

TrainIQ is inspired by the training-planning approach of [Join
Cycling](https://join.cc/), particularly its focus on adapting structured training to an
athlete's goals, fitness and real-life constraints.

TrainIQ explores a broader version of this idea across cycling and running,
with Intervals.icu as the source of truth for training data and scheduling.

## Product vision

The planned workflow starts with a weekly review of availability, recent training,
fatigue, fitness, form, goals, weather, and already planned workouts. TrainIQ will
help turn that context into a realistic weekly plan.

The initial sports are cycling and running. They will be considered together when
distributing training across the week, rather than as independent plans.

When a workout is needed, TrainIQ will prefer an appropriate existing workout from
the athlete's Intervals.icu library. It will only generate a new workout when no
suitable existing workout is available. A selected workout may then be added to the
Intervals.icu calendar.

As the week changes — for example through less available time, different weather,
unexpected fatigue, a missed workout, or updated availability — TrainIQ is intended
to adapt the remaining plan instead of making isolated daily recommendations.

AI is planned as a reasoning and explanation layer. It will not be the authority for
hard training constraints.

## Status

TrainIQ is an early learning/portfolio project. The workflow above describes product
goals and planned functionality; it is not implemented yet. The repository currently
contains the web and mobile monorepo bootstrap.

## Architecture: current vs target

TrainIQ's repository currently reflects two overlapping architectures: what's
actually implemented today, and what the product is intended to become. This
section makes that distinction explicit — see "Development progress" below
for exactly which inputs are real today.

### Current (development) architecture

Today, the web and React Native apps each independently build a mock
`PlanningContext` and run it through the shared, deterministic `planWeek()`
recommendation engine:

```
Web          → mock PlanningContext → planWeek() → WeeklyPlan
React Native → mock PlanningContext → planWeek() → WeeklyPlan
```

These are independent executions: both use the same shared
`@trainiq/domain`/`@trainiq/recommendation` packages, but neither talks to
the other, and neither is backed by real data.

In parallel, a development-only Next.js API route demonstrates the first
real-data planning path, server-side only:

```
Intervals.icu → Next.js server → Intervals client → Intervals mappers
             → PlanningContext → planWeek() → WeeklyPlan
```

This makes the repository temporarily **hybrid**:

- Web can still calculate a plan locally from mock data.
- React Native can still calculate a plan locally from mock data.
- Real, Intervals.icu-backed planning currently only exists behind the
  development-only server route described under "Intervals.icu integration"
  below.

This duplication is transitional — it lets the shared recommendation engine
and the Intervals.icu integration each be built and tested independently. It
is not the intended production architecture.

### Target (production) architecture

TrainIQ is intended to converge on a single backend as the source of truth
for weekly planning:

```
Web ──────────────┐
                   │
React Native ──────┤
                   ▼
             TrainIQ Backend
               (Next.js)
                   │
           ┌───────┼────────┐
           ▼       ▼        ▼
      Intervals  Weather  Database
           │       │        │
           └───────┼────────┘
                   ▼
            PlanningContext
                   │
              planWeek()
                   │
                   ▼
             WeeklyPlan
                   │
              ┌────┴────┐
              ▼         ▼
             Web    React Native
```

In this target state:

- The Next.js server acts as TrainIQ's backend/API, not only as the web
  app's renderer.
- Web and React Native both consume a `WeeklyPlan` produced by that backend,
  instead of each independently computing their own.
- React Native talks to the deployed TrainIQ backend directly over HTTP — it
  does not depend on the web app being open or running.
- External API credentials (Intervals.icu, weather, etc.), including future
  Intervals.icu OAuth tokens, stay server-side; client apps authenticate with
  TrainIQ itself rather than embedding third-party secrets.
- `planWeek()` remains a pure, deterministic, platform-independent function.
  The backend is responsible for orchestrating external data, assembling
  `PlanningContext`, calling `planWeek()`, and exposing the result to clients.

Authentication, persistence, weather integration, and a unified production
planning API do not exist yet — this section describes intended direction,
not current behavior.

## Development progress

TrainIQ is being developed incrementally by replacing mocked `PlanningContext`
inputs with real integrations one at a time, while keeping the recommendation
engine independent of where its input data comes from. "Real integration
exists" and "the current Web/RN UI consumes it" are two different things —
the table below tracks them separately.

| Planning input | Server integration | Web / RN UI today |
| --- | --- | --- |
| Athlete identity | **Real** — Intervals.icu | Mock |
| Athlete planning preferences (sports) | Mock / TrainIQ-owned | Mock |
| Goals | Mock / TrainIQ-owned | Mock |
| Availability | Mock / TrainIQ-owned | Mock |
| Training load (CTL / ATL / TSB) | **Real** — Intervals.icu | Mock |
| Recent activities | **Real** — Intervals.icu | Mock |
| Weather | Mock | Mock |
| Workout library | Mock | Mock |
| Weekly recommendation | **Real** — `planWeek()` | **Real** — `planWeek()` |

The "Server integration" column reflects the development-only Intervals
route (`buildPlanningContextFromIntervals`), which already fetches real
athlete identity, training load, and recent activities from Intervals.icu
and runs them through the real `planWeek()` engine. The "Web / RN UI today"
column reflects what the actual app screens use, which is still the default
mock `PlanningContext` for every input — the apps don't call that route yet.
`planWeek()` itself is the one input that's already real and shared on both
paths. Connecting the Web and React Native UIs to a shared backend that
serves the Intervals-backed context is a future step (see "Target
(production) architecture" above).

## Development process

TrainIQ is being built with AI-assisted coding tools (Claude Code) as part of the normal
development workflow, alongside standard engineering practices — code review, type
checking, automated tests, and manual verification on web and iOS before changes are
considered done.

This is a statement about how the codebase is built, not about the product: TrainIQ
itself does not use AI today. The "AI as a reasoning and explanation layer" item under
Product vision above is a future capability, not something implemented yet.

## Structure

```
apps/
  web/            Next.js + TypeScript
  mobile/         React Native (Community CLI) + TypeScript, no Expo

packages/
  types/          @trainiq/types          — shared, platform-independent TS types
  domain/         @trainiq/domain         — shared domain logic (mock data + PlanningContext composition)
  recommendation/ @trainiq/recommendation — recommendation engine (planWeek())
  intervals/      @trainiq/intervals      — read-only Intervals.icu client + mappers (V0.3)
```

Package manager: **pnpm workspaces**, with `node-linker=hoisted` in `.npmrc` (chosen to
avoid Metro/CocoaPods autolinking issues with pnpm's default symlinked
`node_modules` — see `.npmrc`).

Shared packages export raw TypeScript source directly (no build step). Next.js consumes
them via `transpilePackages` in `apps/web/next.config.ts`; the mobile app's
`apps/mobile/metro.config.js` watches the monorepo root so Metro can resolve them too.

## Prerequisites

- Node.js >= 22.13.0 (required by React Native 0.87)
- [pnpm](https://pnpm.io) (`corepack enable` will pick up the pinned version)
- Xcode + an iOS Simulator (for mobile)
- Ruby + [Bundler](https://bundler.io) (for CocoaPods — see `apps/mobile/Gemfile`;
  do not install CocoaPods globally via Homebrew, the project pins its version through
  Bundler instead)
- [Watchman](https://facebook.github.io/watchman/) (recommended): `brew install watchman`

## Install

From the repo root:

```sh
pnpm install
```

This installs dependencies for every app and package in the workspace in one step.

## Running the web app

```sh
pnpm --filter web dev
```

Open http://localhost:3000.

## Running the mobile app on iOS

First time only — install the Ruby gems (CocoaPods, pinned via Bundler) and the native
iOS dependencies:

```sh
cd apps/mobile
bundle install
cd ios
bundle exec pod install
cd ../../..
```

Always run CocoaPods through `bundle exec pod install` rather than a global `pod`
install — this keeps the CocoaPods version reproducible across machines, as pinned in
`apps/mobile/Gemfile`.

Then, from anywhere in the repo:

```sh
pnpm --filter mobile ios
```

This builds the app and launches it in the iOS Simulator. If you'd rather start Metro
and the simulator separately:

```sh
pnpm --filter mobile start   # Metro bundler
pnpm --filter mobile ios     # in another terminal
```

Android tooling is not documented yet — this bootstrap focuses on web + iOS.

## Intervals.icu integration (V0.3)

TrainIQ's first Intervals.icu integration is **read-only**: `@trainiq/intervals` fetches
the athlete profile, wellness (CTL/ATL), and the previous ~28 days of activities, and
maps them into TrainIQ's own `AthleteIdentity` and `TrainingLoadContext` — replacing
only `athlete.id`, `athlete.name`, and `trainingLoad` in `PlanningContext`. `athlete.sports`
remains a TrainIQ-owned preference; it is never inferred from the Intervals.icu profile.
`planWeek()` itself is unchanged and has no knowledge that Intervals.icu exists; it
consumes whatever `PlanningContext` it's given.

Calendar sync, workout-library import, writing back to Intervals.icu, and OAuth are not
implemented yet — this integration only reads wellness and activity data.

**Local setup:**

1. Generate a personal API key from Intervals.icu (Settings > Developer).
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and set `INTERVALS_API_KEY`.
3. `apps/web/.env.local` is gitignored — never commit a real key, and never put it in a
   `NEXT_PUBLIC_*` variable or in client-side code.

The API key is only ever read server-side (`apps/web/lib/server/intervals-planning-context.ts`,
used by the `app/api/intervals/planning-context` route handler) and is never sent to the
browser or bundled into the mobile app. `@trainiq/intervals` itself takes credentials via
dependency injection — it has no knowledge of environment variables or of any specific
runtime (web, mobile, or otherwise).

## Verifying the shared packages

Both apps import `AppEnvironment` from `@trainiq/types` and render a small line
confirming the monorepo is wired up correctly. If you see "Monorepo configured: true"
on the web homepage and in the mobile app, the workspace linking is working.
