# ADR 0004 — The Next.js backend is the weekly planning source of truth

## Status

Accepted

## Context

Web and React Native previously constructed mock contexts and ran the planner
independently. Real Intervals.icu and Weather composition now exists on the server.
Both clients need the same application use case, while the deterministic engine
must retain the explicit domain boundary established by [ADR 0003](0003-planning-engine-contract.md).

REST would suffice for today's single read. Near-term preferences, location and
plan operations will introduce queries and mutations; context and middleware will
also help enforce authentication. Learning tRPC is an explicit project objective.

## Decision

`generateWeeklyPlan(now)` composes the server context and calls `planWeek()`.
It is independent of tRPC. Clients neither construct `PlanningContext` nor execute
`planWeek()`; the context stays internal and `WeeklyPlan` is the client contract.

A single `planning.getWeeklyPlan` tRPC procedure wraps this use case. Web calls it
through a local server caller, without HTTP, during request-time rendering. React
Native uses a vanilla tRPC client with a non-batched HTTP link to a Next Route
Handler. JSON is sufficient; there is no transformer, duplicate DTO or artificial
input schema. The small initial setup is justified by the upcoming operations and
learning goal. Provider validation remains at the integration boundaries.

There is no authentication or database in this change. The procedure rejects all
calls outside development before provider access, for both caller paths. This is
local/trusted-LAN development only: `next dev` must not be exposed publicly. The
environment guard is not authentication. Intervals credentials stay on the server.
TrainIQ sports, goals and availability remain prototype values. Provider failures
never trigger a mock fallback; Weather still degrades to `unknown` when unavailable.
The old context-inspection route is removed to avoid exposing internal athlete data.

TanStack Query is deliberately deferred, but remains the planned client data layer.
This change isolates tRPC. Add TanStack Query when client interactions need cache,
mutations and invalidation, on React Native and interactive Web surfaces. The
vanilla client must not grow competing cache or state-management abstractions.

## Consequences

The generation path and access restriction are shared, with no server-to-self HTTP.
The planner and provider mappers remain independent of transport. A future session
can supply an authenticated user to the service without changing planner rules.

Planning remains on demand, not a persisted snapshot: provider changes between
requests can change the result. Accepting a plan is still local UI state. Mobile
requires the Next development server and a reachable configured URL. HTTP errors
are sanitized; unresolved days and unmet requirements remain valid plan results.
The type-only router reference couples the monorepo clients at compile time, not
at runtime; independently installed mobile versions will still require compatible
API evolution.
