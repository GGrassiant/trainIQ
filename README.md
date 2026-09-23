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

**Next.js is the weekly planning source of truth for Web and React Native.**
Both clients use `planning.getWeeklyPlan`: Web through a local tRPC server caller
(no HTTP), React Native through the vanilla tRPC HTTP client.

| Input | Server source |
| --- | --- |
| Athlete identity | Intervals.icu |
| CTL / ATL / TSB and recent activities | Intervals.icu |
| Workout library | Intervals.icu, with TrainIQ classification |
| Scheduled workouts | Intervals.icu calendar, read-only context |
| Sports, goals, availability and fixed commitments | TrainIQ prototype values |
| Weather | Open-Meteo daily conditions at the configured prototype location |

Scheduled workouts describe what is already planned; they do not automatically
become fixed commitments and do not influence `planWeek()` in V1. Workout
classification uses provisional, deterministic rules based on structured zone data.

There is no authentication, user persistence, calendar write-back, workout generation,
OAuth or runtime LLM call. The real backend is development-only, not multi-user or
production-ready. Accepting a plan still only changes local UI state.

## Architecture

```text
Web Server Component → local tRPC caller ────────────┐
                                                    ▼
RN → vanilla tRPC client → HTTP → Next handler → planning.getWeeklyPlan
                                                    │
                                          generateWeeklyPlan(now)
                                                    │
                                      buildServerPlanningContext(now)
                                        Intervals + Weather + prototype preferences
                                                    │
                                              planWeek(context)
                                                    │
                                                WeeklyPlan
```

`PlanningContext` stays internal to the server. Clients neither build it nor run
`planWeek()`. Provider credentials stay server-side. The development-only guard is
shared by HTTP and local callers and runs before provider access. Do not expose
`next dev` publicly: the environment guard is not authentication.

External payloads and interpretation stay in `@trainiq/intervals` and
`@trainiq/weather`. The deterministic planner knows nothing about Next, tRPC or
HTTP. Intervals failures produce an error, never a mock fallback; unavailable
weather becomes `unknown`. Preferences remain explicitly prototype data.

TanStack Query is planned for subsequent client interactions that benefit from
cache, mutations and invalidation, on RN and interactive Web components. This PR
isolates tRPC; its vanilla client has no custom cache or query-management framework.

```text
apps/
  web/             Next.js + React + TypeScript
  mobile/          React Native Community CLI + TypeScript (no Expo)
packages/
  types/           Shared domain contracts
  domain/          Mock data and PlanningContext composition
  recommendation/  Deterministic weekly planning
  intervals/       Read-only client, boundary validation, mappers and classification
  weather/         Open-Meteo client, boundary validation and daily conditions
```

The monorepo uses pnpm workspaces. Shared packages export TypeScript source directly;
Next.js transpiles them and Metro resolves them from the workspace. The hoisted
node linker in `.npmrc` supports React Native autolinking.

See the [architecture decision records](docs/adr/README.md) for the reasoning behind
[workout classification](docs/adr/0001-workout-classification.md),
[scheduled workouts](docs/adr/0002-scheduled-workouts.md), and the
[planning engine contract](docs/adr/0003-planning-engine-contract.md), plus the
[shared backend decision](docs/adr/0004-next-backend-planning-source-of-truth.md).

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

Configure the providers below, then open http://localhost:3000. Keep Next running
while using the mobile app. No provider credentials are required by automated tests.

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

### Real-data local backend

1. Create a personal API key in Intervals.icu under Settings > Developer.
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and set `INTERVALS_API_KEY`,
   `TRAINIQ_WEATHER_LATITUDE`, `TRAINIQ_WEATHER_LONGITUDE` and
   `TRAINIQ_WEATHER_TIMEZONE` (IANA timezone, e.g. `America/Toronto`).
3. Run `pnpm --filter web dev`. Web and RN now use the same server generation path.

