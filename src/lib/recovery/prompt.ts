/**
 * Recovery Playbook personalization prompt (Step 9). Pure. Sends only what the note needs: the scenario's outcome,
 * the learner's decision (deterministic correctness), whether a Sandbox payment was made, the lesson, the Playbook's
 * step texts (to choose which to emphasize), and the VERIFIED policy facts as read-only context. No profile data,
 * no explanation text, no amounts, no names.
 */
import type { PlaybookView } from "./playbook";

export const PLAYBOOK_PROMPT_VERSION = "recovery-note-1";

export const PLAYBOOK_SYSTEM = `You are ScamSense's calm, encouraging coach ("practice, not panic").
You write ONE short note (2-3 sentences, at most 380 characters) that connects the learner's own decision in a completed, fictional training scenario to the lesson, and you pick 1-3 of the given step IDs that matter most for them.
Hard rules:
- Do NOT state, summarize, or paraphrase any PayPal policy, protection program, dispute, claim, refund, reimbursement, eligibility, coverage, deadline, timeframe, or procedure. Those are shown separately from verified sources. Do not mention PayPal at all.
- No numbers, links, email addresses, phone numbers, or statistics.
- Never promise any outcome. Never mock or scold; praise first if the decision was appropriate.
- The scenario was fictional and used training money: never say the learner lost or spent real money.
- Return only the requested JSON.`;

export function buildPlaybookPrompt(view: PlaybookView): string {
  const w = view.whatHappened;
  const facts = view.policies
    .filter((p) => p.verified)
    .flatMap((p) => p.facts.map((f) => `- (${p.title}) ${f.text}`));
  return [
    `Scenario: ${view.title} (id ${view.scenarioKey}). It was ${w.scamStatus === "legitimate" ? "a genuine situation" : "a scam"}.`,
    `Learner's decision: ${w.decisionSummary}. This decision was ${w.appropriate ? "appropriate" : "not the safest choice"}.`,
    `Story outcome: ${w.outcome}`,
    w.payment
      ? `They made a PayPal Sandbox test payment in the simulation${w.payment.practice ? " (practice attempt)" : ""}.`
      : "No payment was made in the simulation.",
    `Lesson: ${w.lesson}`,
    "Playbook steps (choose emphasisStepIds only from these ids):",
    ...view.steps.map((s) => `- ${s.id}: ${s.lead ? `${s.lead} ` : ""}${s.text}`),
    "Verified reference facts (context only; do NOT restate them):",
    ...(facts.length ? facts : ["- (none)"]),
  ].join("\n");
}
