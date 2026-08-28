# TrainIQ

TrainIQ is a companion app for [Intervals.icu](https://intervals.icu). Given how much
time you have today, your recent training load, fatigue/form, training history, and
planned workouts, it aims to answer: **what is the best training session I can do
today?**

This is a learning/portfolio project. No product features are implemented yet — this
is just the monorepo bootstrap.

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
