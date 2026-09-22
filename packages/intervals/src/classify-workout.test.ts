import { describe, expect, it } from "vitest";
import { classifyFocus, classifyIntensity, classifyWorkout, type WorkoutProfile, type ZoneSeconds } from "./classify-workout";

/*
 * Regression tests built around the real-library counterexamples that shaped
 * the classifier (see docs/adr/0001-workout-classification.md). The zone
 * distributions below are the real ones, anonymized to a label; workout names
 * are only labels for the reader — the classifier never sees them.
 *
 * The cutoffs pinned here are PROVISIONAL TrainIQ heuristics. Boundary tests
 * document determinism, not that the numbers are physiologically meaningful.
 */

const MINUTE = 60;

function zones(seconds: Partial<ZoneSeconds>): ZoneSeconds {
  return { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0, Z6: 0, Z7: 0, ...seconds };
}

function ride(durationMinutes: number, zoneSeconds: Partial<ZoneSeconds>, sweetSpotSeconds?: number): WorkoutProfile {
  return { sport: "cycling", durationMinutes, zoneSeconds: zones(zoneSeconds), sweetSpotSeconds };
}

function run(durationMinutes: number, zoneSeconds: Partial<ZoneSeconds>): WorkoutProfile {
  return { sport: "running", durationMinutes, zoneSeconds: zones(zoneSeconds) };
}

/** Real distributions from the athlete's Intervals.icu library. */
const workouts = {
  z2Ride: ride(120, { Z2: 7200 }),
  raceReady: ride(66, { Z1: 1020, Z2: 1500, Z5: 1080, Z7: 360 }),
  /** 3x3' at Z5 inside a 66-minute ride: 9 min of VO2 work, 13.6% of the workout. */
  vo2Openers: ride(66, { Z1: 1680, Z2: 1740, Z5: 540 }),
  /** 8 x 3' at Z4 (+ 30" Z5 kicks) inside a 181-minute ride: 32 min of Z4+, only 18% of the workout. */
  supra: ride(181, { Z1: 240, Z2: 8520, Z3: 180, Z4: 1440, Z5: 480 }),
  /** ~1' efforts at Zone 4-5 after 2.5' at Zone 2-3: 14 min of Z5, 14.6% of the workout. */
  lactateClearanceHs: ride(96, { Z1: 720, Z2: 4020, Z4: 180, Z5: 840 }, 180),
  /** 15 x (45" Z5 over a Zone 3 base): tempo base with VO2 surges. */
  lactateClearanceSurges: ride(85, { Z1: 900, Z2: 1380, Z3: 2025, Z5: 795 }),
  /** Warm-up ladders (2 x 3' at Zone 3-4, which Intervals puts in Z4) + 4 x 6" sprints. */
  shortSprint: ride(62, { Z2: 3360, Z4: 360, Z6: 24 }, 360),
  /** 6 x 10" sprints in a 37-minute session. */
  openers: ride(37, { Z1: 660, Z2: 1500, Z7: 60 }),
  /** 16 x 30" at ~130% FTP: 8 min of Z6, 18% of a 44-minute workout. */
  pma2: ride(44, { Z1: 1560, Z2: 600, Z6: 480 }),
  /** 4 x (30" Z5 + 1'30" Z4) in a 29-minute workout: 6 min of Z4, 20.7% of the workout. */
  lactateTolerance: ride(29, { Z1: 360, Z2: 900, Z4: 360, Z5: 120 }),
  /** 3 x 10' at 88-92% FTP: all of it in Z3, all of it in the SS band. */
  sweetSpot: ride(65, { Z2: 2100, Z3: 1800 }, 1800),
  ventouxSweetSpot: ride(60, { Z1: 201, Z2: 999, Z3: 2400 }, 2400),
  /** 12 x (2' at 85% + 30" at 110% + 1' at 60%): Z3 base with surges, SS overlaps only part of the work. */
  aboveAndBelow: ride(52, { Z1: 80, Z2: 1490, Z3: 1200, Z4: 50, Z5: 300 }, 1250),
  /** 3 x 12' alternating 1' at 105% / 1' at 95%: aggregate zones read as 36 min of steady Z4. */
  overUnders: ride(62, { Z1: 241, Z2: 1319, Z4: 2160 }, 1080),
  capSeuil: run(45, { Z1: 1800, Z4: 900 }),
  runTempo: run(32, { Z1: 840, Z2: 720, Z4: 360 }),
  runVo2: run(30, { Z1: 1200, Z6: 600 }),
  runSeuil2: run(34, { Z1: 1140, Z3: 900 }),
};

