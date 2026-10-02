# TrainIQ

TrainIQ is an experimental training-planning app built with:

- Next.js
- React Native
- TypeScript
- pnpm workspaces

The project is intentionally starting from a minimal working monorepo. The goal
is to add product and architecture incrementally, only when a concrete need
appears.

## Apps

- `apps/web` — Next.js
- `apps/mobile` — React Native Community CLI (no Expo)

## Development

Requires Node.js 22 (>= 22.13), 24 (>= 24.3), or >= 26, and pnpm (`corepack enable` picks up the pinned
version).

```sh
pnpm install
```

Web app (http://localhost:3000):

```sh
pnpm --filter web dev
```

Mobile app (iOS needs Xcode and Ruby/Bundler):

```sh
cd apps/mobile && bundle install && cd ios && bundle exec pod install && cd ../../..
pnpm --filter mobile start   # Metro
pnpm --filter mobile ios     # or: pnpm --filter mobile android
```

## Checks

```sh
pnpm -r run lint
pnpm -r run typecheck
pnpm --filter mobile test
```

TypeScript is pinned to 5.9.3 in both apps; no shared config is needed.
ESLint remains separate (Web 9, Mobile 8) because React Native 0.87.1
depends on eslint-plugin-ft-flow 2.x, which requires ESLint 8 and uses APIs
removed in ESLint 9, including in its flat config.

## Previous prototype

TrainIQ previously explored a more ambitious architecture including adaptive
weekly planning, Intervals.icu integration, weather, tRPC and authentication.
That implementation was intentionally reset after the architecture grew faster
than the product.

See [`docs/archive/original-vision.md`](docs/archive/original-vision.md) for the
original direction and lessons learned.
