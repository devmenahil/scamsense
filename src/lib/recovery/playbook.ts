/**
 * Your Recovery Playbook (Step 9): DETERMINISTIC assembly of a completed attempt's Playbook. Pure (content is passed
 * in or imported from the versioned libraries). Gemini never touches anything built here: policy facts, links,
 * verification dates, steps, and limitations all come from src/content/playbook/.
 */
import { DISTINCTIONS, type DistinctionId } from "@/content/playbook/distinctions";
import {
  getPolicy,
  policyItems,
  POLICY_KB_VERSION,
  TOPIC_LABELS,
  type PolicyRecord,
} from "@/content/playbook/policies";
import type { ScenarioPlaybook } from "@/content/playbook/scenarios.server";
import type { ScenarioTemplate } from "@/content/scenarios/templateSchema";

export interface PlaybookOutcome {
  decisionId: string;
  /** Deterministic: the decision is in the answer key's correct decisions. */
  appropriate: boolean;
  /** A verified PayPal Sandbox capture exists for this attempt. */
  paid: boolean;
  amountText: string | null;
  isPractice: boolean;
}

/** Deterministic policy selection: core ∪ (paid ? whenPaid) ∪ (not appropriate ? whenAffected), de-duplicated. */
export function selectPolicyIds(
  guide: ScenarioPlaybook,
  outcome: Pick<PlaybookOutcome, "appropriate" | "paid">,
) {
  const ids = [
    ...guide.policies.core,
    ...(outcome.paid ? guide.policies.whenPaid : []),
    ...(!outcome.appropriate ? guide.policies.whenAffected : []),
  ];
  return [...new Set(ids)];
}

export interface PlaybookPolicyView {
  policyId: string;
  title: string;
  url: string;
  topic: string;
  verified: boolean;
  lastVerified: string | null;
  lastChecked: string;
  note: string;
  /** "Last updated" date printed on the page, if any. */
  pageUpdated: string | null;
  facts: PolicyItemView[];
  eligibility: PolicyItemView[];
  procedures: PolicyItemView[];
  exclusions: PolicyItemView[];
  exclusionsNote: string | null;
}

export interface PolicyItemView {
  id: string;
  text: string;
  quote: boolean;
}

export interface PlaybookStepView {
  id: string;
  kind: "practice" | "paypal";
  lead: string | null;
  text: string;
  source: { policyId: string; title: string; url: string; lastVerified: string; quote: boolean } | null;
}

export interface PlaybookView {
  attemptId: string;
  scenarioKey: string;
  title: string;
  module: { key: string; title: string; order: number };
  isPractice: boolean;
  attemptNumber: number;
  kbVersion: string;
  whatHappened: {
    decisionSummary: string;
    appropriate: boolean;
    scamStatus: "fraudulent" | "legitimate";
    outcome: string;
    lesson: string;
    framing: string;
    payment: { amountText: string; practice: boolean } | null;
  };
  steps: PlaybookStepView[];
  howPayPalMayHelp: string;
  policies: PlaybookPolicyView[];
  limitations: { id: DistinctionId; title: string; text: string }[];
  prevention: string[];
}

export class PlaybookContentError extends Error {}

/** Card data for one knowledge-base record (Playbook pages and the public /playbook page). */
export function policyView(p: PolicyRecord): PlaybookPolicyView {
  // Unverified records carry no content by construction (schema); keep the guard explicit anyway.
  const verified = p.verificationStatus === "verified";
  const copy = (items: readonly PolicyItemView[]) => (verified ? items.map((i) => ({ ...i })) : []);
  return {
    policyId: p.policyId,
    title: p.sourceTitle,
    url: p.sourceUrl,
    topic: TOPIC_LABELS[p.topic],
    verified,
    lastVerified: p.lastVerified,
    lastChecked: p.lastChecked,
    note: p.verificationNote,
    pageUpdated: p.pageUpdated,
    facts: copy(p.factualSummary),
    eligibility: copy(p.eligibilityConditions),
    procedures: copy(p.procedures),
    exclusions: copy(p.exclusions),
    exclusionsNote: verified ? p.exclusionsNote : null,
  };
}

/**
 * Builds the Playbook. A "paypal" step whose policy or fact is missing or unverified is DROPPED (never shown without
 * its verified source), so a policy change can only remove content, never invent it.
 */
export function buildPlaybookView(input: {
  attemptId: string;
  template: ScenarioTemplate;
  guide: ScenarioPlaybook;
  module: { key: string; title: string; order: number };
  attemptNumber: number;
  outcome: PlaybookOutcome;
}): PlaybookView {
  const { template: t, guide: g, outcome } = input;
  if (g.scenarioKey !== t.scenarioId) throw new PlaybookContentError("guide does not match scenario");
  const policyIds = selectPolicyIds(g, outcome);
  const policies = policyIds
    .map((id) => getPolicy(id))
    .filter((p): p is PolicyRecord => !!p)
    .map(policyView);
  const decision = t.render.decisions.find((d) => d.id === outcome.decisionId);
  const isPayScenario = t.paymentConfiguration.payableDecisionIds.length > 0;

  const steps: PlaybookStepView[] = [];
  for (const s of g.steps) {
    if (s.kind === "practice") {
      steps.push({ id: s.id, kind: "practice", lead: null, text: s.text, source: null });
      continue;
    }
    const p = getPolicy(s.policyId);
    const fact =
      p?.verificationStatus === "verified" ? policyItems(p).find((f) => f.id === s.factId) : undefined;
    if (!p || !fact || !p.lastVerified) continue;
    steps.push({
      id: s.id,
      kind: "paypal",
      lead: s.lead,
      text: fact.text,
      source: {
        policyId: p.policyId,
        title: p.sourceTitle,
        url: p.sourceUrl,
        lastVerified: p.lastVerified,
        quote: fact.quote,
      },
    });
  }

  const limitations = g.distinctions
    .filter((d) => d !== "sandbox_not_coverage" || isPayScenario)
    .map((id) => ({ id, ...DISTINCTIONS[id] }));

  return {
    attemptId: input.attemptId,
    scenarioKey: t.scenarioId,
    title: t.title,
    module: input.module,
    isPractice: outcome.isPractice,
    attemptNumber: input.attemptNumber,
    kbVersion: POLICY_KB_VERSION,
    whatHappened: {
      decisionSummary: decision?.summary ?? outcome.decisionId,
      appropriate: outcome.appropriate,
      scamStatus: t.fixedScamStatus,
      outcome: t.fallbackContent.outcomeByDecision[outcome.decisionId] ?? "",
      lesson: g.lesson,
      framing: outcome.appropriate ? g.framing.appropriate : g.framing.affected,
      payment:
        outcome.paid && outcome.amountText
          ? { amountText: outcome.amountText, practice: outcome.isPractice }
          : null,
    },
    steps,
    howPayPalMayHelp: g.howPayPalMayHelp,
    policies,
    limitations,
    prevention: [...t.fallbackContent.keyLessons],
  };
}