describe("classifyIntensity", () => {
  it("rates a pure Zone 2 ride easy", () => {
    expect(classifyIntensity(workouts.z2Ride)).toBe("easy");
  });

  it("does not rate Race Ready easy just because warmup and recovery time dominates its minutes", () => {
    const { Z1, Z2, Z5, Z7 } = workouts.raceReady.zoneSeconds;
    expect(Z1 + Z2).toBeGreaterThan(Z5 + Z7);

    expect(classifyIntensity(workouts.raceReady)).toBe("very-hard");
  });

  it("rates a long ride with meaningful threshold work hard even though the work is diluted by total duration (Supra 110+, 8x4m)", () => {
    // 32 min of Z4+ but only ~18% of a 181-minute ride: a share-only rule calls this easy.
    expect(classifyIntensity(workouts.supra)).toBe("hard");
  });

  it("rates a session with 9 min of VO2 work moderate rather than easy (VO2 Openers)", () => {
    // 13.6% of the workout is just under the share cutoff; the absolute minutes catch it.
    expect(classifyIntensity(workouts.vo2Openers)).toBe("moderate");
  });

  it("rates repeated ~1' efforts totalling 14 min of Z5 very-hard even though they are 14.6% of the ride (Lactate Clearance HS 1.0)", () => {
    expect(classifyIntensity(workouts.lactateClearanceHs)).toBe("very-hard");
  });

  it("does not promote a warm-up ladder plus a few sprints to moderate (Short Sprint 6s: a naive 'minutes of Z3+' rule would)", () => {
    // 6 min sit in Z4, but they are two 3-minute warm-up ladder steps. Absolute minutes are only
    // counted in Z5-Z7 for the moderate tier, so this stays easy.
    expect(workouts.shortSprint.zoneSeconds.Z4).toBe(6 * MINUTE);
    expect(classifyIntensity(workouts.shortSprint)).toBe("easy");
  });

  it("keeps a session with a single 10-second sprint block easy (Openers)", () => {
    expect(classifyIntensity(workouts.openers)).toBe("easy");
  });

  describe("cycling absolute-minutes arms (cycling only; provisional)", () => {
    const longEasyRide = (extra: Partial<ZoneSeconds>) => ride(200, { Z2: 200 * MINUTE, ...extra });

    it("becomes moderate at 5 minutes in Z5-Z7, however long the ride", () => {
      expect(classifyIntensity(longEasyRide({ Z5: 5 * MINUTE - 1 }))).toBe("easy");
      expect(classifyIntensity(longEasyRide({ Z5: 5 * MINUTE }))).toBe("moderate");
    });

    it("becomes hard at 20 minutes in Z4-Z7", () => {
      expect(classifyIntensity(longEasyRide({ Z4: 20 * MINUTE - 1 }))).toBe("easy");
      expect(classifyIntensity(longEasyRide({ Z4: 20 * MINUTE }))).toBe("hard");
    });

    it("becomes very-hard at 12 minutes in Z5-Z7", () => {
      expect(classifyIntensity(longEasyRide({ Z5: 12 * MINUTE - 1 }))).toBe("moderate");
      expect(classifyIntensity(longEasyRide({ Z6: 12 * MINUTE }))).toBe("very-hard");
    });

    it("does not treat Z3/Z4 minutes as a reason for moderate, only Z5-Z7 minutes", () => {
      expect(classifyIntensity(longEasyRide({ Z3: 10 * MINUTE, Z4: 10 * MINUTE }))).toBe("easy");
    });
  });

  describe("running keeps share-only rules: absolute minutes calibrated on cycling are not transferred", () => {
    it("rates the same 9 min of Z5 easy in a run, where it is moderate in a ride", () => {
      const asRide = ride(66, { Z1: 1680, Z2: 1740, Z5: 540 });
      const asRun = run(66, { Z1: 1680, Z2: 1740, Z5: 540 });

      expect(classifyIntensity(asRide)).toBe("moderate");
      expect(classifyIntensity(asRun)).toBe("easy");
    });

    it("keeps the run sample's behavior: Tempo easy, Seuil 2 moderate, CAP Seuil hard, Vo2 very-hard", () => {
      expect(classifyIntensity(workouts.runTempo)).toBe("easy");
      expect(classifyIntensity(workouts.runSeuil2)).toBe("moderate");
      expect(classifyIntensity(workouts.capSeuil)).toBe("hard");
      expect(classifyIntensity(workouts.runVo2)).toBe("very-hard");
    });
  });

  describe.each(["cycling", "running"] as const)("share boundaries for %s (provisional cutoffs — pins determinism, not physiology)", (sport) => {
    // Every case totals 3000 s, so shares read directly off the seconds (450 s = 15%).
    const profile = (zoneSeconds: Partial<ZoneSeconds>): WorkoutProfile => ({ sport, durationMinutes: 50, zoneSeconds: zones(zoneSeconds) });

    it("moves from hard to very-hard when the Z5-Z7 share reaches 15%", () => {
      expect(classifyIntensity(profile({ Z2: 1951, Z4: 600, Z5: 449 }))).toBe("hard");
      expect(classifyIntensity(profile({ Z2: 1950, Z4: 600, Z5: 450 }))).toBe("very-hard");
    });

    it("moves from moderate to hard when the Z4-Z7 share reaches 20%", () => {
      expect(classifyIntensity(profile({ Z2: 1401, Z3: 1000, Z4: 599 }))).toBe("moderate");
      expect(classifyIntensity(profile({ Z2: 1400, Z3: 1000, Z4: 600 }))).toBe("hard");
    });

    it("moves from easy to moderate when the Z3-Z7 share reaches 20%", () => {
      expect(classifyIntensity(profile({ Z2: 2401, Z3: 599 }))).toBe("easy");
      expect(classifyIntensity(profile({ Z2: 2400, Z3: 600 }))).toBe("moderate");
    });
  });

  it("is not influenced by the overlapping Sweet Spot band", () => {
    const withoutSweetSpot = workouts.overUnders;
    const withHugeSweetSpot = { ...workouts.overUnders, sweetSpotSeconds: 1_000_000 };

    expect(classifyIntensity(withHugeSweetSpot)).toBe(classifyIntensity(withoutSweetSpot));
  });
});

