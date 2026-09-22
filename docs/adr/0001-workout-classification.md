# 0001 — Workout classification

## Status

Provisional. The architecture (three independent concepts, classification at the integration
boundary, zone-only V1) is accepted. The numeric rules and constants are TrainIQ heuristics
checked against one athlete's library, and are expected to change — see
[Known limitations](#known-limitations--future-evolution).

## Mental model

```
focus
  = What kind of work primarily characterizes this workout?
  Example: endurance, sweet-spot, threshold, vo2max

intensity
  = How demanding does TrainIQ consider this workout for weekly planning?
  Example: easy, moderate, hard, very-hard

intervalsLoad
  = Training load calculated externally by Intervals.icu (icu_training_load).
  TrainIQ preserves it as-is and never reinterprets it as focus or intensity.
```

`focus` and `intensity` are TrainIQ-owned: Intervals.icu supplies neither. They are computed by two
independent pure functions, `classifyFocus()` and `classifyIntensity()`
(`packages/intervals/src/classify-workout.ts`), from a provider-neutral profile of sport, duration,
time in zones Z1–Z7, and the overlapping Sweet Spot (SS) signal. `fatigueCost` is a separate, minor
TrainIQ heuristic that `planWeek()` does not read.

## Context

`planWeek()` picks workouts from a `Workout[]` library, filtering on `intensity` and using `focus` to
prefer goal-aligned sessions. The library now comes from the athlete's real Intervals.icu workouts
(270 in the athlete's library; 196 usable — the rest are unsupported sports or empty placeholders).
The payload has no `focus`, `intensity` or `fatigueCost`. It has a sport `type`, a duration,
`icu_training_load`, `icu_intensity`, and a structured `workout_doc` containing `steps` and
`zoneTimes` (seconds per zone Z1–Z7, plus an overlapping `SS` entry).

## Decision

- **External data is mapped at the integration boundary.** A mapper in `@trainiq/intervals`
  turns Intervals.icu workouts into TrainIQ `Workout`s. `planWeek()` and `@trainiq/domain` never see
  Intervals.icu types and are unchanged. The raw JSON is untrusted (`unknown`), not asserted to already
  match a TypeScript type: `mapIntervalsWorkoutsToLibrary()` validates it with Zod (top-level shape, then
  each workout) before reading anything off of it, so a malformed response is skipped, never crashes the
  mapper or produces a fabricated id.
- **`icu_training_load` → `intervalsLoad`, directly and only.** It is never used as, or to derive,
  `focus`, `intensity` or `fatigueCost`. `icu_intensity` is not used either (see below).
- **Classification is deterministic, directly unit-tested, and uses only structured data:** sport,
  duration, and zone times. **Workout names are never inputs** — they turned out to be unreliable
  (one workout named for 105–110% FTP actually targets "Zone 4–5"; one named "Tempo" is
  structurally near-identical to one named "Sweet Spot").
- **Zone-only V1.** `steps` were investigated and deliberately deferred (see below).
- **Unclassifiable workouts are skipped, not guessed at:** unsupported or missing sport, no name, no
  usable duration, or no zone data. There is no fallback to the mock library.

## Consequences

- **`focus` and `intensity` are independent axes and can legitimately disagree.** A caller must not
  assume a `hard`/`very-hard` workout has a demanding focus, or that a `tempo`/`endurance` focus means
  an easy session — e.g. Lactate Clearance 4 is `very-hard` intensity with a `tempo` focus (see below).
- **Aggregate-zone classification is deliberately conservative and incomplete, not a full training-science
  model.** It only ever names `endurance`, `tempo`, `threshold`, `vo2max` or (cycling) `sweet-spot`; it
  cannot see interval structure, so `over-under` and `openers` are never emitted even when a workout is
  actually one of those.
- **`endurance` can be a fallback, not a physiological conclusion.** When aggregate zone data can't
  establish a more specific focus, TrainIQ reports `endurance` rather than guessing — this states "V1
  couldn't tell," not "this workout is physiologically endurance work" (see Short Sprint 6s below).
- **Structural classification from `workout_doc.steps` is deliberately deferred**, not rejected: V1 uses
  zone times only, so `over-under` and interval-structure-aware focus are future work, not gaps to be
  worked around with heuristics today.
- `very-hard` workouts are classified truthfully but `planWeek()` cannot select them yet, and the real
  library maps no strength workouts, so strength days are currently `unresolved`. Both are separate,
  known follow-ups tracked in more detail below, not blockers to this ADR.

## Why not just use zone percentages?

The first version classified from the share of time in higher zones alone. Real workouts broke it:

| Workout (real library) | What the data showed | What went wrong |
|---|---|---|
| **VO2 Openers** | 3×3′ at Z5 in a 66-min ride: 9 min of VO2 work, 13.6% of the workout | Labelled `easy`: the VO2 work was **diluted by total duration** and fell just under the 15% cutoff |
| **Supra 110+, 8x4m** | 8×3′ at Z4 plus Z5 kicks inside a 181-min ride: 32 min of Z4+, only ~18% | Labelled `easy` despite meaningful threshold work — **dilution again** |
| **Short Sprint 6s** | 6 min in Z4, 10% of the ride | An obvious fix, "N absolute minutes of Z3+ means moderate", **also fails**: those 6 minutes are two 3-min warm-up ladder steps. A generic Z3+ minutes rule produces false positives |
| **Over-Unders 3x12** | 3×12′ alternating 1′ at 105% / 1′ at 95%, 4′ rest between sets | Aggregate zones read it as 36 min of steady Z4: **structure is lost** |
| **Sweet Spot** | 3×10′ at 88–92% FTP: 30 min in Z3, 30 min in the overlapping SS band | Zone shares call it `tempo`; the **SS overlay is what identifies it** |

So neither shares alone (dilution) nor absolute minutes alone (ladders) is enough. V1 combines them,
and applies absolute minutes only where they were observed to help (see rules).

**SS overlaps Z3/Z4, it does not partition them.** It is therefore a focus signal only and is never
added to any zone total or share denominator. It is also target-format dependent: it is populated
when a step targets an explicit %FTP, but not for "Zone 3" power-zone targets, so 27 of 31 rides with
8+ minute Zone 3 blocks report no SS time at all.

## Why focus and intensity must not be mechanically coupled

The earlier design derived focus from the intensity tier (very-hard ⇒ vo2max, hard ⇒ threshold, …).
Real workouts need the two to disagree:

| Workout | intensity | focus | Why they differ |
|---|---|---|---|
| **VO2 Openers** | moderate | vo2max | Real VO2 work, but a modest dose |
| **Supra 110+, 8x4m** | hard | threshold | Threshold intervals embedded in a long ride |
| **Short Sprint 6s** | easy | endurance | See the note on `endurance` below |
| **Lactate Clearance 4** | very-hard | tempo | VO2 surges over a Z3 base: most of the work minutes are tempo, but the surge volume makes it very demanding |

**`endurance` is the conservative fallback focus.** It means aggregate data can't establish another
focus — not that the workout is physiologically an endurance workout. Short Sprint 6s → `endurance`
does not claim it is one; it means V1 cannot safely infer *openers* without analysing steps.

## Rules in V1

All numeric constants below are **provisional TrainIQ heuristics, not physiological thresholds**,
isolated as named constants in `classify-workout.ts`. Time shares use total Z1–Z7 time as the
denominator (never SS).

**`classifyIntensity`** — a tier is reached by share **or** (cycling only) absolute minutes; first
match wins:

| Tier | Cycling | Running |
|---|---|---|
| `very-hard` | Z5–Z7 share ≥ 15% **or** Z5–Z7 ≥ 12 min | Z5–Z7 share ≥ 15% |
| `hard` | Z4–Z7 share ≥ 20% **or** Z4–Z7 ≥ 20 min | Z4–Z7 share ≥ 20% |
| `moderate` | Z3–Z7 share ≥ 20% **or** Z5–Z7 ≥ 5 min | Z3–Z7 share ≥ 20% |
| `easy` | otherwise | otherwise |

**`classifyFocus`** — evaluated in this order:

1. `sweet-spot` (**cycling only**): SS ≥ 20 min **and** SS ≥ 95% of the workout's Z3+ minutes.
2. Otherwise the **dominant work band** — most minutes among Z3 (`tempo`), Z4 (`threshold`) and
   Z5–Z7 combined (`vo2max`), ties to the higher band — *if it is meaningful*: ≥ 20% of the workout,
   or (**cycling only**) ≥ 7 minutes.
3. Otherwise `endurance`.

Only work bands compete, so warm-up and recovery minutes in Z1/Z2 can't decide the focus. `over-under`,
`openers`, `climbing` and `strength` are never emitted: aggregate zones can't establish them.

`fatigueCost = min(10, base[intensity] + floor(minutes / 45))` with base 2 / 4 / 5 / 6. It exists
because the `Workout` contract requires a value; `planWeek()` does not consume it.

### What is evidence-backed and what is provisional

- **Evidence-backed behavior** (pinned by regression tests): pure Z2 → easy/endurance; Race Ready →
  very-hard/vo2max despite 64% of its time in Z1/Z2; and the counterexamples above (VO2 Openers,
  Supra, Short Sprint 6s, Lactate Clearance 4, sweet-spot blocks).
- **Provisional constants**, placed in gaps observed in one library. "Same result for" is the range of
  values that reproduce the same labels on the 196 mapped workouts:

| Constant | Value | Same result for | Evidence |
|---|---|---|---|
| Cycling meaningful-focus minutes | **7** | roughly 6.5–8 | Above Short Sprint 6s (6 min, must **not** become `threshold`); at or below PMA-2 (8 min, must stay `vo2max`) and VO2 Openers (9 min). 7 is a simple value inside that gap |
| Focus share gate | **20%** | only ≈ 19–20.5% | **Weakest evidence.** Substantially driven by one workout (Lactate Tolerance 4x12, 20.7%). Not an established training-science threshold |
| very-hard / hard / moderate absolute minutes (cycling) | 12 / 20 / 5 | 10–14 / 18–32 / 2–9 | Gaps between real workouts (e.g. Supra 32 min vs. 17) |
| Share cutoffs | 15% / 20% / 20% | — | Carried over from the first version; validated only on two payloads plus the counterexamples |
| SS minutes / share of Z3+ | 20 min / 95% | 10–30 / 0.88–1.0 | Robust here, but rests on five sweet-spot structures |
| `fatigueCost` formula | see above | — | Unvalidated; unused by the engine |

Cycling-only absolute minutes (7-min focus gate, the intensity minute arms) are **not** transferred to
running — see below.

## Cycling and running are not interpreted identically

Zone numbers don't mean the same thing across sports. Cycling `zoneTimes` carry Coggan-style
percent-of-FTP bands; running `zoneTimes` carry no zone definitions at all, and running targets use
pace zones, `%pace` or HR zones. From the few runs available, 105–110% pace lands in Z6, whereas
cycling Z5 is 106–120% FTP. The running sample is small (13 usable runs, 8 distinct structures, out of
55 — 42 are empty placeholders), so **running keeps the share-only rules**, preserving the behavior
observed on that sample, and has no sweet-spot focus. Absolute-minute heuristics calibrated on cycling
are not applied to running until there is running evidence. `icu_intensity` is not usable either:
it reads 79–85 for *every* run, easy ones included.

## Why `icu_training_load` stays separate

It is an externally modelled value, and in this library it lines up with neither axis. Race Ready
scores a load of 292 (`icu_intensity` 163) for a 66-minute session, driven by 30-second efforts at
180–500% FTP; VO2 Openers, which has real VO2 work, scores 60; a 2-hour Zone 2 ride scores 72. Treating
it as intensity or fatigue would conflate "how much load Intervals computed" with "what kind of work
this is" and "how hard TrainIQ should plan it". It is passed through as `intervalsLoad` and nothing more.

## Why steps were investigated but deferred

Structure (interval length, repetitions, recovery, cumulative work) carries information that
aggregate zones lose, so `workout_doc.steps` were analysed against the real library. They are
reliable *data*: across 2,325 leaf steps none lacks a duration or target, nesting is at most two
levels, and a midpoint-of-target rule (ramps split proportionally) reproduces Intervals' Z3–Z7 minutes exactly for all 183 rides.

But interpreting them robustly costs a lot: five target systems (`%ftp`, `power_zone`, `%pace`,
`pace_zone`, `hr_zone`); range targets like "Zone 4–5" that are inherently ambiguous (36 of 183 rides);
`warmup`/`cooldown` flags that can't be trusted (13 workouts flag their *first* step as a cooldown) so
warm-up ladders must be detected structurally; free text that must be ignored; and no run zone
definitions to interpret `%pace`. The payoff in this library is mainly over-under and openers, each
with too few examples to define a rule. So V1 stays zone-only.

**What steps could enable later:** `over-under` (alternating targets with no rest inside a block),
`openers` (very short maximal efforts with tiny cumulative work), interval-length-aware focus, and
separating warm-up ladders from real work. That is a focused future iteration, not part of V1.

## Conceptual inspiration

Joe Friel and Andrew Coggan's ideas informed the reasoning — that work-interval intensity, cumulative
work volume and workout purpose matter more than a single averaged number. TrainIQ is **not**
implementing, and does not claim to implement, an official Friel or Coggan classification. The rules
above are TrainIQ's own planning heuristics.

## Known limitations / future evolution

More detail on the practical effects summarized under Consequences above:

- **Validate before treating as stable.** Classification must be checked against a broader sample of
  real cycling and running workouts, including more Sweet Spot / Threshold sessions and many more
  runs, and the constants revisited. The 20% focus-share gate is the least trustworthy.
- **Sweet Spot with "Zone 3" targets** can't be told apart from tempo (SS is empty for them).
- **Threshold vs VO2 at "Zone 4–5" targets** (e.g. 4×8′) is ambiguous: Intervals resolves the range to
  Z5, so it reads `vo2max` / `very-hard`.
- **Surges over a tempo base** (Lactate Clearance family) sit near the 15% very-hard cutoff, so
  near-identical structures can land in different tiers.
- **Focus can name a band while intensity stays `easy`** — e.g. a long ride with ~8 min of Z4 has a
  `threshold` focus but no intensity rule fires. No such workout exists in the current library.
- **Running:** Run "Tempo" is `easy` because Intervals assigns 85–90% pace to Z2; fixing it needs run
  zone definitions.
- **Planning effects outside this ADR:** `very-hard` workouts are classified truthfully but
  `planWeek()` never selects them; the real library maps no strength workouts, so strength days are
  unresolved; sweet-spot workouts are preferred in cycling slots for a climbing goal because
  `planWeek()` applies its focus preference to every cycling slot. These are separate follow-ups.
- **Library shape:** free-text and empty workouts are skipped, and duplicates are common.
- **Rules can evolve without touching the engine:** classification takes a provider-neutral profile and
  returns TrainIQ concepts, so it can change, move packages, or serve another provider without coupling
  `planWeek()` to Intervals.icu.
