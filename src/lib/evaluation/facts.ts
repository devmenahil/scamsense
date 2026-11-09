/**
 * Deterministic facts about a finished attempt (Step 8). Pure. Built from the server-only template and the attempt's
 * own records, then used by the scorer, the Gemini evaluation prompt, and the basic fallback evaluator.
 * Nothing here is decided by Gemini.
 */
import type { ScenarioTemplate } from "@/content/scenarios/templateSchema";
import type { AttemptBehavior } from "@/lib/domain/scoring";

export type PaymentFact =
  | { kind: "not_applicable" }
  /** A pay decision whose Sandbox checkout was verified as captured. */
  | { kind: "captured"; amountText: string; practice: boolean }
  /** A pay decision finalized without a payment (cancelled / declined / finished without paying). */
  | { kind: "not_paid"; amountText: string };

export interface AttemptFacts {
  scenarioKey: string;
  title: string;
  isPractice: boolean;
  decisionId: string;
  decisionSummary: string;
  decisionCorrect: boolean;
  justification: string;
  recordedActionIds: string[];
  /** Labels of the actions the learner took, verification ones flagged. */
  actions: { id: string; label: string; verification: boolean }[];
  payment: PaymentFact;
  /** Fictional consequence in the story (authored, deterministic). */
  outcomeText: string;
  /** What the payment means in the fictional wallet, if one was captured. */
  paymentClassification: "spending" | "fraud_loss" | null;
  behavior: AttemptBehavior;
}

export function buildAttemptFacts(input: {
  template: ScenarioTemplate;
  isPractice: boolean;
  decisionId: string;
  justification: string;
  recordedActionIds: readonly string[];
  payment: PaymentFact;
}): AttemptFacts {
  const { template: t } = input;
  const decision = t.render.decisions.find((d) => d.id === input.decisionId);
  if (!decision) throw new Error("decision not in scenario");
  const verificationIds = new Set(t.evaluationRubric.verificationActions.map((v) => v.id));
  const actions = input.recordedActionIds
    .map((id) => t.render.actions.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({ id: a.id, label: a.label, verification: verificationIds.has(a.id) }));
  const captured = input.payment.kind === "captured";
  return {
    scenarioKey: t.scenarioId,
    title: t.title,
    isPractice: input.isPractice,
    decisionId: input.decisionId,
    decisionSummary: decision.summary,
    decisionCorrect: t.evaluationRubric.correctDecisionIds.includes(input.decisionId),
    justification: input.justification,
    recordedActionIds: [...input.recordedActionIds],
    actions,
    payment: input.payment,
    outcomeText: t.fallbackContent.outcomeByDecision[input.decisionId] ?? "",
    paymentClassification:
      captured && t.paymentConfiguration.outcome !== "none" ? t.paymentConfiguration.outcome : null,
    behavior: {
      decisionId: input.decisionId,
      verificationActionIds: actions.filter((a) => a.verification).map((a) => a.id),
      actionIds: [...input.recordedActionIds],
    },
  };
}
