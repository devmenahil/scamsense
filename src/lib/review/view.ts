/**
 * Reveal the Red Flags (Step 9): the CLIENT-SAFE review of a COMPLETED attempt. Pure.
 *
 * Built only after completion (the caller checks the state), so evidence may be revealed (R10 applies during play,
 * R15 allows it after). Everything authoritative — which elements are evidence, their classification, title, and
 * explanation — comes from the server-only answer key. The learner's stored Step 8 evaluation only adds a separate
 * "your reasoning" note (mentioned / worth a second look); it never changes the explanation or the score.
 */
import type { EvidenceDefinition, ScenarioTemplate } from "@/content/scenarios/templateSchema";
import type { ScenarioRender } from "@/content/scenarios/schema";
import { isAvailable } from "@/lib/domain/scenarioStateMachine";
import { locateAnchors, reviewRecordedActions, type AnchorLocation } from "./locate";

export type ReviewEvidenceKind = "red_flag" | "verify" | "positive";

const KIND: Record<EvidenceDefinition["evidenceType"], ReviewEvidenceKind> = {
  red_flag: "red_flag",
  worth_verifying: "verify",
  positive_verification_evidence: "positive",
};

export interface ReviewEvidence {
  /** 1-based marker number, in answer-key order. */
  number: number;
  id: string;
  anchor: string;
  kind: ReviewEvidenceKind;
  title: string;
  explanation: string;
  core: boolean;
  location: AnchorLocation | null;
  /** False when the content only appears after an action the learner never took (e.g. a reply they didn't send). */
  seenDuringAttempt: boolean;
  /** From the stored evaluation; null when no evaluation exists. Never changes the authoritative explanation. */
  reasoning: "mentioned" | "missed" | "not_mentioned" | null;
}

export interface ReviewView {
  attemptId: string;
  scenarioKey: string;
  title: string;
  module: { key: string; title: string; order: number };
  attemptNumber: number;
  isPractice: boolean;
  scamStatus: "fraudulent" | "legitimate";
  decision: { summary: string; correct: boolean };
  /** The same filled (personalized) render the learner played. Never regenerated. */
  render: ScenarioRender;
  /** Actions treated as recorded in the review: the learner's own first, then every other one (read-only). */
  revealActions: string[];
  evidence: ReviewEvidence[];
  unsupportedAssumptions: string[];
  reasoningSource: "gemini" | "fallback" | null;
}

export function buildReviewView(input: {
  attemptId: string;
  template: ScenarioTemplate;
  render: ScenarioRender;
  module: { key: string; title: string; order: number };
  attemptNumber: number;
  isPractice: boolean;
  decisionId: string;
  learnerActions: readonly string[];
  evaluation: {
    source: "gemini" | "fallback" | null;
    recognizedEvidenceIds: string[];
    missedEvidenceIds: string[];
    unsupportedAssumptions: string[];
  } | null;
}): ReviewView {
  const { template: t, render, evaluation: e } = input;
  const locations = locateAnchors(render);
  const decision = render.decisions.find((d) => d.id === input.decisionId);
  return {
    attemptId: input.attemptId,
    scenarioKey: t.scenarioId,
    title: t.title,
    module: input.module,
    attemptNumber: input.attemptNumber,
    isPractice: input.isPractice,
    scamStatus: t.fixedScamStatus,
    decision: {
      summary: decision?.summary ?? input.decisionId,
      correct: t.evaluationRubric.correctDecisionIds.includes(input.decisionId),
    },
    render,
    revealActions: reviewRecordedActions(render, input.learnerActions),
    evidence: t.evidenceDefinitions.map((d, i) => {
      const location = locations.get(d.targetElementId) ?? null;
      return {
        number: i + 1,
        id: d.evidenceId,
        anchor: d.targetElementId,
        kind: KIND[d.evidenceType],
        title: d.title,
        explanation: d.explanation,
        core: d.educationalImportance === "core",
        location,
        seenDuringAttempt: location ? isAvailable(location.requires, input.learnerActions) : true,
        reasoning: !e
          ? null
          : e.recognizedEvidenceIds.includes(d.evidenceId)
            ? "mentioned"
            : e.missedEvidenceIds.includes(d.evidenceId)
              ? "missed"
              : "not_mentioned",
      };
    }),
    unsupportedAssumptions: e?.unsupportedAssumptions ?? [],
    reasoningSource: e?.source ?? null,
  };
}
