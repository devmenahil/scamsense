/**
 * Deterministic scenario routing (Step 8). Pure: no Gemini, no I/O. Ranks ONLY the two scenarios of one module.
 *
 *   ScenarioRelevanceScore = 0.50·A + 0.20·C + 0.15·E + 0.15·D          (each component in [0, 1])
 *
 *   A  Financial activity relevance = |user activity tags ∩ scenario activity tags| / |scenario activity tags|
 *   C  Context relevance            = |user context tags ∩ scenario context tags| / |user context tags|
 *   E  Evidence relevance           = 0.5 for every scenario (no verified evidence knowledge base exists; we never
 *                                     invent fraud rates or demographic risk, Step 8 brief §6)
 *   D  Difficulty suitability       = 1 (both scenarios of a module share the module's difficulty; difficulty is never
 *                                     skipped or changed for age, occupation, or experience)
 *
 * Ties are broken by the stable scenario key (m1-s1 before m1-s2). The scores express how relevant a scenario's
 * situation is to the activities a learner reported. They are NOT probabilities of becoming a victim.
 *
 * Arithmetic is integer basis points (1 = 10 000 bp) so the result is reproducible on every machine.
 * Gemini never calls this and never supplies scores: at most it supplies validated tags (src/lib/routing).
 */
import type { ActivityTag, ContextTag } from "@/content/scenarios/templateSchema";

export const ROUTING_VERSION = "2026-11-step8.1";

export const RELEVANCE_WEIGHTS = { activity: 50, context: 20, evidence: 15, difficulty: 15 } as const;
/** E when no verified evidence knowledge base is configured (Step 8 brief §6). */
export const DEFAULT_EVIDENCE_RELEVANCE_BP = 5_000;
/** D: both scenarios of a module have the module's approved difficulty. */
export const DIFFICULTY_SUITABILITY_BP = 10_000;

const BP = 10_000;

export interface RoutableScenario {
  key: string;
  moduleKey: string;
  activityTags: readonly ActivityTag[];
  contextTags: readonly ContextTag[];
}

export interface ResolvedProfileTags {
  activityTags: readonly ActivityTag[];
  contextTags: readonly ContextTag[];
}

export interface ScenarioRelevance {
  scenarioKey: string;
  /** Components and total in basis points (0–10 000). */
  activityBp: number;
  contextBp: number;
  evidenceBp: number;
  difficultyBp: number;
  totalBp: number;
}

export class RoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutingError";
  }
}

/** n / d in basis points, half-up, integer only. 0 when d = 0. */
function ratioBp(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.floor((2 * n * BP + d) / (2 * d));
}

const unique = <T>(xs: readonly T[]) => [...new Set(xs)];

export function scoreScenario(profile: ResolvedProfileTags, scenario: RoutableScenario): ScenarioRelevance {
  const userActivities = new Set(profile.activityTags);
  const scenarioActivities = unique(scenario.activityTags);
  const userContexts = unique(profile.contextTags);
  const scenarioContexts = new Set(scenario.contextTags);

  const activityBp = ratioBp(
    scenarioActivities.filter((t) => userActivities.has(t)).length,
    scenarioActivities.length,
  );
  const contextBp = ratioBp(userContexts.filter((t) => scenarioContexts.has(t)).length, userContexts.length);
  const evidenceBp = DEFAULT_EVIDENCE_RELEVANCE_BP;
  const difficultyBp = DIFFICULTY_SUITABILITY_BP;
  const w = RELEVANCE_WEIGHTS;
  const weighted =
    w.activity * activityBp + w.context * contextBp + w.evidence * evidenceBp + w.difficulty * difficultyBp;
  return {
    scenarioKey: scenario.key,
    activityBp,
    contextBp,
    evidenceBp,
    difficultyBp,
    totalBp: Math.floor((weighted + 50) / 100),
  };
}

/**
 * Ranks the eligible scenarios of ONE module, highest relevance first (ties: scenario key ascending). Refuses a list
 * that mixes modules or doesn't contain exactly two scenarios, so routing can never add, drop, or borrow a scenario
 * from another (possibly locked) module.
 */
export function rankModuleScenarios(
  profile: ResolvedProfileTags,
  scenarios: readonly RoutableScenario[],
): ScenarioRelevance[] {
  if (scenarios.length !== 2) throw new RoutingError("a module has exactly two scenarios");
  const moduleKeys = new Set(scenarios.map((s) => s.moduleKey));
  if (moduleKeys.size !== 1) throw new RoutingError("only one module's scenarios can be ranked together");
  if (new Set(scenarios.map((s) => s.key)).size !== scenarios.length)
    throw new RoutingError("duplicate scenario");
  return scenarios
    .map((s) => scoreScenario(profile, s))
    .sort((a, b) => b.totalBp - a.totalBp || (a.scenarioKey < b.scenarioKey ? -1 : 1));
}

/** Basis points → a 0–1 number with four decimals, for display in development reports only. */
export function bpToUnit(bp: number): number {
  return bp / BP;
}

/**
 * Applies a persisted order to a module's two scenario slots. An order that doesn't name exactly the module's own
 * scenarios is ignored (authored slot order), so a stale or tampered row can never hide or add a scenario.
 */
export function applyScenarioOrder<T extends { key: string }>(
  slots: readonly T[],
  order: readonly string[] | null | undefined,
): T[] {
  if (!order || order.length !== slots.length) return [...slots];
  const keys = slots.map((s) => s.key);
  if (!order.every((k) => keys.includes(k)) || new Set(order).size !== order.length) return [...slots];
  return order.map((k) => slots.find((s) => s.key === k)!);
}
