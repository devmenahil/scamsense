import { describe, expect, it } from "vitest";
import type { ModuleKey, ScenarioKey } from "@/content/modules";
import {
  ATTEMPT_STATES,
  assertModuleUnlocked,
  computeProgression,
  planScenarioStart,
  ProgressionError,
  type AttemptRecord,
  type AttemptState,
  type ModuleRunRecord,
} from "./progression";

let seq = 0;
function attempt(
  scenarioKey: ScenarioKey,
  state: AttemptState = "COMPLETED",
  attemptNumber = 1,
): AttemptRecord {
  seq += 1;
  return {
    id: `att-${seq}`,
    scenarioKey,
    attemptNumber,
    state,
    completedAt: state === "COMPLETED" ? `2026-11-10T10:0${seq % 10}:00Z` : null,
  };
}
const run = (moduleKey: ModuleKey, completedAt: string | null = null): ModuleRunRecord => ({
  moduleKey,
  startedAt: "2026-11-10T09:00:00Z",
  completedAt,
});

const statuses = (p: ReturnType<typeof computeProgression>) => p.modules.map((m) => m.status);
const errorCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ProgressionError ? e.code : "other";
  }
  return "no error";
};

describe("module progression", () => {
  it("defines exactly three modules with two scenario slots each", () => {
    const p = computeProgression({ attempts: [], runs: [] });
    expect(p.modules.map((m) => m.module.title)).toEqual([
      "Spot the Trap",
      "Trust Under Pressure",
      "Outsmart the Scam",
    ]);
    expect(p.modules.map((m) => m.module.difficulty)).toEqual(["Beginner", "Intermediate", "Advanced"]);
    expect(p.modules.every((m) => m.scenarios.length === 2)).toBe(true);
    expect(p.totalScenarios).toBe(6);
  });

  it("starts with only Module 1 available", () => {
    const p = computeProgression({ attempts: [], runs: [] });
    expect(statuses(p)).toEqual(["available", "locked", "locked"]);
    expect(p.currentModuleKey).toBe("spot-the-trap");
    expect(p.modules[1]!.scenarios.map((s) => s.action)).toEqual(["locked", "locked"]);
  });

  it("marks a module in progress once its run starts or a scenario is opened", () => {
    expect(statuses(computeProgression({ attempts: [], runs: [run("spot-the-trap")] }))[0]).toBe(
      "in_progress",
    );
    const p = computeProgression({ attempts: [attempt("m1-s1", "ACTIVE")], runs: [run("spot-the-trap")] });
    expect(p.modules[0]!.scenarios[0]).toMatchObject({ status: "in_progress", action: "resume" });
  });

  it("keeps Module 2 locked after only one Module 1 scenario", () => {
    const p = computeProgression({ attempts: [attempt("m1-s1")], runs: [run("spot-the-trap")] });
    expect(statuses(p)).toEqual(["in_progress", "locked", "locked"]);
    expect(p.completedScenarios).toBe(1);
    expect(errorCode(() => assertModuleUnlocked(p, "trust-under-pressure"))).toBe("module_locked");
  });

  it("unlocks Module 2 after both Module 1 scenarios, in either order, with no minimum score", () => {
    for (const order of [
      ["m1-s1", "m1-s2"],
      ["m1-s2", "m1-s1"],
    ] as ScenarioKey[][]) {
      const p = computeProgression({ attempts: order.map((k) => attempt(k)), runs: [run("spot-the-trap")] });
      expect(statuses(p)).toEqual(["completed", "available", "locked"]);
      expect(p.currentModuleKey).toBe("trust-under-pressure");
      expect(assertModuleUnlocked(p, "trust-under-pressure").unlocked).toBe(true);
    }
  });

  it("unlocks Module 3 only after both Module 2 scenarios", () => {
    const base = [attempt("m1-s1"), attempt("m1-s2"), attempt("m2-s1")];
    const runs = [run("spot-the-trap", "x"), run("trust-under-pressure")];
    expect(statuses(computeProgression({ attempts: base, runs }))).toEqual([
      "completed",
      "in_progress",
      "locked",
    ]);
    const all = computeProgression({ attempts: [...base, attempt("m2-s2")], runs });
    expect(statuses(all)).toEqual(["completed", "completed", "available"]);
    expect(all.currentModuleKey).toBe("outsmart-the-scam");
  });

  it("ignores later-module attempts while that module is locked (no skipping ahead)", () => {
    const p = computeProgression({ attempts: [attempt("m2-s1"), attempt("m2-s2")], runs: [] });
    expect(statuses(p)).toEqual(["available", "locked", "locked"]);
    expect(p.completedScenarios).toBe(0);
  });

  it("reports everything complete after all six scenarios", () => {
    const keys: ScenarioKey[] = ["m1-s1", "m1-s2", "m2-s1", "m2-s2", "m3-s1", "m3-s2"];
    const p = computeProgression({ attempts: keys.map((k) => attempt(k)), runs: [] });
    expect(statuses(p)).toEqual(["completed", "completed", "completed"]);
    expect(p).toMatchObject({
      allComplete: true,
      currentModuleKey: null,
      completedScenarios: 6,
      completedModules: 3,
    });
  });

  it("does not count an unfinished attempt as completed", () => {
    for (const state of ATTEMPT_STATES.filter((s) => s !== "COMPLETED")) {
      const p = computeProgression({ attempts: [attempt("m1-s1", state), attempt("m1-s2")], runs: [] });
      expect(statuses(p)[1]).toBe("locked");
    }
  });
});

