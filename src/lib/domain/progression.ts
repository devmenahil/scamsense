/**
 * Module progression and unlock rules (R5–R7). Pure and deterministic. Progress is always RE-DERIVED from completed
 * scenario attempts, never kept as a counter that could drift (ARCHITECTURE §7).
 *
 * Rules (Step 5 brief):
 *   • Module 1 is available once onboarding is complete.
 *   • Module N unlocks when BOTH scenarios of module N−1 have a completed attempt. No minimum score is required.
 *   • A completed scenario can be replayed. A replay is practice: it never changes progression, the module's score,
 *     or the module's training funds. The FIRST completed attempt of each scenario is the scored one.
 *   • At most one open (unfinished) attempt per scenario: the user resumes it instead of starting another.
 */
import { MODULES, type ModuleDefinition, type ModuleKey, type ScenarioKey } from "@/content/modules";
import { applyScenarioOrder } from "./routing";
import { SCENARIO_STATES, type ScenarioState } from "./scenarioStateMachine";

export type ModuleStatus = "locked" | "available" | "in_progress" | "completed";
export type ScenarioStatus = "locked" | "not_started" | "in_progress" | "completed";
export type ScenarioAction = "locked" | "start" | "resume" | "replay" | "resume_replay";

/** Attempt states (Step 6 state machine, `scenarioStateMachine.ts`). Only COMPLETED counts for progression. */
export const ATTEMPT_STATES = SCENARIO_STATES;
export type AttemptState = ScenarioState;

export interface AttemptRecord {
  id: string;
  scenarioKey: ScenarioKey;
  attemptNumber: number;
  state: AttemptState;
  completedAt: string | null;
}

export interface ModuleRunRecord {
  moduleKey: ModuleKey;
  startedAt: string;
  completedAt: string | null;
}

export interface ScenarioProgress {
  key: ScenarioKey;
  /** Display position: 1 = recommended first by the routed order (Step 8), else the authored slot order. */
  position: 1 | 2;
  title: string;
  status: ScenarioStatus;
  action: ScenarioAction;
  /** The first completed attempt: the one that counts for progression, score, and training funds. */
  scoredAttemptId: string | null;
  /** The unfinished attempt to resume, if any (first play or replay). */
  openAttemptId: string | null;
  completedAttempts: number;
}

export interface ModuleProgress {
  module: ModuleDefinition;
  /** True when the scenarios are listed in this learner's persisted routed order (Step 8). */
  routed: boolean;
  status: ModuleStatus;
  unlocked: boolean;
  /** True once the module's training-funds period (module run) has started. */
  started: boolean;
  scenarios: [ScenarioProgress, ScenarioProgress];
  completedScenarios: number;
}

export interface ProgressionSummary {
  modules: ModuleProgress[];
  /** The module to continue: the first unlocked, unfinished module. null once every module is complete. */
  currentModuleKey: ModuleKey | null;
  completedScenarios: number;
  totalScenarios: number;
  completedModules: number;
  allComplete: boolean;
}

const byNumber = (a: AttemptRecord, b: AttemptRecord) => a.attemptNumber - b.attemptNumber;

function scenarioProgress(
  slot: ModuleDefinition["scenarios"][number],
  attempts: readonly AttemptRecord[],
  unlocked: boolean,
): ScenarioProgress {
  const mine = attempts.filter((a) => a.scenarioKey === slot.key).sort(byNumber);
  const completed = mine.filter((a) => a.state === "COMPLETED");
  const open = mine.find((a) => a.state !== "COMPLETED") ?? null;
  const scored = completed[0] ?? null;

  let status: ScenarioStatus;
  let action: ScenarioAction;
  if (!unlocked) {
    status = "locked";
    action = "locked";
  } else if (scored) {
    status = "completed";
    action = open ? "resume_replay" : "replay";
  } else if (open) {
    status = "in_progress";
    action = "resume";
  } else {
    status = "not_started";
    action = "start";
  }
  return {
    key: slot.key,
    position: slot.position,
    title: slot.title,
    status,
    action,
    scoredAttemptId: scored?.id ?? null,
    openAttemptId: open?.id ?? null,
    completedAttempts: completed.length,
  };
}

