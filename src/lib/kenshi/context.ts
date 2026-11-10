/**
 * Sensei Kenshi — context assembly (Step 10). Pure. These builders decide EVERYTHING the model may know about the
 * learner's scenarios, so answer protection is enforced here and in server.ts, never by the prompt alone:
 *
 *   • Attempt context: built ONLY for the owner's COMPLETED attempt (the caller has already authenticated and
 *     loaded the attempt through RLS; `buildAttemptContext` re-checks COMPLETED and throws otherwise). It contains
 *     that single scenario's truth, evidence, the learner's own recorded actions, decision, written explanation,
 *     the STORED Step 8 evaluation and score, and the attempt's verified Sandbox payment. Nothing is invented: a
 *     missing evaluation stays null.
 *   • Overview (dashboard / general questions): a compact summary of COMPLETED scenarios only. Unfinished and
 *     locked scenarios appear by title ONLY (titles are public on the Modules page) so the model can recognize them
 *     and decline; no status, evidence, decision, or answer-key text of theirs is ever included.
 *
 * Original attempts and replays are kept apart: an attempt context describes exactly one attempt; the overview
 * summarizes each scenario's OFFICIAL (original) attempt and only counts practice replays.
 */
import { MODULES, SCENARIO_SLOTS, type ScenarioKey } from "@/content/modules";
import type { ScenarioTemplate } from "@/content/scenarios/templateSchema";
import type { EvaluationRow, ScoreRow } from "@/lib/evaluation/results";

export class AttemptNotCompletedError extends Error {
  constructor() {
    super("attempt_not_completed");
    this.name = "AttemptNotCompletedError";
  }
}

export interface AttemptContext {
  kind: "attempt";
  attemptId: string;
  scenarioKey: string;
  title: string;
  module: { title: string; order: number };
  isPractice: boolean;
  attemptNumber: number;
  scamStatus: "fraudulent" | "legitimate";
  decision: { summary: string; appropriate: boolean; outcome: string };
  appropriateDecisions: string[];
  /** Actions the learner actually performed, in order (labels from the scenario), verification ones flagged. */
  actions: { label: string; verification: boolean }[];
  /** Verification actions available in the scenario that the learner did NOT perform. */
  verificationNotDone: string[];
  justification: string;
  /** The stored Step 8 evaluation, or null when none is stored (never invented). */
  evaluation: {
    source: "gemini" | "fallback";
    reasoning: string;
    verification: string;
    payment: string;
    improvement: string;
    takeaway: string;
    unsupportedAssumptions: string[];
    recognized: string[];
    missed: string[];
  } | null;
  score: {
    total: number;
    max: number;
    decision: number;
    reasoning: number;
    verification: number;
    paymentSafety: number;
  } | null;
  payment: { kind: "none" } | { kind: "captured"; amountText: string } | { kind: "not_paid" };
  /** Every evidence item of THIS completed scenario (allowed after completion, R15). */
  evidence: { title: string; type: string; explanation: string }[];
  keyLessons: string[];
  safestNextStep: string;
}

export interface OverviewContext {
  kind: "overview";
  completed: {
    title: string;
    moduleOrder: number;
    scamStatus: "fraudulent" | "legitimate";
    decisionSummary: string;
    appropriate: boolean;
    score: { total: number; max: number } | null;
    recognized: string[];
    missed: string[];
    practiceReplays: number;
  }[];
  /** Titles only: the model knows nothing else about these scenarios. */
  notCompletedTitles: string[];
}

export interface AttemptInput {
  attempt: {
    id: string;
    state: string;
    decisionId: string | null;
    justification: string | null;
    isPractice: boolean;
    attemptNumber: number;
  };
  recordedActionIds: readonly string[];
  /** Amount text of a VERIFIED Sandbox capture of this attempt, if any. */
  capturedAmountText: string | null;
}

const EVIDENCE_TYPE: Record<string, string> = {
  red_flag: "red flag",
  worth_verifying: "worth verifying",
  positive_verification_evidence: "positive verification evidence",
};

function evidenceTitles(t: ScenarioTemplate, ids: readonly string[] | null | undefined): string[] {
  return (ids ?? [])
    .map((id) => t.evidenceDefinitions.find((e) => e.evidenceId === id)?.title)
    .filter((x): x is string => !!x);
}

function decisionSummary(t: ScenarioTemplate, id: string): string {
  return t.render.decisions.find((d) => d.id === id)?.summary ?? id;
}