describe("classifyFocus", () => {
  it("names a pure Zone 2 ride endurance", () => {
    expect(classifyFocus(workouts.z2Ride)).toBe("endurance");
  });

  it("names Race Ready vo2max even though Z1/Z2 dominate its minutes: only the work bands compete", () => {
    expect(classifyFocus(workouts.raceReady)).toBe("vo2max");
  });

  it("names VO2 Openers vo2max: 9 min of Z5 is meaningful even though it is diluted to 13.6%", () => {
    expect(classifyFocus(workouts.vo2Openers)).toBe("vo2max");
  });

  it("names PMA-2 vo2max: 8 min of Z6 stays above the meaningful-work gate", () => {
    expect(classifyFocus(workouts.pma2)).toBe("vo2max");
  });

  it("names Supra 110+ threshold, not vo2max: Z4 holds the most work minutes (24 vs 8), and 8 min of Z5 does not outrank it", () => {
    expect(classifyFocus(workouts.supra)).toBe("threshold");
  });

  it("names Lactate Tolerance 4x12 threshold through the share arm alone (6 min < 7 min, but 20.7% of a 29-minute workout)", () => {
    expect(workouts.lactateTolerance.zoneSeconds.Z4).toBeLessThan(7 * MINUTE);

    expect(classifyFocus(workouts.lactateTolerance)).toBe("threshold");
  });

  it("names a Zone 3 base with VO2 surges tempo, because Z3 holds most of the work minutes (Lactate Clearance 4)", () => {
    expect(classifyFocus(workouts.lactateClearanceSurges)).toBe("tempo");
  });

  it("falls back to endurance for Short Sprint 6s: its 6 Z4 minutes are warm-up ladder steps and must not become threshold", () => {
    expect(workouts.shortSprint.zoneSeconds.Z4).toBe(6 * MINUTE);

    expect(classifyFocus(workouts.shortSprint)).toBe("endurance");
  });

  it("falls back to endurance for a sprint-only opener session: openers can't be inferred from aggregate zones", () => {
    expect(classifyFocus(workouts.openers)).toBe("endurance");
  });

  it("gives ties between work bands to the higher band", () => {
    expect(classifyFocus(ride(50, { Z2: 1800, Z4: 600, Z5: 600 }))).toBe("vo2max");
  });

  describe("the 7-minute cycling gate (provisional: a value inside an observed gap, not a physiological threshold)", () => {
    // A long ride keeps the band's share of the workout tiny, so only the absolute arm can pass.
    const longRide = (extra: Partial<ZoneSeconds>) => ride(160, { Z2: 150 * MINUTE, ...extra });

    it("names a band only once it holds 7 minutes", () => {
      expect(classifyFocus(longRide({ Z4: 7 * MINUTE - 1 }))).toBe("endurance");
      expect(classifyFocus(longRide({ Z4: 7 * MINUTE }))).toBe("threshold");
    });

    it("does not apply the absolute gate to running: the same 8 minutes of Z4 in a long run stays endurance", () => {
      const longRun = run(90, { Z2: 82 * MINUTE, Z4: 8 * MINUTE });
      const sameInARide = ride(90, { Z2: 82 * MINUTE, Z4: 8 * MINUTE });

      expect(classifyFocus(longRun)).toBe("endurance");
      expect(classifyFocus(sameInARide)).toBe("threshold");
    });

    it("keeps the run sample's focus: Tempo endurance, Seuil 2 tempo, CAP Seuil threshold, Vo2 vo2max", () => {
      expect(classifyFocus(workouts.runTempo)).toBe("endurance");
      expect(classifyFocus(workouts.runSeuil2)).toBe("tempo");
      expect(classifyFocus(workouts.capSeuil)).toBe("threshold");
      expect(classifyFocus(workouts.runVo2)).toBe("vo2max");
    });
  });

  describe.each(["cycling", "running"] as const)("the 20% share arm for %s (weakest-evidenced constant, mostly driven by one workout)", (sport) => {
    // 1800 s total: 20% is 360 s = 6 min, below the 7-minute cycling arm, so only the share arm can pass.
    const profile = (zoneSeconds: Partial<ZoneSeconds>): WorkoutProfile => ({ sport, durationMinutes: 30, zoneSeconds: zones(zoneSeconds) });

    it("names a band that is 20% of the workout, but not one just below", () => {
      expect(classifyFocus(profile({ Z2: 1441, Z4: 359 }))).toBe("endurance");
      expect(classifyFocus(profile({ Z2: 1440, Z4: 360 }))).toBe("threshold");
    });
  });

  describe("sweet-spot (cycling only, from the overlapping SS band)", () => {
    it("names 3x10' at 88-92% sweet-spot", () => {
      expect(classifyFocus(workouts.sweetSpot)).toBe("sweet-spot");
    });

    it("names 2x20' at 90% sweet-spot", () => {
      expect(classifyFocus(workouts.ventouxSweetSpot)).toBe("sweet-spot");
    });

    it("does not name a session sweet-spot when SS covers only part of its above-endurance work (surges over a Z3 base)", () => {
      expect(classifyFocus(workouts.aboveAndBelow)).toBe("tempo");
    });

    it("does not name over-unders sweet-spot: SS is only 18 min and half of the Z4 work", () => {
      expect(classifyFocus(workouts.overUnders)).toBe("threshold");
    });

    it("needs at least 20 minutes in the SS band", () => {
      const short = ride(60, { Z2: 2700, Z3: 19 * MINUTE }, 19 * MINUTE);
      const enough = ride(60, { Z2: 2700, Z3: 20 * MINUTE }, 20 * MINUTE);

      expect(classifyFocus(short)).toBe("tempo");
      expect(classifyFocus(enough)).toBe("sweet-spot");
    });

    it("never creates work time from SS alone: an SS value on a pure Zone 2 ride changes nothing", () => {
      const contradictory = ride(120, { Z2: 7200 }, 7200);

      expect(classifyFocus(contradictory)).toBe("endurance");
      expect(classifyWorkout(contradictory)?.intensity).toBe("easy");
    });

    it("ignores SS for running", () => {
      const asRun: WorkoutProfile = { sport: "running", durationMinutes: 65, zoneSeconds: workouts.sweetSpot.zoneSeconds, sweetSpotSeconds: 1800 };

      expect(classifyFocus(asRun)).toBe("tempo");
    });
  });
});

