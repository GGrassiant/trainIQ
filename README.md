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
  types/          @trainiq/types       — shared, platform-independent TS types
  domain/         @trainiq/domain      — shared domain logic (empty for now)
  recommendation/ @trainiq/recommendation — recommendation engine (empty for now)
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

## Verifying the shared packages

Both apps import `AppEnvironment` from `@trainiq/types` and render a small line
confirming the monorepo is wired up correctly. If you see "Monorepo configured: true"
on the web homepage and in the mobile app, the workspace linking is working.