describe("replays", () => {
  it("offers replay for completed scenarios and keeps the first completion as the scored one", () => {
    const first = attempt("m1-s1", "COMPLETED", 1);
    const replay = attempt("m1-s1", "COMPLETED", 2);
    const p = computeProgression({ attempts: [replay, first], runs: [run("spot-the-trap")] });
    expect(p.modules[0]!.scenarios[0]).toMatchObject({
      status: "completed",
      action: "replay",
      scoredAttemptId: first.id,
      completedAttempts: 2,
    });
  });

  it("an unfinished replay never un-completes a scenario or re-locks a module", () => {
    const attempts = [attempt("m1-s1"), attempt("m1-s2"), attempt("m1-s1", "ACTIVE", 2)];
    const p = computeProgression({ attempts, runs: [run("spot-the-trap", "x")] });
    expect(statuses(p)).toEqual(["completed", "available", "locked"]);
    expect(p.modules[0]!.scenarios[0]).toMatchObject({ status: "completed", action: "resume_replay" });
  });

  it("plans first plays, resumes, and replays", () => {
    const open = attempt("m1-s2", "ACTIVE");
    const p = computeProgression({ attempts: [attempt("m1-s1"), open], runs: [run("spot-the-trap")] });
    expect(planScenarioStart(p, "m1-s1")).toEqual({ kind: "new", attemptNumber: 2, isReplay: true });
    expect(planScenarioStart(p, "m1-s2")).toEqual({ kind: "resume", attemptId: open.id });

    const fresh = computeProgression({ attempts: [], runs: [run("spot-the-trap")] });
    expect(planScenarioStart(fresh, "m1-s1")).toEqual({ kind: "new", attemptNumber: 1, isReplay: false });
  });

  it("refuses scenario starts for locked, unstarted, or unknown modules", () => {
    const none = computeProgression({ attempts: [], runs: [] });
    expect(errorCode(() => planScenarioStart(none, "m1-s1"))).toBe("module_not_started");
    expect(errorCode(() => planScenarioStart(none, "m2-s1"))).toBe("module_locked");
    expect(errorCode(() => planScenarioStart(none, "m9-s1"))).toBe("unknown_scenario");
    expect(errorCode(() => assertModuleUnlocked(none, "nope"))).toBe("unknown_module");
  });
});