describe("focus and intensity are independent axes", () => {
  it.each([
    ["VO2 Openers", workouts.vo2Openers, "moderate", "vo2max"],
    ["Supra 110+, 8x4m", workouts.supra, "hard", "threshold"],
    ["Short Sprint 6s (endurance is the conservative fallback here, not a finding)", workouts.shortSprint, "easy", "endurance"],
    ["Lactate Clearance 4 (focus and planning demand legitimately disagree)", workouts.lactateClearanceSurges, "very-hard", "tempo"],
  ] as const)("%s", (_label, profile, intensity, focus) => {
    expect(classifyIntensity(profile)).toBe(intensity);
    expect(classifyFocus(profile)).toBe(focus);
  });
});

describe("classifyWorkout", () => {
  it("combines both axes and a fatigueCost", () => {
    const result = classifyWorkout(workouts.supra);

    expect(result).toMatchObject({ focus: classifyFocus(workouts.supra), intensity: classifyIntensity(workouts.supra) });
  });

  it("returns undefined instead of fabricating values when the workout has no time in any zone", () => {
    expect(classifyWorkout(ride(60, {}))).toBeUndefined();
  });

  it("gives the same result for the same input (deterministic)", () => {
    expect(classifyWorkout(workouts.raceReady)).toEqual(classifyWorkout(workouts.raceReady));
  });

  describe("fatigueCost (provisional TrainIQ heuristic; planWeek() does not read it)", () => {
    it("is a whole number on TrainIQ's 1-10 scale", () => {
      const result = classifyWorkout(workouts.raceReady);

      expect(Number.isInteger(result?.fatigueCost)).toBe(true);
      expect(result?.fatigueCost).toBeGreaterThanOrEqual(1);
      expect(result?.fatigueCost).toBeLessThanOrEqual(10);
    });

    it("rises with duration for the same kind of workout", () => {
      const short = classifyWorkout(ride(60, { Z2: 3600 }));
      const long = classifyWorkout(ride(180, { Z2: 10800 }));

      expect(long!.fatigueCost).toBeGreaterThan(short!.fatigueCost);
    });

    it("rates an interval session above an easy ride of the same length", () => {
      const easy = classifyWorkout(ride(66, { Z2: 3960 }));
      const intervals = classifyWorkout(workouts.raceReady);

      expect(intervals!.fatigueCost).toBeGreaterThan(easy!.fatigueCost);
    });

    it("never exceeds the top of the scale, however long the workout", () => {
      expect(classifyWorkout(ride(900, { Z5: 54000 }))?.fatigueCost).toBe(10);
    });
  });
});
