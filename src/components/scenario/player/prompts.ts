import type { DecisionContent, DecisionIntent } from "@/content/scenarios/schema";

/**
 * The explanation question asked after a final decision (Step 6 brief §8). It depends only on what the player chose,
 * never on whether it was right.
 */
export const EXPLANATION_PROMPTS: Record<DecisionIntent, string> = {
  pay: "What made you feel comfortable proceeding with this payment?",
  report: "What made you believe this request was suspicious?",
  decline: "What influenced your decision not to proceed?",
  share_code: "What made you comfortable sharing this code?",
  continue_on_site: "What made you comfortable continuing on this website?",
  ship: "What convinced you that the payment had been received?",
  hold: "What influenced your decision not to ship yet?",
};

export function explanationPrompt(decision: Pick<DecisionContent, "intent" | "explanationPrompt">): string {
  return decision.explanationPrompt ?? EXPLANATION_PROMPTS[decision.intent];
}
