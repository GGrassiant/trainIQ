# Architecture Decision Records

Short notes recording why a significant technical or domain decision was made, so a future
reader doesn't have to reverse-engineer it from the code.

## Convention

- One file per decision, numbered in order: `NNNN-short-descriptive-title.md`
  (e.g. `0001-workout-classification.md`). Numbers are never reused.
- Each ADR has four sections:
  - **Status** — `Proposed`, `Accepted`, `Provisional` (accepted for now, expected to change), or
    `Superseded by NNNN`.
  - **Context** — the situation and constraints that forced a decision.
  - **Decision** — what we decided, stated plainly.
  - **Consequences** — what this makes easier, harder, or leaves open.
- Keep them short. If an ADR needs more than a page, the decision is probably several decisions.
- Don't edit an accepted ADR to change its decision — add a new one that supersedes it. Fixing
  typos and updating the Status line is fine.
- Only record decisions worth explaining later. Historical decisions are added separately, as
  they become relevant, rather than retroactively in bulk.

## Index

| ADR                                   | Title                   | Status      |
| ------------------------------------- | ----------------------- | ----------- |
| [0001](0001-workout-classification.md) | Workout classification | Provisional |
| [0002](0002-scheduled-workouts.md) | Scheduled workouts are planning context, not fixed commitments | Accepted |
| [0003](0003-planning-engine-contract.md) | Planning operates on an explicit domain context | Accepted |
| [0004](0004-next-backend-planning-source-of-truth.md) | The Next.js backend is the weekly planning source of truth | Accepted |
| [0005](0005-supabase-auth-web-session.md) | Supabase identity with a server-controlled Web session | Accepted |
