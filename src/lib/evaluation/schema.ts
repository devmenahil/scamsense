/**
 * Gemini reasoning-evaluation output: schema and validation (Step 8, Component D). Pure.
 *
 * ONE Gemini response per completed attempt carries the evidence identification, the feedback, the advice, and a
 * separate humorous comment (R14). The backend:
 *   • discards evidence IDs that aren't in this scenario's answer key (CLAUDE.md "AI boundaries");
 *   • rejects output whose decision assessment contradicts the deterministic correctness of the decision;
 *   • rejects invented policy, refund promises, statistics, points/scores, links, and mocking language;
 *   • never accepts a number of points from Gemini (scoring.ts computes them).
 */
import { z } from "zod";
import { InvalidOutputError } from "@/lib/ai/errors";

export const DECISION_ASSESSMENTS = [
  "correct_strong_reasoning",
  "correct_weak_reasoning",
  "correct_unrelated_reasoning",
  "incorrect_thoughtful_investigation",
  "incorrect_unsupported_reasoning",
] as const;
export type DecisionAssessment = (typeof DECISION_ASSESSMENTS)[number];

export const TEXT_LIMITS = {
  reasoningExplanation: 900,
  verificationFeedback: 450,
  paymentBehaviorFeedback: 450,
  improvementAdvice: 450,
  educationalTakeaway: 220,
  humorousComment: 180,
  assumption: 160,
} as const;

export interface EvaluationOutput {
  decisionAssessment: DecisionAssessment;
  recognizedEvidenceIds: string[];
  missedEvidenceIds: string[];
  unsupportedAssumptions: string[];
  reasoningExplanation: string;
  verificationFeedback: string;
  paymentBehaviorFeedback: string;
  improvementAdvice: string;
  educationalTakeaway: string;
  humorousComment: string;
  evaluationConfidence: "low" | "medium" | "high";
  /** Evidence IDs Gemini returned that aren't in the answer key (discarded; kept for monitoring only). */
  discardedEvidenceIds: string[];
}

const textField = (max: number) => z.string().trim().min(1).max(max);

const rawSchema = z.object({
  scenarioId: z.string(),
  decisionAssessment: z.enum(DECISION_ASSESSMENTS),
  recognizedEvidenceIds: z.array(z.string()).max(20),
  missedEvidenceIds: z.array(z.string()).max(20),
  unsupportedAssumptions: z.array(textField(TEXT_LIMITS.assumption)).max(3),
  reasoningExplanation: textField(TEXT_LIMITS.reasoningExplanation),
  verificationFeedback: textField(TEXT_LIMITS.verificationFeedback),
  paymentBehaviorFeedback: textField(TEXT_LIMITS.paymentBehaviorFeedback),
  improvementAdvice: textField(TEXT_LIMITS.improvementAdvice),
  educationalTakeaway: textField(TEXT_LIMITS.educationalTakeaway),
  humorousComment: textField(TEXT_LIMITS.humorousComment),
  evaluationConfidence: z.enum(["low", "medium", "high"]),
});

/** Policy facts come only from the authored Recovery Playbook (R21, R30): Gemini must not state them. */
const POLICY =
  /purchase protection|seller protection|buyer protection|resolution cent(er|re)|money[- ]back|guarantee(d|s)? (a |your )?refund|refund guarantee|refund (is|will be)|will (be )?refund|get (a|your) refund|within \d+ (business )?(days|hours)|chargeback/i;
const STATISTICS = /\d+(\.\d+)?\s?%|\bpercent\b|\b\d+ (out of|in) \d+\b|\b(million|billion)\b|statistic/i;
const POINTS = /\b\d+\s*(points?|pts)\b|\/\s*100\b|\bscore(d)?\b/i;
const LINKS = /https?:|www\.|[a-z0-9-]+\.(com|net|org|io|gov)\b/i;
const MOCKING = /\b(stupid|dumb|idiot|moron|gullible|naive|foolish|clueless|loser|pathetic|shame on)\b/i;

export class EvaluationOutputError extends InvalidOutputError {}

