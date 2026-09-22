# TrainIQ

TrainIQ is a training-planning companion for [Intervals.icu](https://intervals.icu),
built independently and not affiliated with it. It aims to help athletes plan and
adapt a week of cycling and running around availability, goals and recent training,
with complementary strength work.

Intervals.icu supplies training data, a workout library and an existing calendar.
TrainIQ owns the planning rules and constraints used to recommend a week. The
longer-term goal is to adapt that recommendation as circumstances change, with
weather and optional AI assistance informing decisions while deterministic rules
continue to enforce training constraints.

## What works today

The shared `planWeek()` engine selects existing workouts, respects fixed
commitments, allocates endurance and strength sessions, and explains its decisions.
When no compatible workout exists, it returns an explicit `unresolved` slot; it
does not generate a replacement workout.

**Web and React Native still use mock planning inputs.** A separate,
development-only Next.js route assembles real Intervals.icu data server-side and
runs the same engine.

| Input or capability | Development server integration | Web / RN screens |
| --- | --- | --- |
| Athlete identity | Real — Intervals.icu | Mock |
| CTL / ATL / TSB and recent activities | Real — Intervals.icu | Mock |
| Workout library | Real — Intervals.icu, with TrainIQ classification | Mock |
| Scheduled workouts | Real — Intervals.icu calendar, read-only context | Empty mock context; not displayed |
| Planning preferences, goals and availability | Mock; TrainIQ-owned | Mock |
| Weather | Mock | Mock |
| Weekly recommendation | Shared `planWeek()` engine | Shared `planWeek()` engine |

Scheduled workouts describe what is already planned; they do not automatically
become fixed commitments and do not influence `planWeek()` in V1. Workout
classification uses provisional, deterministic rules based on structured zone data.

There is no calendar write-back, workout generation, OAuth, persistence, live
weather integration or runtime LLM call. The real-data route is not a production
planning API.

## Architecture

Today, each app builds a mock context and runs the shared engine. The development
server route provides a separate path through the external-data boundary:

```text
Web / React Native → mock PlanningContext → planWeek() → WeeklyPlan

Intervals.icu → server client + mappers → PlanningContext → planWeek() → WeeklyPlan
```

External payloads and provider-specific interpretation stay in `@trainiq/intervals`.
The planner receives TrainIQ domain types and performs no API calls. Its result is
deterministic for a given context; current development instrumentation still emits
logs.

The target architecture is a shared Next.js backend that assembles the context and
serves a `WeeklyPlan` to both clients over HTTP. Provider credentials stay on the
server. Authentication, persistence and additional integrations remain future work.

```text
apps/
  web/             Next.js + React + TypeScript
  mobile/          React Native Community CLI + TypeScript (no Expo)
packages/
  types/           Shared domain contracts
  domain/          Mock data and PlanningContext composition
  recommendation/  Deterministic weekly planning
  intervals/       Read-only client, boundary validation, mappers and classification
```

The monorepo uses pnpm workspaces. Shared packages export TypeScript source directly;
Next.js transpiles them and Metro resolves them from the workspace. The hoisted
node linker in `.npmrc` supports React Native autolinking.

See the [architecture decision records](docs/adr/README.md) for the reasoning behind
[workout classification](docs/adr/0001-workout-classification.md),
[scheduled workouts](docs/adr/0002-scheduled-workouts.md), and the
[planning engine contract](docs/adr/0003-planning-engine-contract.md).

## Setup

Required: Node.js >= 22.13.0 and pnpm (the version is pinned in `package.json`;
`corepack enable` enables it). For iOS, install Xcode with a simulator and Ruby with
Bundler. Watchman is recommended for React Native. Android setup is not documented
yet; current development focuses on web and iOS.

From the repository root:

```sh
pnpm install
pnpm --filter web dev
```

Open http://localhost:3000 to see a weekly plan built from mock data.

### iOS

Install the native dependencies once, using the CocoaPods version pinned through
Bundler rather than a global installation:

```sh
cd apps/mobile
bundle install
cd ios
bundle exec pod install
cd ../../..
pnpm --filter mobile ios
```

To start Metro separately, run `pnpm --filter mobile start` in another terminal.

### Optional Intervals.icu development route

1. Create a personal API key in Intervals.icu under Settings > Developer.
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and set `INTERVALS_API_KEY`.
3. Start the web development server and open
   http://localhost:3000/api/intervals/planning-context to inspect `{ context, plan }`.

The route reads recent training data and the upcoming week's calendar. It is
available only in development and returns 404 otherwise. The API key stays
server-side: never commit `.env.local`, expose the key through `NEXT_PUBLIC_*`, or
embed it in the mobile app. No provider credentials are needed for the mock screens
or automated tests.

## Validation

Run from the repository root:

```sh
# Shared engine, Intervals boundary and web integration tests (Vitest)
pnpm --filter @trainiq/recommendation --filter @trainiq/intervals --filter web test

# Mobile tests (Jest)
pnpm --filter mobile test --runInBand

# Typecheck shared packages and both apps
pnpm --filter @trainiq/types --filter @trainiq/domain --filter @trainiq/recommendation --filter @trainiq/intervals --filter web --filter mobile exec tsc --noEmit

# App lint and patch whitespace
pnpm --filter web lint
pnpm --filter mobile lint
git diff --check
```

Known validation gap: the mobile typecheck currently fails on the planner's
development logging reference to `process.env.VITEST`. Mobile tests and lint pass;
the logging dependency is a separate cleanup task.

Tests protect planner decisions, classification rules and external-data boundaries.
Changes affecting screens also receive manual verification on web and iOS.

## AI-assisted development

AI tools, including ChatGPT, Claude Code and Codex, support several responsibilities:

- Exploring product requirements, architecture and implementation options.
- Implementing scoped changes and running validation.
- Independently reviewing behavior, tests and maintainability before merge.

Tool assignments can vary. The project author sets direction, evaluates proposals,
reviews the code and validation evidence, and retains final ownership of product and
architecture decisions. AI-assisted development does not replace typechecks, tests
or manual verification, and is separate from any future AI capability in TrainIQ.
