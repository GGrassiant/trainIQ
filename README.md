# TrainIQ

TrainIQ is a training-planning companion for [Intervals.icu](https://intervals.icu). It helps
an athlete plan a training week around real life — availability, recent training,
fatigue/fitness/form, goals, weather, and already-planned workouts — and adapt that plan as
those inputs change.

Intervals.icu remains the source of truth for training data and the calendar; TrainIQ is
intended to become the decision-making and adaptation layer on top of it.

## Product vision

Cycling and running are the primary sports and are planned together rather than as
independent tracks; strength training is a complementary input. When a workout is needed,
TrainIQ prefers an appropriate existing workout from the athlete's Intervals.icu library over
generating a new one, and only creates something new when nothing suitable exists. A selected
workout can then be added to the Intervals.icu calendar.

As the week changes — less available time, different weather, unexpected fatigue, a missed
workout, updated availability — TrainIQ is meant to adapt the remaining plan rather than issue
isolated daily recommendations.

AI may eventually help with reasoning, explanations, and ambiguous decisions, but deterministic
rules stay authoritative for hard training constraints. This is a product goal, not something
implemented yet — see "AI-assisted development" below for how the codebase itself is built
today, which is a separate concern.

TrainIQ is inspired by the training-planning approach of [Join Cycling](https://join.cc/),
particularly its focus on adapting structured training to an athlete's goals, fitness, and
real-life constraints, extended here across both cycling and running.

## Status

TrainIQ's shared, deterministic recommendation engine (`planWeek()`) is functional, and both
the Web and React Native apps run on it today using a mocked `PlanningContext` by default. In
parallel, a development-only Next.js server integration with Intervals.icu now provides real
athlete identity, real training load (CTL/ATL/TSB), and real recent activities server-side.
The remaining planning inputs — preferences, goals, availability, weather, and workout library — still use mock data,
with some of them ultimately intended to remain TrainIQ-owned rather than sourced from Intervals.icu.
The unified backend architecture described below is not implemented yet. See "Development progress" for the exact breakdown.

## Architecture: current vs target

TrainIQ's repository reflects two overlapping architectures: what's implemented today, and
what the product is intended to become.

### Current (development) architecture

Web and React Native each independently build a mock `PlanningContext` and run it through the
shared `planWeek()` engine:

```
Web          → mock PlanningContext → planWeek() → WeeklyPlan
React Native → mock PlanningContext → planWeek() → WeeklyPlan
```

Both use the same `@trainiq/domain` / `@trainiq/recommendation` packages, but run
independently and both currently use mocked planning inputs.

In parallel, a development-only Next.js route demonstrates the first real-data path,
server-side only:

```
Intervals.icu → Next.js server → Intervals client → Intervals mappers
             → PlanningContext → planWeek() → WeeklyPlan
```

This makes the repository temporarily **hybrid**: Web and React Native still compute plans
locally from mock data, while real, Intervals.icu-backed planning only exists behind the
development-only server route described under "Intervals.icu integration" below. The
duplication is intentional — it lets the recommendation engine and the Intervals.icu
integration be built and tested independently — and is not the intended production
architecture.

### Target (production) architecture

TrainIQ is intended to converge on a single backend as the source of truth for weekly
planning:

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

- The Next.js server acts as TrainIQ's backend/API, not only as the web app's renderer.
- Web and React Native both consume a `WeeklyPlan` produced by that backend, instead of each
  independently computing their own.
- React Native talks to the deployed TrainIQ backend directly over HTTP — it does not depend
  on the web app being open or running.
- External API credentials (Intervals.icu, weather, etc.), including future Intervals.icu
  OAuth tokens, stay server-side; client apps authenticate with TrainIQ itself rather than
  embedding third-party secrets.
- `planWeek()` remains a pure, deterministic, platform-independent function. The backend is
  responsible for orchestrating external data, assembling `PlanningContext`, calling
  `planWeek()`, and exposing the result to clients.

Authentication, persistence, weather integration, and a unified production planning API do not
exist yet — this section describes intended direction, not current behavior.

## Development progress

TrainIQ started with a fully mocked `PlanningContext` so the recommendation engine and both
clients could be developed independently, and mocked inputs are now being progressively
replaced with real integrations. "Real integration exists" and "the current Web/RN UI consumes
it" are two different things — the table below tracks them separately.

| Planning input                  | Server integration       | Web / RN UI today       |
| ------------------------------- | ------------------------ | ----------------------- |
| Athlete identity                | **Real** — Intervals.icu | Mock                    |
| Athlete planning preferences    | Mock / TrainIQ-owned     | Mock                    |
| Goals                           | Mock / TrainIQ-owned     | Mock                    |
| Availability                    | Mock / TrainIQ-owned     | Mock                    |
| Training load (CTL / ATL / TSB) | **Real** — Intervals.icu | Mock                    |
| Recent activities               | **Real** — Intervals.icu | Mock                    |
| Weather                         | Mock                     | Mock                    |
| Workout library                 | Mock                     | Mock                    |
| Weekly recommendation           | **Real** — `planWeek()`  | **Real** — `planWeek()` |

"Server integration" reflects the development-only Intervals route
(`buildPlanningContextFromIntervals`); "Web / RN UI today" reflects what the app screens
actually call, which is still the default mock context for every input except the
recommendation engine itself. Connecting Web and React Native to a shared backend that serves
the Intervals-backed context is future work — see "Target (production) architecture" above.

## AI-assisted development

TrainIQ is intentionally built using an AI-assisted engineering workflow:

- **ChatGPT** — product vision, architecture discussions, requirements, implementation
  planning, and technical exploration
- **Claude Code** — primary implementation and coding agent
- **Codex** — independent PR and code review before merge

Product direction, architectural decisions, and final ownership stay with the project author.
Standard engineering practices — type checking, automated tests, and manual verification on
web and iOS — still apply before changes are considered done.

These are development tools, not runtime dependencies: TrainIQ itself does not call an LLM
today. The "AI as a reasoning layer" item under Product vision above describes a possible
future product capability, which is a separate concern from how the codebase is built.

## Structure

```
apps/
  web/            Next.js + TypeScript
  mobile/         React Native (Community CLI) + TypeScript, no Expo

packages/
  types/          @trainiq/types          — shared, platform-independent TS types
  domain/         @trainiq/domain         — shared domain logic (mock data + PlanningContext composition)
  recommendation/ @trainiq/recommendation — recommendation engine (planWeek())
  intervals/      @trainiq/intervals      — read-only Intervals.icu client + mappers
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

Open http://localhost:3000 — you'll see a weekly plan generated by `planWeek()` from mock
`PlanningContext` data.

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

This builds the app and launches it in the iOS Simulator, rendering the same mock-data weekly
plan. If you'd rather start Metro and the simulator separately:

```sh
pnpm --filter mobile start   # Metro bundler
pnpm --filter mobile ios     # in another terminal
```

Android tooling is not documented yet — this project focuses on web + iOS.

## Intervals.icu integration

`@trainiq/intervals` is a **read-only** client: it fetches the athlete profile, wellness
(CTL/ATL), and the previous ~28 days of activities, and maps them into TrainIQ's own
`AthleteIdentity` and `TrainingLoadContext` — replacing `athlete.id`, `athlete.name`, and
`trainingLoad` in `PlanningContext`. `athlete.sports` remains a TrainIQ-owned preference; it is
never inferred from the Intervals.icu profile. `planWeek()` itself is unchanged and has no
knowledge that Intervals.icu exists.

The integration is currently server-side only, exercised through a development-only Next.js
route; Web and React Native do not call it by default yet (see "Current (development)
architecture" above). Calendar sync, workout-library import, writing back to Intervals.icu,
and OAuth are not implemented.

**Local setup:**

1. Generate a personal API key from Intervals.icu (Settings > Developer).
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and set `INTERVALS_API_KEY`.
3. `apps/web/.env.local` is gitignored — never commit a real key, and never put it in a
   `NEXT_PUBLIC_*` variable or in client-side code.

The API key is only ever read server-side
(`apps/web/lib/server/intervals-planning-context.ts`, used by the
`app/api/intervals/planning-context` route handler) and is never sent to the browser or
bundled into the mobile app. `@trainiq/intervals` itself takes credentials via dependency
injection — it has no knowledge of environment variables or of any specific runtime (web,
mobile, or otherwise).
