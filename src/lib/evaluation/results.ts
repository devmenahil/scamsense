/**
 * Client-safe results of a COMPLETED attempt (Step 8). Pure. Built only after completion, so revealing which evidence
 * the learner recognized or missed is allowed (R10 applies during play; R15). Reveal the Red Flags (highlighting
 * inside the environment) and the Recovery Playbook content are Step 9; here they are links only.
 */
import type { ScenarioTemplate } from "@/content/scenarios/templateSchema";
import type { DecisionAssessment } from "./schema";

export interface EvaluationRow {
  status: "pending" | "failed" | "complete";
  source: "gemini" | "fallback" | null;
  decision_correct: boolean | null;
  decision_assessment: DecisionAssessment | null;
  recognized_evidence_ids: string[];
  missed_evidence_ids: string[];
  unsupported_assumptions: string[];
  reasoning_explanation: string | null;
  verification_feedback: string | null;
  payment_behavior_feedback: string | null;
  improvement_advice: string | null;
  educational_takeaway: string | null;
  humorous_comment: string | null;
  failure_count: number;
}

export interface ScoreRow {
  decision_points: number;
  reasoning_points: number;
  verification_points: number;
  payment_safety_points: number;
  total_points: number;
  max_points: number;
}

export interface ResultsView {
  attemptId: string;
  scenarioKey: string;
  title: string;
  moduleKey: string;
  isPractice: boolean;
  source: "gemini" | "fallback";
  decision: { summary: string; correct: boolean; outcome: string; assessment: DecisionAssessment | null };
  score: {
    decision: number;
    reasoning: number;
    verification: number;
    paymentSafety: number;
    total: number;
    max: number;
  } | null;
  feedback: {
    reasoning: string;
    verification: string;
    payment: string;
    improvement: string;
    takeaway: string;
    unsupportedAssumptions: string[];
  };
  /** Separate field, shown separately (R14). For basic feedback it is a fixed encouragement line, labelled so. */
  humorousComment: string;
  recognized: { id: string; title: string; kind: string }[];
  missed: { id: string; title: string; kind: string }[];
  safestNextStep: string;
  payment: { amountText: string; meaning: "spending" | "fraud_loss" | null; practice: boolean } | null;
  recoveryPolicyIds: string[];
}

export function buildResultsView(input: {
  attemptId: string;
  template: ScenarioTemplate;
  isPractice: boolean;
  decisionId: string;
  evaluation: EvaluationRow;
  score: ScoreRow | null;
  payment: { amountText: string; meaning: "spending" | "fraud_loss" | null } | null;
}): ResultsView {
  const { template: t, evaluation: e } = input;
  const decision = t.render.decisions.find((d) => d.id === input.decisionId);
  const evidence = (ids: string[]) =>
    ids
      .map((id) => t.evidenceDefinitions.find((x) => x.evidenceId === id))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => ({ id: x.evidenceId, title: x.title, kind: x.evidenceType }));
  return {
    attemptId: input.attemptId,
    scenarioKey: t.scenarioId,
    title: t.title,
    moduleKey: t.moduleId,
    isPractice: input.isPractice,
    source: e.source ?? "fallback",
    decision: {
      summary: decision?.summary ?? input.decisionId,
      correct: e.decision_correct ?? t.evaluationRubric.correctDecisionIds.includes(input.decisionId),
      outcome: t.fallbackContent.outcomeByDecision[input.decisionId] ?? "",
      assessment: e.decision_assessment,
    },
    score: input.score
      ? {
          decision: input.score.decision_points,
          reasoning: input.score.reasoning_points,
          verification: input.score.verification_points,
          paymentSafety: input.score.payment_safety_points,
          total: input.score.total_points,
          max: input.score.max_points,
        }
      : null,
    feedback: {
      reasoning: e.reasoning_explanation ?? "",
      verification: e.verification_feedback ?? "",
      payment: e.payment_behavior_feedback ?? "",
      improvement: e.improvement_advice ?? "",
      takeaway: e.educational_takeaway ?? "",
      unsupportedAssumptions: e.unsupported_assumptions ?? [],
    },
    humorousComment: e.humorous_comment ?? "",
    recognized: evidence(e.recognized_evidence_ids ?? []),
    missed: evidence(e.missed_evidence_ids ?? []),
    safestNextStep: t.fallbackContent.safestNextStep,
    payment: input.payment ? { ...input.payment, practice: input.isPractice } : null,
    recoveryPolicyIds: [...t.recoveryPolicyIds],
  };
}
