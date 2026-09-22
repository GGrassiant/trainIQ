# ADR 0003 — Planning operates on an explicit domain context

## Status

Accepted

## Context

TrainIQ uses the same recommendation engine in Web, React Native and a development
server integration. External data sources and client frameworks will evolve, but
training decisions must remain reproducible and testable without those dependencies.

An incomplete workout library is also a normal planning condition, not a reason to
invent a workout or silently remove a training slot.

## Decision

Integrations translate external data into TrainIQ domain types before assembling a
`PlanningContext`. `planWeek()` receives that context explicitly and returns a
`WeeklyPlan`; it does not fetch data, interpret provider payloads or depend on client
frameworks. Identical contexts produce identical plans.

TrainIQ owns planning preferences, goals, availability and fixed commitments.
Provider data supplies evidence for planning, not authority over those constraints.
[ADR 0001](0001-workout-classification.md) defines workout interpretation;
[ADR 0002](0002-scheduled-workouts.md) defines the role of the existing calendar.

When selection cannot find a compatible library workout, the plan contains an
`unresolved` slot with a reason. Insufficient available days are represented as
unmet requirements. Neither outcome triggers implicit workout generation.

## Consequences

The engine can be tested with domain fixtures and reused across execution environments.
API access and context assembly remain orchestration responsibilities outside it.
A future generation or adaptation layer must handle unresolved outcomes explicitly.

Planning logic stays deterministic. The current development logging and its test
environment flag are an instrumentation exception to strict side-effect-free purity;
they do not affect the returned plan.