export function parseEvaluationOutput(
  raw: unknown,
  ctx: {
    scenarioKey: string;
    evidenceIds: readonly string[];
    /** Core evidence the learner must at least be told about when they missed it. */
    coreEvidenceIds: readonly string[];
    decisionCorrect: boolean;
  },
): EvaluationOutput {
  const out = rawSchema.parse(raw);
  if (out.scenarioId !== ctx.scenarioKey) throw new EvaluationOutputError("wrong scenario");
  const assessmentCorrect = out.decisionAssessment.startsWith("correct_");
  if (assessmentCorrect !== ctx.decisionCorrect)
    throw new EvaluationOutputError("assessment contradicts answer key");

  const known = new Set(ctx.evidenceIds);
  const discardedEvidenceIds = [...out.recognizedEvidenceIds, ...out.missedEvidenceIds].filter(
    (id) => !known.has(id),
  );
  const recognized = [...new Set(out.recognizedEvidenceIds.filter((id) => known.has(id)))];
  const missed = new Set(out.missedEvidenceIds.filter((id) => known.has(id) && !recognized.includes(id)));
  // Unrecognized core evidence is always reported as missed (deterministic completeness).
  for (const id of ctx.coreEvidenceIds) if (!recognized.includes(id)) missed.add(id);

  const texts = [
    out.reasoningExplanation,
    out.verificationFeedback,
    out.paymentBehaviorFeedback,
    out.improvementAdvice,
    out.educationalTakeaway,
    out.humorousComment,
    ...out.unsupportedAssumptions,
  ];
  for (const t of texts) {
    if (POLICY.test(t)) throw new EvaluationOutputError("policy claim");
    if (STATISTICS.test(t)) throw new EvaluationOutputError("statistic");
    if (POINTS.test(t)) throw new EvaluationOutputError("points");
    if (LINKS.test(t)) throw new EvaluationOutputError("link");
    if (MOCKING.test(t)) throw new EvaluationOutputError("mocking tone");
    if (/<\/?untrusted|\{\{|\}\}/.test(t)) throw new EvaluationOutputError("markup");
  }

  return {
    decisionAssessment: out.decisionAssessment,
    recognizedEvidenceIds: recognized,
    missedEvidenceIds: ctx.evidenceIds.filter((id) => missed.has(id)),
    unsupportedAssumptions: out.unsupportedAssumptions,
    reasoningExplanation: out.reasoningExplanation,
    verificationFeedback: out.verificationFeedback,
    paymentBehaviorFeedback: out.paymentBehaviorFeedback,
    improvementAdvice: out.improvementAdvice,
    educationalTakeaway: out.educationalTakeaway,
    humorousComment: out.humorousComment,
    evaluationConfidence: out.evaluationConfidence,
    discardedEvidenceIds,
  };
}

export function evaluationJsonSchema(
  scenarioKey: string,
  evidenceIds: readonly string[],
): Record<string, unknown> {
  const ids = { type: "array", items: { type: "string", enum: [...evidenceIds] } };
  const str = (maxLength: number, description?: string) => ({
    type: "string",
    maxLength,
    ...(description ? { description } : {}),
  });
  return {
    type: "object",
    properties: {
      scenarioId: { type: "string", enum: [scenarioKey] },
      decisionAssessment: { type: "string", enum: [...DECISION_ASSESSMENTS] },
      recognizedEvidenceIds: ids,
      missedEvidenceIds: ids,
      unsupportedAssumptions: { type: "array", items: str(TEXT_LIMITS.assumption), maxItems: 3 },
      reasoningExplanation: str(TEXT_LIMITS.reasoningExplanation, "Praise first, then explain."),
      verificationFeedback: str(TEXT_LIMITS.verificationFeedback),
      paymentBehaviorFeedback: str(TEXT_LIMITS.paymentBehaviorFeedback),
      improvementAdvice: str(TEXT_LIMITS.improvementAdvice),
      educationalTakeaway: str(TEXT_LIMITS.educationalTakeaway, "One sentence to remember."),
      humorousComment: str(TEXT_LIMITS.humorousComment, "One short, kind, witty line."),
      evaluationConfidence: { type: "string", enum: ["low", "medium", "high"] },
    },
    required: [
      "scenarioId",
      "decisionAssessment",
      "recognizedEvidenceIds",
      "missedEvidenceIds",
      "unsupportedAssumptions",
      "reasoningExplanation",
      "verificationFeedback",
      "paymentBehaviorFeedback",
      "improvementAdvice",
      "educationalTakeaway",
      "humorousComment",
      "evaluationConfidence",
    ],
  };
}
