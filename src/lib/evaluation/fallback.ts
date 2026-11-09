/**
 * BASIC feedback when Gemini can't evaluate (R27; PRODUCT_SPEC §10, ARCHITECTURE §8.5). Pure and deterministic.
 *
 * It is offered only after a real Gemini attempt failed (or when Gemini isn't configured) and the learner chose to
 * continue. It never pretends to be AI: evidence is matched by the authored keyword lists, all text is authored, and
 * no humorous comment is invented (a fixed, neutral encouragement line is shown instead and labelled as such).
 */
import type { ScenarioTemplate } from "@/content/scenarios/templateSchema";
import type { AttemptFacts } from "./facts";
import type { DecisionAssessment, EvaluationOutput } from "./schema";

export const FALLBACK_ENCOURAGEMENT =
  "Practice, not panic: every scenario you finish sharpens your instincts.";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");

/** Evidence whose authored keywords appear in the explanation (case- and punctuation-insensitive). */
export function keywordMatches(template: ScenarioTemplate, justification: string): string[] {
  const text = ` ${normalize(justification)} `;
  return template.evidenceDefinitions
    .filter((e) =>
      e.keywords.some((k) => {
        const phrase = normalize(k).trim();
        return phrase.length > 0 && text.includes(` ${phrase} `); // whole words/phrases only
      }),
    )
    .map((e) => e.evidenceId);
}

export function fallbackEvaluation(template: ScenarioTemplate, facts: AttemptFacts): EvaluationOutput {
  const recognized = keywordMatches(template, facts.justification);
  const missed = template.evidenceDefinitions
    .map((e) => e.evidenceId)
    .filter((id) => !recognized.includes(id));
  const strong = recognized.length >= 2;
  const assessment: DecisionAssessment = facts.decisionCorrect
    ? strong
      ? "correct_strong_reasoning"
      : "correct_weak_reasoning"
    : facts.actions.some((a) => a.verification)
      ? "incorrect_thoughtful_investigation"
      : "incorrect_unsupported_reasoning";
  const verificationCount = facts.actions.filter((a) => a.verification).length;
  return {
    decisionAssessment: assessment,
    recognizedEvidenceIds: recognized,
    missedEvidenceIds: missed,
    unsupportedAssumptions: [],
    reasoningExplanation: facts.decisionCorrect
      ? template.fallbackContent.feedbackCorrect
      : template.fallbackContent.feedbackIncorrect,
    verificationFeedback:
      verificationCount > 0
        ? `You took ${verificationCount === 1 ? "one checking step" : "several checking steps"} inside the scenario. Checking details through a source you already trust is the habit that matters most.`
        : "Next time, try checking at least one detail through a source you already trust before deciding.",
    paymentBehaviorFeedback: template.fallbackContent.safestNextStep,
    improvementAdvice: template.fallbackContent.keyLessons[1] ?? template.fallbackContent.keyLessons[0]!,
    educationalTakeaway: template.fallbackContent.keyLessons[0]!,
    humorousComment: FALLBACK_ENCOURAGEMENT,
    evaluationConfidence: "low",
    discardedEvidenceIds: [],
  };
}