export function buildAttemptContext(input: {
  template: ScenarioTemplate;
  data: AttemptInput;
  evaluation: EvaluationRow | null;
  score: ScoreRow | null;
}): AttemptContext {
  const { template: t, data, evaluation: e, score } = input;
  const { attempt } = data;
  // Defence in depth: the caller checks too. Nothing about an unfinished attempt is ever assembled.
  if (attempt.state !== "COMPLETED" || !attempt.decisionId) throw new AttemptNotCompletedError();
  const mod = MODULES.find((m) => m.key === t.moduleId);
  const verificationIds = new Set(t.evaluationRubric.verificationActions.map((v) => v.id));
  const done = new Set(data.recordedActionIds);
  const actions = data.recordedActionIds
    .map((id) => t.render.actions.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({ label: a.label, verification: verificationIds.has(a.id) }));
  const verificationNotDone = t.render.actions
    .filter((a) => verificationIds.has(a.id) && !done.has(a.id))
    .map((a) => a.label);
  const isPay = t.paymentConfiguration.payableDecisionIds.includes(attempt.decisionId);
  return {
    kind: "attempt",
    attemptId: attempt.id,
    scenarioKey: t.scenarioId,
    title: t.title,
    module: { title: mod?.title ?? "", order: mod?.order ?? 0 },
    isPractice: attempt.isPractice,
    attemptNumber: attempt.attemptNumber,
    scamStatus: t.fixedScamStatus,
    decision: {
      summary: decisionSummary(t, attempt.decisionId),
      appropriate: t.evaluationRubric.correctDecisionIds.includes(attempt.decisionId),
      outcome: t.fallbackContent.outcomeByDecision[attempt.decisionId] ?? "",
    },
    appropriateDecisions: t.evaluationRubric.correctDecisionIds.map((id) => decisionSummary(t, id)),
    actions,
    verificationNotDone,
    justification: attempt.justification ?? "",
    evaluation:
      e && e.status === "complete"
        ? {
            source: e.source ?? "fallback",
            reasoning: e.reasoning_explanation ?? "",
            verification: e.verification_feedback ?? "",
            payment: e.payment_behavior_feedback ?? "",
            improvement: e.improvement_advice ?? "",
            takeaway: e.educational_takeaway ?? "",
            unsupportedAssumptions: e.unsupported_assumptions ?? [],
            recognized: evidenceTitles(t, e.recognized_evidence_ids),
            missed: evidenceTitles(t, e.missed_evidence_ids),
          }
        : null,
    score: score
      ? {
          total: score.total_points,
          max: score.max_points,
          decision: score.decision_points,
          reasoning: score.reasoning_points,
          verification: score.verification_points,
          paymentSafety: score.payment_safety_points,
        }
      : null,
    payment: !isPay
      ? { kind: "none" }
      : data.capturedAmountText
        ? { kind: "captured", amountText: data.capturedAmountText }
        : { kind: "not_paid" },
    evidence: t.evidenceDefinitions.map((ev) => ({
      title: ev.title,
      type: EVIDENCE_TYPE[ev.evidenceType] ?? ev.evidenceType,
      explanation: ev.explanation,
    })),
    keyLessons: [...t.fallbackContent.keyLessons],
    safestNextStep: t.fallbackContent.safestNextStep,
  };
}

export interface CompletedAttemptRow {
  id: string;
  scenario_key: string;
  is_replay: boolean;
  decision_id: string | null;
  attempt_number: number;
}

/**
 * Overview for general questions. `rows` must be the user's COMPLETED attempts only; `templates` is looked up only
 * for scenarios that appear in those rows (an unfinished scenario's answer key is never read).
 */
export function buildOverviewContext(input: {
  rows: readonly CompletedAttemptRow[];
  getTemplate: (key: string) => ScenarioTemplate | undefined;
  evaluations: ReadonlyMap<
    string,
    Pick<EvaluationRow, "status" | "recognized_evidence_ids" | "missed_evidence_ids">
  >;
  scores: ReadonlyMap<string, { total_points: number; max_points: number }>;
}): OverviewContext {
  const completedKeys = new Set(input.rows.map((r) => r.scenario_key));
  const completed: OverviewContext["completed"] = [];
  for (const slot of SCENARIO_SLOTS) {
    if (!completedKeys.has(slot.key)) continue;
    const mine = input.rows.filter((r) => r.scenario_key === slot.key);
    const official =
      mine.filter((r) => !r.is_replay).sort((a, b) => a.attempt_number - b.attempt_number)[0] ??
      [...mine].sort((a, b) => a.attempt_number - b.attempt_number)[0]!;
    const t = input.getTemplate(slot.key);
    if (!t || !official.decision_id) continue;
    const ev = input.evaluations.get(official.id);
    const sc = input.scores.get(official.id);
    completed.push({
      title: t.title,
      moduleOrder: MODULES.find((m) => m.key === t.moduleId)?.order ?? 0,
      scamStatus: t.fixedScamStatus,
      decisionSummary: decisionSummary(t, official.decision_id),
      appropriate: t.evaluationRubric.correctDecisionIds.includes(official.decision_id),
      score: sc ? { total: sc.total_points, max: sc.max_points } : null,
      recognized: ev?.status === "complete" ? evidenceTitles(t, ev.recognized_evidence_ids) : [],
      missed: ev?.status === "complete" ? evidenceTitles(t, ev.missed_evidence_ids) : [],
      practiceReplays: mine.filter((r) => r.is_replay).length,
    });
  }
  return { kind: "overview", completed, notCompletedTitles: notCompletedTitles(completedKeys) };
}

export function notCompletedTitles(completedKeys: ReadonlySet<string>): string[] {
  return SCENARIO_SLOTS.filter((s) => !completedKeys.has(s.key as ScenarioKey)).map((s) => s.title);
}
