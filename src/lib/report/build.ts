import "server-only";
/**
 * Module analysis report model (Step 11). Pure: built only from STORED data (original attempts, their saved
 * evaluations and immutable scores, the module's Training Funds ledger) plus authored content (answer-key evidence
 * titles, verification-action labels, key lessons, references, the verified policy knowledge base). Gemini is never
 * called to build a report. Server-only (it reads the answer-key mapping), used only for COMPLETED modules.
 *
 * Replays (practice attempts) are never part of a report: only the original, scored attempt of each scenario.
 */
import type { ModuleDefinition } from "@/content/modules";
import { getPolicy } from "@/content/playbook/policies";
import { SCENARIO_PLAYBOOKS } from "@/content/playbook/scenarios.server";
import type { ScenarioTemplate } from "@/content/scenarios/templateSchema";
import { formatMoney } from "@/lib/domain/currency";
import type { WalletSummary } from "@/lib/domain/wallet";
import type { ResultsView } from "@/lib/evaluation/results";
import { formatCompletionDate } from "@/lib/rewards/certificate";

export const REPORT_VERSION = "2026-11-15.1";

export const REPORT_FUNDS_NOTICE =
  "Training Funds are fictional and exist only inside ScamSense. They are not your money, not a PayPal balance, and " +
  "do not reflect your income or finances. Any PayPal payments made during the scenarios were PayPal Sandbox test " +
  "transactions: no real money moved.";

export const REPORT_DISCLAIMER =
  "This report summarizes an educational simulation. It is not financial, legal, or security advice, and it is not a " +
  "PayPal certification. For real account problems, contact PayPal directly through paypal.com or the PayPal app.";

const JUSTIFICATION_EXCERPT_CHARS = 320;

export interface ReportEvidence {
  title: string;
  kind: "red_flag" | "worth_verifying" | "positive_verification_evidence" | string;
  /** Core evidence the scenario is built around (answer key `educationalImportance: core`). */
  important: boolean;
}

export interface ReportScenario {
  position: number;
  scenarioKey: string;
  title: string;
  completedOn: string | null;
  /** False when the saved evaluation can't be read: the section then says so instead of guessing. */
  feedbackAvailable: boolean;
  feedbackSource: "gemini" | "fallback" | null;
  decision: { summary: string; appropriate: boolean | null; outcome: string } | null;
  score: {
    decision: number;
    reasoning: number;
    verification: number;
    paymentSafety: number;
    total: number;
    max: number;
  } | null;
  justificationExcerpt: string | null;
  reasoningSummary: string | null;
  recognized: ReportEvidence[];
  missed: ReportEvidence[];
  unsupportedAssumptions: string[];
  verificationPerformed: string[];
  verificationMissed: string[];
  verificationFeedback: string | null;
  payment: { amountText: string; meaning: "spending" | "fraud_loss" | null } | null;
  improvement: string | null;
  takeaway: string | null;
}

export interface ReportReference {
  title: string;
  publisher: string;
  url: string;
  note: string | null;
}

export interface ModuleReport {
  version: string;
  learnerName: string;
  module: { order: number; title: string; difficulty: string; badgeName: string };
  completedOn: string;
  generatedOn: string;
  certificateId: string | null;
  score: { points: number; max: number; scoredScenarios: number };
  funds: {
    currency: string;
    starting: string;
    ending: string;
    spending: string;
    fraudLoss: string;
    paymentCount: number;
  } | null;
  scenarios: ReportScenario[];
  keyLessons: string[];
  references: ReportReference[];
}

export interface ReportScenarioInput {
  position: number;
  template: ScenarioTemplate | undefined;
  /** Slot title, used if the template is missing. */
  fallbackTitle: string;
  scenarioKey: string;
  completedAt: string | null;
  justification: string | null;
  verificationActionIds: string[];
  /** Saved results (null = evaluation not readable). */
  results: ResultsView | null;
}