The backend targets next Monday–Sunday in the configured timezone. The key must
never be committed, exposed through `NEXT_PUBLIC_*`, or embedded in mobile.
Outside `NODE_ENV=development`, the planning procedure refuses access before any
provider request. The old `/api/intervals/planning-context` inspection route was
removed; only `WeeklyPlan` is exposed by `/api/trpc/planning.getWeeklyPlan`.

Mobile backend URL lives in `apps/mobile/src/config/backend.ts`:

- iOS simulator: `http://localhost:3000`.
- Android emulator: `http://10.0.2.2:3000`.
- Physical device: replace the URL with `http://<your-computer-LAN-IP>:3000`, use
  the same trusted network, and run `pnpm --filter web dev --hostname 0.0.0.0`.
  Allow local network access through the device permissions and computer firewall.

This is local/LAN development only; do not publish or tunnel this unauthenticated
server. Loading, server/network errors and manual retry are supported. RN cancels
its request after 30 seconds or when the screen unmounts.

Daily weather maps only clear skies, clouds and ordinary rain/drizzle/showers.
Open-Meteo reports the most severe condition of the day, not the training time slot.
Missing forecasts, unsupported conditions and provider failures become `unknown`
with server diagnostics; the planner continues without weather adaptation for those
days. There is no fallback to mock or clear weather. Invalid location configuration
is reported as a configuration error. Wind, gusts, temperature thresholds and
weather-driven rescheduling are deferred; the existing cycling rain rule is unchanged.

Weather data: [Open-Meteo](https://open-meteo.com/), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The free endpoint is for
[non-commercial use](https://open-meteo.com/en/terms); a commercial deployment
requires revisiting the service plan.

## Validation

Run from the repository root:

```sh
# Shared engine, provider boundaries and web integration tests (Vitest)
pnpm --filter @trainiq/recommendation --filter @trainiq/intervals --filter @trainiq/weather --filter web test

# Mobile tests (Jest)
pnpm --filter mobile test --runInBand

# Typecheck server/shared packages with the Web workspace compiler
pnpm --filter web exec tsc -p ../../packages/types/tsconfig.json --noEmit
pnpm --filter web exec tsc -p ../../packages/domain/tsconfig.json --noEmit
pnpm --filter web exec tsc -p ../../packages/recommendation/tsconfig.json --noEmit
pnpm --filter web exec tsc -p ../../packages/intervals/tsconfig.json --noEmit
pnpm --filter web exec tsc -p ../../packages/weather/tsconfig.json --noEmit
pnpm --filter web exec next typegen
pnpm --filter web exec tsc --noEmit

# Generate the mobile tRPC contract, then typecheck RN
pnpm --filter web generate:trpc-types
pnpm --filter mobile typecheck

# App lint and patch whitespace
pnpm --filter web lint
pnpm --filter mobile lint
git diff --check
```

CI explicitly uses the Web TypeScript compiler for server packages; the root
compiler can resolve to mobile TypeScript 6 through hoisting and changes ambient
type discovery. Weather is included in the CI typecheck.

Tests protect planner decisions, classification rules and external-data boundaries.
The mobile typecheck runs in CI after `pnpm --filter web generate:trpc-types`.
Run this generation command after installation and whenever the router or its
contract changes, so the mobile editor and typecheck see the current API.
TypeScript emits declarations from the Web router into gitignored
`apps/web/dist/trpc`, where imports such as `@trainiq/types` resolve through the
Web app’s dependencies. RN consumes `apps/web/dist/trpc/trpc-types.d.ts` without
analyzing server implementations. The normal Web TypeScript program excludes
`dist`. Generated files are not committed: CI regenerates them from source on
every run. Mobile type-tests check the query input and output, including a negative
assignment that catches output inference degrading to `any`.

Mobile formatting uses Prettier 2.8.8 and `apps/mobile/.prettierrc.js` (default
80-column print width). Format only the files you change, for example
`pnpm --filter mobile format src/api/trpc.ts`; use `format:check` with the same
paths to verify them. ESLint does not run Prettier, and CI currently checks lint,
not formatting. Web/shared packages have no explicit Prettier configuration.

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
