/**
 * Deterministic scenario scoring (R13, R32). 100 points per scenario:
 *
 *   Decision               40  the committed decision is one of the answer key's correct decisions
 *   Reasoning              30  share (by weight) of the answer key's evidence the written reasoning addressed
 *   Verification behavior  20  share (by weight) of the scenario's verification actions the user performed
 *   Payment safety         10  the user took none of the scenario's unsafe payment/credential actions
 *
 * Gemini never produces points. In Phase 6 it only PROPOSES which evidence IDs the reasoning addressed (validated
 * against the answer key, unknown IDs dropped); the deterministic keyword fallback does the same when Gemini is
 * unavailable (R27). This module turns those IDs into points with fixed weights. No AI assessment exists yet, so
 * nothing here invents one: `scoreScenario` requires a real `ReasoningAssessment` from the caller.
 *
 * Verification and unsafe actions are recorded by the scenario engine from in-environment events (Phase 4), never
 * shown as hints during play (R10).
 */

export const SCORE_WEIGHTS = {
  decision: 40,
  reasoning: 30,
  verification: 20,
  paymentSafety: 10,
} as const;

export const MAX_SCENARIO_POINTS =
  SCORE_WEIGHTS.decision + SCORE_WEIGHTS.reasoning + SCORE_WEIGHTS.verification + SCORE_WEIGHTS.paymentSafety;

/** Bump when the formula changes; stored with every score so old scores stay interpretable. */
export const SCORING_VERSION = "2026-11-step5";

export type EvidenceWeight = 1 | 2 | 3;

/** The scoring-relevant subset of a scenario's server-only answer key (authored per scenario in Phase 4/8). */
export interface ScoringRubric {
  correctDecisionIds: readonly string[];
  /** The fixed evidence the reasoning is assessed against (R13). */
  evidence: readonly { id: string; weight: EvidenceWeight }[];
  /** In-environment actions that count as independent verification (e.g. "checked the sender address"). */
  verificationActions: readonly { id: string; weight: EvidenceWeight }[];
  /** Decisions/actions that are unsafe payment behavior (e.g. paying the fraudulent invoice, entering card details). */
  unsafeActionIds: readonly string[];
}

/** Produced in Phase 6 by Gemini (validated) or the deterministic fallback evaluator. */
export interface ReasoningAssessment {
  source: "gemini" | "fallback";
  /** Evidence IDs the reasoning addressed. Unknown IDs are ignored by the scorer. */
  addressedEvidenceIds: readonly string[];
}

export interface AttemptBehavior {
  decisionId: string;
  /** Verification action IDs the engine observed during play. Unknown IDs are ignored. */
  verificationActionIds: readonly string[];
  /** Every action/decision ID taken that could matter for payment safety (including the decision itself). */
  actionIds: readonly string[];
}

export interface ScoreBreakdown {
  decisionCorrect: boolean;
  decisionPoints: number;
  reasoningPoints: number;
  verificationPoints: number;
  paymentSafetyPoints: number;
  totalPoints: number;
  maxPoints: number;
  reasoningSource: ReasoningAssessment["source"];
  /** Validated (known, de-duplicated) IDs actually used for the points above. */
  addressedEvidenceIds: string[];
  verificationActionIds: string[];
  scoringVersion: string;
}

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringError";
  }
}

/** points × (earned weight / total weight), rounded half-up with integer arithmetic. */
function proportional(points: number, earnedWeight: number, totalWeight: number): number {
  if (totalWeight <= 0) throw new ScoringError("rubric weights must sum to more than zero");
  return Math.floor((2 * points * earnedWeight + totalWeight) / (2 * totalWeight));
}

function matched(items: readonly { id: string; weight: number }[], ids: readonly string[]) {
  const wanted = new Set(ids);
  const hits = items.filter((i) => wanted.has(i.id));
  return { ids: hits.map((h) => h.id), weight: hits.reduce((s, h) => s + h.weight, 0) };
}

export function validateRubric(rubric: ScoringRubric): void {
  if (rubric.correctDecisionIds.length === 0)
    throw new ScoringError("rubric needs at least one correct decision");
  if (rubric.evidence.length === 0) throw new ScoringError("rubric needs evidence");
  if (rubric.verificationActions.length === 0) throw new ScoringError("rubric needs verification actions");
  for (const list of [rubric.evidence, rubric.verificationActions]) {
    const ids = list.map((i) => i.id);
    if (new Set(ids).size !== ids.length) throw new ScoringError("rubric IDs must be unique");
  }
  if (rubric.unsafeActionIds.some((id) => rubric.correctDecisionIds.includes(id))) {
    throw new ScoringError("a correct decision cannot also be an unsafe action");
  }
}

export function scoreScenario(
  rubric: ScoringRubric,
  behavior: AttemptBehavior,
  reasoning: ReasoningAssessment,
): ScoreBreakdown {
  validateRubric(rubric);
  const decisionCorrect = rubric.correctDecisionIds.includes(behavior.decisionId);
  const evidence = matched(rubric.evidence, reasoning.addressedEvidenceIds);
  const verification = matched(rubric.verificationActions, behavior.verificationActionIds);
  const totalEvidence = rubric.evidence.reduce((s, e) => s + e.weight, 0);
  const totalVerification = rubric.verificationActions.reduce((s, v) => s + v.weight, 0);
  const actions = new Set([behavior.decisionId, ...behavior.actionIds]);
  const unsafe = rubric.unsafeActionIds.some((id) => actions.has(id));

  const decisionPoints = decisionCorrect ? SCORE_WEIGHTS.decision : 0;
  const reasoningPoints = proportional(SCORE_WEIGHTS.reasoning, evidence.weight, totalEvidence);
  const verificationPoints = proportional(SCORE_WEIGHTS.verification, verification.weight, totalVerification);
  const paymentSafetyPoints = unsafe ? 0 : SCORE_WEIGHTS.paymentSafety;

  return {
    decisionCorrect,
    decisionPoints,
    reasoningPoints,
    verificationPoints,
    paymentSafetyPoints,
    totalPoints: decisionPoints + reasoningPoints + verificationPoints + paymentSafetyPoints,
    maxPoints: MAX_SCENARIO_POINTS,
    reasoningSource: reasoning.source,
    addressedEvidenceIds: evidence.ids,
    verificationActionIds: verification.ids,
    scoringVersion: SCORING_VERSION,
  };
}

/** Sanity check for a stored score row (each component within its range, total = sum). */
export function isValidStoredScore(s: {
  decisionPoints: number;
  reasoningPoints: number;
  verificationPoints: number;
  paymentSafetyPoints: number;
  totalPoints: number;
}): boolean {
  const inRange = (v: number, max: number) => Number.isInteger(v) && v >= 0 && v <= max;
  return (
    (s.decisionPoints === 0 || s.decisionPoints === SCORE_WEIGHTS.decision) &&
    inRange(s.reasoningPoints, SCORE_WEIGHTS.reasoning) &&
    inRange(s.verificationPoints, SCORE_WEIGHTS.verification) &&
    (s.paymentSafetyPoints === 0 || s.paymentSafetyPoints === SCORE_WEIGHTS.paymentSafety) &&
    s.totalPoints === s.decisionPoints + s.reasoningPoints + s.verificationPoints + s.paymentSafetyPoints
  );
}
