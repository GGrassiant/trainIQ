# TrainIQ roadmap

TrainIQ is a training companion built around Intervals.icu. It aims to help an athlete understand their current training state, decide what to do next, and gradually account for their goals, availability, recent training, and workout library.

This roadmap describes product direction, not architectural commitments.

## Principles

- Intervals.icu is the initial source of truth for training data.
- Start read-only.
- Add write operations only when they provide real value.
- Build one useful vertical slice at a time.
- Prefer simple code until a concrete problem justifies an abstraction.
- AI should provide useful reasoning, not unnecessarily replace deterministic logic.
- Keep external credentials and AI API keys on the server.
- Make costly AI calls explicit, bounded, and measurable.

## Phase 1 — Current training state

Connect TrainIQ to Intervals.icu and show useful information about the athlete's current training state on Web and Mobile.

Examples include:

- Fitness
- Fatigue
- Form
- Recent activities
- Current weekly training volume or load

**Goal:** “Open TrainIQ and immediately understand where I am today.”

No AI or planning is needed for this phase.

## Phase 2 — Athlete goal and training cadence

Allow the athlete to set a simple goal, such as:

- Gran Fondo or climbing performance
- General cycling fitness
- Running fitness
- Maintenance

Then let them set a target training cadence, manually at first and possibly with assistance later. Examples include 2–3 cycling sessions, 1–2 running sessions, and optional strength work.

The goal is a light training framework, not a complex planning engine.

## Phase 3 — What should I do today?

Gradually use the athlete's goal, recent training, fitness, fatigue, form, available time, subjective feedback about legs, energy, and motivation, indoor or outdoor preference, and existing Intervals.icu workouts to recommend a suitable session.

Prefer a workout already in the athlete's Intervals.icu library. Workout generation could be explored later if no suitable workout exists.

**Goal:** “Tell me what makes sense to do today and why.”

## Phase 4 — Weekly planning

Explore a lightweight weekly planning model. One possibility is to create a weekly skeleton from goals and availability, then adapt individual sessions during the week.

Keep the plan flexible rather than turning it into a rigid calendar.

## Phase 5 — Intervals.icu writeback

Once recommendations are useful enough, possible next steps include scheduling selected workouts in Intervals.icu, optionally creating missing workouts, and updating the calendar only after the athlete confirms.

Intervals.icu remains the source of truth and the training calendar.

## Later possibilities

These are ideas, not commitments:

- Workout generation
- Weather-aware recommendations
- Longer-term progression
- Multiple athlete profiles
- Authentication
- AI-assisted explanations and recommendations
- Notifications or reminders

## Possible technical building blocks

Introduce these only when a concrete need justifies them:

- TanStack Query — client-side server-state management
- Zod — validation at external-data boundaries
- tRPC — a typed API contract if the API surface becomes large enough
- Authentication — when TrainIQ needs to support multiple users
- Database — when TrainIQ needs to persist its own user-specific data
- AI APIs — when model reasoning adds measurable value

None of these are required for the first Intervals.icu dashboard.

## Previous prototype

An earlier version explored a recommendation engine, tRPC, authentication, weather, and a richer domain model. It was intentionally reset because the architecture had grown faster than the product. The historical direction is available in [docs/archive/original-vision.md](docs/archive/original-vision.md).