export function computeProgression(input: {
  attempts: readonly AttemptRecord[];
  runs: readonly ModuleRunRecord[];
  /** Persisted routed order per module (Step 8). Ordering only: both scenarios always stay required. */
  scenarioOrders?: Partial<Record<string, readonly string[]>>;
}): ProgressionSummary {
  const modules: ModuleProgress[] = [];
  let previousComplete: boolean = true; // Module 1 has no prerequisite.
  for (const m of [...MODULES].sort((a, b) => a.order - b.order)) {
    const unlocked: boolean = previousComplete;
    const order = input.scenarioOrders?.[m.key];
    const ordered = applyScenarioOrder(m.scenarios, order);
    // applyScenarioOrder ignores an invalid order, so "routed" means the persisted order was actually applied.
    const routed = !!order && ordered.map((s) => s.key).join() === order.join();
    const scenarios = ordered.map((s, i) => ({
      ...scenarioProgress(s, input.attempts, unlocked),
      position: (i + 1) as 1 | 2,
    })) as [ScenarioProgress, ScenarioProgress];
    const completedScenarios = scenarios.filter((s) => s.status === "completed").length;
    const started = input.runs.some((r) => r.moduleKey === m.key);
    const complete: boolean = unlocked && completedScenarios === scenarios.length;
    const status: ModuleStatus = !unlocked
      ? "locked"
      : complete
        ? "completed"
        : started || scenarios.some((s) => s.status !== "not_started")
          ? "in_progress"
          : "available";
    modules.push({ module: m, status, unlocked, started, routed, scenarios, completedScenarios });
    previousComplete = complete;
  }
  const completedScenarios = modules.reduce((n, m) => n + m.completedScenarios, 0);
  const totalScenarios = modules.reduce((n, m) => n + m.scenarios.length, 0);
  const completedModules = modules.filter((m) => m.status === "completed").length;
  return {
    modules,
    currentModuleKey: modules.find((m) => m.unlocked && m.status !== "completed")?.module.key ?? null,
    completedScenarios,
    totalScenarios,
    completedModules,
    allComplete: completedModules === modules.length,
  };
}

export type ProgressionErrorCode =
  "unknown_module" | "unknown_scenario" | "module_locked" | "module_not_started";

export class ProgressionError extends Error {
  constructor(
    public readonly code: ProgressionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProgressionError";
  }
}

export function getModuleProgress(summary: ProgressionSummary, moduleKey: string): ModuleProgress {
  const m = summary.modules.find((x) => x.module.key === moduleKey);
  if (!m) throw new ProgressionError("unknown_module", "That module doesn't exist");
  return m;
}

/**
 * Whether a module's training-funds period may begin now. Starting is idempotent (an already started module is
 * simply returned by the caller), so this only checks the unlock rule.
 */
export function assertModuleUnlocked(summary: ProgressionSummary, moduleKey: string): ModuleProgress {
  const m = getModuleProgress(summary, moduleKey);
  if (!m.unlocked) {
    throw new ProgressionError(
      "module_locked",
      `Finish both scenarios in Module ${m.module.order - 1} to unlock ${m.module.title}.`,
    );
  }
  return m;
}

/**
 * What starting a scenario means right now: a first attempt, a resume, or a replay. Used by the attempt-creation
 * route in Phase 4. The module run must already exist (it is opened first, which sets the training funds).
 */
export function planScenarioStart(
  summary: ProgressionSummary,
  scenarioKey: string,
): { kind: "resume"; attemptId: string } | { kind: "new"; attemptNumber: number; isReplay: boolean } {
  const m = summary.modules.find((x) => x.scenarios.some((s) => s.key === scenarioKey));
  if (!m) throw new ProgressionError("unknown_scenario", "That scenario doesn't exist");
  if (!m.unlocked) throw new ProgressionError("module_locked", "This scenario's module is still locked");
  if (!m.started) throw new ProgressionError("module_not_started", "Start the module first");
  const s = m.scenarios.find((x) => x.key === scenarioKey)!;
  if (s.openAttemptId) return { kind: "resume", attemptId: s.openAttemptId };
  return { kind: "new", attemptNumber: s.completedAttempts + 1, isReplay: s.completedAttempts > 0 };
}
