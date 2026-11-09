/**
 * The learner's progress snapshot (dashboard, /api/progress): progression + training funds + score + badges,
 * assembled from stored rows by pure, deterministic code. Nothing here reads the answer key.
 */
import { MODULES, type ModuleKey } from "@/content/modules";
import {
  computeProgression,
  type AttemptRecord,
  type ModuleRunRecord,
  type ProgressionSummary,
} from "./progression";
import { MAX_SCENARIO_POINTS } from "./scoring";
import { calculateStartingFunds, type StartingFunds } from "./trainingFunds";
import { summarizeWallet, type LedgerEntry, type WalletSummary } from "./wallet";

export interface RunRecord extends ModuleRunRecord {
  id: string;
  currency: string;
  startingFundsMinor: number;
  closingBalanceMinor: number | null;
}

export interface ScoreRecord {
  attemptId: string;
  totalPoints: number;
}

export type CurrentWallet =
  | { kind: "active"; moduleKey: ModuleKey; summary: WalletSummary }
  /** The current module hasn't started yet: what its training funds WILL be (not stored). */
  | { kind: "preview"; moduleKey: ModuleKey; funds: StartingFunds }
  /** Every module is complete: the final module's closing position. */
  | { kind: "closed"; moduleKey: ModuleKey; summary: WalletSummary };

export interface ModuleResult {
  moduleKey: ModuleKey;
  points: number;
  maxPoints: number;
  scoredScenarios: number;
  wallet: WalletSummary | null;
  ledger: LedgerEntry[];
  badgeEarnedAt: string | null;
}

export interface ProgressSnapshot {
  progression: ProgressionSummary;
  totalPoints: number;
  maxPoints: number;
  modules: Record<ModuleKey, ModuleResult>;
  currentWallet: CurrentWallet | null;
}

function stripRunId(e: LedgerEntry & { moduleRunId: string }): LedgerEntry {
  const { moduleRunId, ...entry } = e;
  void moduleRunId;
  return entry;
}

export function buildProgressSnapshot(input: {
  attempts: readonly AttemptRecord[];
  runs: readonly RunRecord[];
  /** All ledger entries, each tagged with its module run id, in chronological order. */
  ledger: readonly (LedgerEntry & { moduleRunId: string })[];
  scores: readonly ScoreRecord[];
  profile: { incomeBracket: string | null; preferredCurrency: string | null };
  /** Persisted routed scenario order per module (Step 8). */
  scenarioOrders?: Partial<Record<string, readonly string[]>>;
}): ProgressSnapshot {
  const progression = computeProgression({
    attempts: input.attempts,
    runs: input.runs,
    scenarioOrders: input.scenarioOrders,
  });
  const pointsByAttempt = new Map(input.scores.map((s) => [s.attemptId, s.totalPoints]));
  const completedAt = new Map(input.attempts.map((a) => [a.id, a.completedAt]));

  const modules = {} as Record<ModuleKey, ModuleResult>;
  let totalPoints = 0;
  for (const mp of progression.modules) {
    const key = mp.module.key;
    const run = input.runs.find((r) => r.moduleKey === key);
    const ledger = run ? input.ledger.filter((e) => e.moduleRunId === run.id) : [];
    // Only the first completed attempt of each scenario counts; replays are practice.
    const scored = mp.scenarios.map((s) => s.scoredAttemptId).filter((id): id is string => id !== null);
    const scoredWithPoints = scored.filter((id) => pointsByAttempt.has(id));
    const points = scoredWithPoints.reduce((sum, id) => sum + pointsByAttempt.get(id)!, 0);
    totalPoints += points;
    const finished = scored.map((id) => completedAt.get(id)).filter((d): d is string => !!d);
    modules[key] = {
      moduleKey: key,
      points,
      maxPoints: mp.scenarios.length * MAX_SCENARIO_POINTS,
      scoredScenarios: scoredWithPoints.length,
      wallet: summarizeWallet(ledger),
      ledger: ledger.map(stripRunId),
      badgeEarnedAt:
        mp.status === "completed" ? (run?.completedAt ?? [...finished].sort().at(-1) ?? null) : null,
    };
  }

  let currentWallet: CurrentWallet | null = null;
  const currentKey = progression.currentModuleKey;
  if (currentKey) {
    const summary = modules[currentKey].wallet;
    currentWallet = summary
      ? { kind: "active", moduleKey: currentKey, summary }
      : { kind: "preview", moduleKey: currentKey, funds: calculateStartingFunds(input.profile) };
  } else {
    const last = MODULES[MODULES.length - 1]!.key;
    const summary = modules[last].wallet;
    if (summary) currentWallet = { kind: "closed", moduleKey: last, summary };
  }

  return {
    progression,
    totalPoints,
    maxPoints: MODULES.length * 2 * MAX_SCENARIO_POINTS,
    modules,
    currentWallet,
  };
}
