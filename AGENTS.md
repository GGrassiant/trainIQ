# Engineering guidelines

These apply across the monorepo (`packages/*` and `apps/*`). `apps/web` has
its own `AGENTS.md` for Next.js-specific conventions; this file covers
general engineering and testing principles instead of framework detail.

## Code style

Prefer idiomatic, readable TypeScript and modern JavaScript over cleverness.

- Prefer declarative array operations (`map`, `filter`, `find`, `some`,
  `every`) over manual `for` loops when the declarative version is clearer.
- `for` loops are fine when they materially improve readability,
  performance, early-exit behavior, or avoid awkward functional code. Don't
  replace a clear loop with a contorted `reduce` just to avoid a loop.
- Avoid nested ternaries. Prefer explicit intermediate variables or small,
  well-named functions once conditional logic gets hard to read.
- Prefer early returns when they simplify control flow.
- Avoid clever one-liners when slightly longer code communicates intent
  better.
- Prefer existing project/domain abstractions before introducing new ones,
  and don't introduce abstractions for hypothetical future requirements —
  see the root-level "Doing tasks" guidance on avoiding speculative design.
- Keep domain/business logic independent from frameworks and external APIs
  where practical. Preserve the external-data → mapper → TrainIQ-domain
  boundary already used in `@trainiq/intervals` (raw API types in
  `api-types.ts`, translated by a dedicated mapper, never conflated with
  TrainIQ's own domain types in `@trainiq/types`) — apply the same pattern
  to future external integrations (weather, etc.).
- Prefer straightforward code that makes business rules visible rather than
  hiding them behind unnecessary abstraction.

The goal is not functional programming at all costs — it's idiomatic,
boring, easy-to-review code.

## Testing philosophy

Tests should primarily verify observable behavior and domain contracts, not
implementation details:

```
input/context → public behavior → expected domain result
```

rather than tests coupled to private helpers, internal call ordering, exact
implementation structure, or incidental intermediate values.

- Test important boundaries and edge cases around domain rules (see
  `packages/recommendation`'s TSB/fatigue threshold tests for the pattern).
- When fixing a bug, add a regression test that would have caught the actual
  bug — not just one that exercises the fixed line.
- Don't weaken assertions just to make a test pass.
- Avoid mocking internal implementation details when testing real public
  behavior is practical. External boundaries such as HTTP clients (e.g.
  `IntervalsClient`'s `fetch` calls) may be mocked/stubbed where appropriate.
- Deterministic domain logic (`planWeek()`, mappers) should stay testable
  without network, framework, or environment dependencies.
- Tests should make the business rule they protect legible to another
  engineer reading them cold.
- Prefer testing the consequence of a domain rule over testing the helper
  used to implement it. For example, if recommendation behavior changes at
  `TSB < -10`, prefer a behavioral test like "TSB = -10.1 → hard-session
  budget is 0" over a unit test that only checks a formatting helper doesn't
  mutate `-10.1` — the behavioral test would also catch an accidental
  rounding-before-calculation regression.

## General principle

Optimize for code another experienced engineer can quickly understand,
review, modify, test, explain, and defend. Do not optimize for minimum line
count, cleverness, unnecessary abstraction, or speculative future
requirements. When several implementations are correct, prefer the boring
and obvious one.