export function excerpt(text: string | null, max = JUSTIFICATION_EXCERPT_CHARS): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,.;:!?-]+$/, "")}…`;
}

function evidenceOf(
  template: ScenarioTemplate | undefined,
  items: { id: string; title: string; kind: string }[],
) {
  return items.map((e) => ({
    title: e.title,
    kind: e.kind,
    important:
      template?.evidenceDefinitions.find((d) => d.evidenceId === e.id)?.educationalImportance === "core",
  }));
}

function actionLabel(template: ScenarioTemplate, id: string): string {
  return template.render.actions.find((a) => a.id === id)?.label ?? id.replace(/_/g, " ");
}

export function buildReportScenario(input: ReportScenarioInput): ReportScenario {
  const { template: t, results: r } = input;
  const performed = new Set(input.verificationActionIds);
  const rubricActions = t?.evaluationRubric.verificationActions.map((a) => a.id) ?? [];
  return {
    position: input.position,
    scenarioKey: input.scenarioKey,
    title: t?.title ?? input.fallbackTitle,
    completedOn: input.completedAt ? formatCompletionDate(input.completedAt) : null,
    feedbackAvailable: r !== null,
    feedbackSource: r?.source ?? null,
    decision: r
      ? { summary: r.decision.summary, appropriate: r.decision.correct, outcome: r.decision.outcome }
      : null,
    score: r?.score ?? null,
    justificationExcerpt: excerpt(input.justification),
    reasoningSummary: r?.feedback.reasoning || null,
    recognized: r ? evidenceOf(t, r.recognized) : [],
    // Important (core) misses first.
    missed: r ? evidenceOf(t, r.missed).sort((a, b) => Number(b.important) - Number(a.important)) : [],
    unsupportedAssumptions: r?.feedback.unsupportedAssumptions ?? [],
    verificationPerformed: t
      ? rubricActions.filter((id) => performed.has(id)).map((id) => actionLabel(t, id))
      : [],
    verificationMissed: t
      ? rubricActions.filter((id) => !performed.has(id)).map((id) => actionLabel(t, id))
      : [],
    verificationFeedback: r?.feedback.verification || null,
    payment: r?.payment ? { amountText: r.payment.amountText, meaning: r.payment.meaning } : null,
    improvement: r?.feedback.improvement || null,
    takeaway: r?.feedback.takeaway || null,
  };
}

export function buildModuleReport(input: {
  module: ModuleDefinition;
  learnerName: string;
  completedAt: string;
  generatedAt: string;
  certificateId: string | null;
  wallet: WalletSummary | null;
  scenarios: ReportScenarioInput[];
}): ModuleReport {
  const scenarios = [...input.scenarios].sort((a, b) => a.position - b.position).map(buildReportScenario);
  const scored = scenarios.filter((s) => s.score);
  const w = input.wallet;
  const templates = input.scenarios.map((s) => s.template).filter((t): t is ScenarioTemplate => !!t);

  const keyLessons = [...new Set(templates.flatMap((t) => t.fallbackContent.keyLessons))];

  const references: ReportReference[] = [];
  const seen = new Set<string>();
  for (const t of templates) {
    // The Step 9 deterministic scenario → policy mapping (core policies; same records as the Recovery Playbook).
    const playbook = SCENARIO_PLAYBOOKS[t.scenarioId];
    for (const id of playbook?.policies.core ?? []) {
      const p = getPolicy(id);
      if (!p || seen.has(p.sourceUrl)) continue;
      seen.add(p.sourceUrl);
      references.push({
        title: p.sourceTitle,
        publisher: "PayPal (U.S.)",
        url: p.sourceUrl,
        note:
          p.verificationStatus === "verified"
            ? `Checked by ScamSense on ${p.lastVerified}.`
            : "Official page, linked for reference. Read it on PayPal's site for the current terms.",
      });
    }
    for (const ref of t.evidenceReferences) {
      if (seen.has(ref.url)) continue;
      seen.add(ref.url);
      references.push({ title: ref.title, publisher: ref.publisher, url: ref.url, note: null });
    }
  }

  return {
    version: REPORT_VERSION,
    learnerName: input.learnerName,
    module: {
      order: input.module.order,
      title: input.module.title,
      difficulty: input.module.difficulty,
      badgeName: input.module.badgeName,
    },
    completedOn: formatCompletionDate(input.completedAt),
    generatedOn: formatCompletionDate(input.generatedAt),
    certificateId: input.certificateId,
    score: {
      points: scored.reduce((sum, s) => sum + s.score!.total, 0),
      max: input.module.scenarios.length * 100,
      scoredScenarios: scored.length,
    },
    funds: w
      ? {
          currency: w.currency,
          starting: formatMoney(w.startingMinor, w.currency),
          ending: formatMoney(w.balanceMinor, w.currency),
          spending: formatMoney(w.spendingMinor, w.currency),
          fraudLoss: formatMoney(w.fraudLossMinor, w.currency),
          paymentCount: w.paymentCount,
        }
      : null,
    scenarios,
    keyLessons,
    references,
  };
}
