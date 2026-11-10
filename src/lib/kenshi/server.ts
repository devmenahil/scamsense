import "server-only";
/**
 * Sensei Kenshi service (Step 10). One Gemini request per learner question; nothing else calls Gemini (opening or
 * closing the chat, suggestions, and context switches are free).
 *
 * Authorization and answer protection happen HERE, before any prompt exists:
 *   1. The route authenticates the user from the cookie session (requireApiUser) and passes the verified user id.
 *   2. With an attemptId: loadAttempt reads it through the user's session client (RLS + explicit user filter), so a
 *      missing or foreign attempt is a 404. An attempt that isn't COMPLETED is refused (409) and nothing about it is
 *      loaded from the answer key. Only then is that ONE scenario's template read and its context built.
 *   3. Without an attemptId: only the user's COMPLETED attempts are queried; unfinished scenarios contribute their
 *      public title and nothing else.
 *   4. Policy facts come only from the Step 9 knowledge base (retrievePolicies); official links are attached by the
 *      server from those records, never typed by the model.
 *   5. The reply is validated (schema.ts). Failures → a friendly, retryable error; nothing is fabricated (R27).
 * Conversations are not stored: the client sends a bounded history, treated as untrusted text.
 */
import { SCENARIO_SLOTS } from "@/content/modules";
import { SCENARIO_PLAYBOOKS } from "@/content/playbook/scenarios.server";
import { getScenarioTemplate } from "@/content/scenarios/templates.server";
import { generateJson, isGeminiConfigured } from "@/lib/ai/gemini";
import { recordFallback } from "@/lib/ai/usage";
import { ApiError } from "@/lib/api/server";
import { formatMoney } from "@/lib/domain/currency";
import type { EvaluationRow, ScoreRow } from "@/lib/evaluation/results";
import { selectPolicyIds } from "@/lib/recovery/playbook";
import { loadAttempt } from "@/lib/scenario/server";
import { recordedActions } from "@/lib/scenario/view";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import {
  AttemptNotCompletedError,
  buildAttemptContext,
  buildOverviewContext,
  notCompletedTitles,
  type AttemptContext,
  type CompletedAttemptRow,
  type OverviewContext,
} from "./context";
import { retrievePolicies, type RetrievedPolicy } from "./policies";
import { buildKenshiPrompt, KENSHI_SYSTEM, type ChatTurn } from "./prompt";
import { kenshiJsonSchema, parseKenshiOutput } from "./schema";
import type { DiscussableAttempt, KenshiContextLabel, KenshiReply, KenshiSource } from "./types";

export type { DiscussableAttempt, KenshiContextLabel, KenshiReply, KenshiSource };

const EVAL_SELECT =
  "status, source, decision_correct, decision_assessment, recognized_evidence_ids, missed_evidence_ids, unsupported_assumptions, reasoning_explanation, verification_feedback, payment_behavior_feedback, improvement_advice, educational_takeaway, humorous_comment, failure_count";
const SCORE_SELECT =
  "decision_points, reasoning_points, verification_points, payment_safety_points, total_points, max_points";

/** The user's COMPLETED attempts (session client: RLS + explicit user filter). Never unfinished ones. */
async function completedAttempts(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<CompletedAttemptRow[]> {
  const { data, error } = await supabase
    .from("scenario_attempts")
    .select("id, scenario_key, is_replay, decision_id, attempt_number")
    .eq("user_id", userId)
    .eq("state", "COMPLETED")
    .returns<CompletedAttemptRow[]>();
  if (error)
    throw new ApiError(
      503,
      "service_unavailable",
      "Your progress is unavailable right now. Please try again.",
    );
  return data ?? [];
}

const MAX_DISCUSSABLE = 12;

/**
 * The learner's COMPLETED attempts they can choose to discuss (dashboard / Sensei page): ids, public titles, and the
 * practice label only. Unfinished attempts never appear. Returns [] if progress can't be read (the chat still works).
 */
export async function listDiscussableAttempts(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<DiscussableAttempt[]> {
  let rows: CompletedAttemptRow[];
  try {
    rows = await completedAttempts(supabase, userId);
  } catch {
    return [];
  }
  const order = (key: string) => SCENARIO_SLOTS.findIndex((s) => s.key === key);
  return rows
    .filter((r) => order(r.scenario_key) >= 0)
    .sort((a, b) => order(a.scenario_key) - order(b.scenario_key) || a.attempt_number - b.attempt_number)
    .slice(0, MAX_DISCUSSABLE)
    .map((r) => ({
      attemptId: r.id,
      title: SCENARIO_SLOTS[order(r.scenario_key)]!.title,
      isPractice: r.is_replay,
      attemptNumber: r.attempt_number,
    }));
}

async function loadOverview(supabase: SupabaseServerClient, userId: string): Promise<OverviewContext> {
  const rows = await completedAttempts(supabase, userId);
  if (rows.length === 0)
    return buildOverviewContext({
      rows,
      getTemplate: getScenarioTemplate,
      evaluations: new Map(),
      scores: new Map(),
    });
  const ids = new Set(rows.map((r) => r.id));
  const [ev, sc] = await Promise.all([
    supabase
      .from("attempt_evaluations")
      .select("attempt_id, status, recognized_evidence_ids, missed_evidence_ids")
      .eq("user_id", userId)
      .returns<
        {
          attempt_id: string;
          status: EvaluationRow["status"];
          recognized_evidence_ids: string[];
          missed_evidence_ids: string[];
        }[]
      >(),
    supabase
      .from("scenario_scores")
      .select("attempt_id, total_points, max_points")
      .eq("user_id", userId)
      .returns<{ attempt_id: string; total_points: number; max_points: number }[]>(),
  ]);
  // Only rows of COMPLETED attempts are used, whatever else the tables hold.
  const evaluations = new Map(
    (ev.data ?? []).filter((r) => ids.has(r.attempt_id)).map((r) => [r.attempt_id, r]),
  );
  const scores = new Map((sc.data ?? []).filter((r) => ids.has(r.attempt_id)).map((r) => [r.attempt_id, r]));
  return buildOverviewContext({ rows, getTemplate: getScenarioTemplate, evaluations, scores });
}

/**
 * Loads the context of ONE of the user's attempts, refusing anything that isn't COMPLETED. Exported for tests and
 * reused by the route. 404 for missing/foreign attempts (from loadAttempt), 409 for unfinished ones.
 */
export async function loadAttemptChatContext(
  supabase: SupabaseServerClient,
  userId: string,
  attemptId: string,
): Promise<{ context: AttemptContext; policyIds: string[]; notCompleted: string[] }> {
  const loaded = await loadAttempt(supabase, userId, attemptId);
  if (loaded.attempt.state !== "COMPLETED" || !loaded.attempt.decisionId) throw notCompletedError();
  const template = getScenarioTemplate(loaded.attempt.scenarioKey);
  if (!template) throw new ApiError(404, "not_found", "We couldn't find that scenario.");
  const [evaluation, score, rows] = await Promise.all([
    supabase
      .from("attempt_evaluations")
      .select(EVAL_SELECT)
      .eq("attempt_id", attemptId)
      .eq("user_id", userId)
      .maybeSingle<EvaluationRow>(),
    supabase
      .from("scenario_scores")
      .select(SCORE_SELECT)
      .eq("attempt_id", attemptId)
      .eq("user_id", userId)
      .maybeSingle<ScoreRow>(),
    completedAttempts(supabase, userId),
  ]);
  const captured = loaded.payments.find((p) => p.status === "CAPTURED");
  let context: AttemptContext;
  try {
    context = buildAttemptContext({
      template,
      data: {
        attempt: loaded.attempt,
        recordedActionIds: recordedActions(loaded.events),
        capturedAmountText: captured ? formatMoney(captured.amountMinor, captured.currency) : null,
      },
      evaluation: evaluation.error ? null : (evaluation.data ?? null),
      score: score.error ? null : (score.data ?? null),
    });
  } catch (e) {
    if (e instanceof AttemptNotCompletedError) throw notCompletedError();
    throw e;
  }
  const guide = SCENARIO_PLAYBOOKS[template.scenarioId];
  const policyIds = guide
    ? selectPolicyIds(guide, {
        appropriate: context.decision.appropriate,
        paid: context.payment.kind === "captured",
      })
    : [];
  const completedKeys = new Set(rows.map((r) => r.scenario_key));
  completedKeys.add(template.scenarioId);
  return { context, policyIds, notCompleted: notCompletedTitles(completedKeys) };
}

function notCompletedError() {
  return new ApiError(
    409,
    "attempt_not_completed",
    "Sensei Kenshi can talk about this scenario once you've finished it. Until then, ask him general questions.",
  );
}

function sourcesFor(
  policies: readonly RetrievedPolicy[],
  cited: readonly string[],
  reply: string,
): KenshiSource[] {
  // Show what the model cited; if it talked about PayPal without citing, show the records it was grounded on so the
  // learner always has the official page beside a PayPal answer.
  const used = cited.length
    ? policies.filter((p) => cited.includes(p.policyId))
    : /paypal/i.test(reply)
      ? policies
      : [];
  return used.map((p) => ({
    policyId: p.policyId,
    title: p.title,
    url: p.url,
    verified: p.verified,
    lastVerified: p.lastVerified,
  }));
}

export async function askKenshi(
  supabase: SupabaseServerClient,
  userId: string,
  input: { message: string; history: readonly ChatTurn[]; attemptId?: string },
): Promise<KenshiReply> {
  let promptContext: Parameters<typeof buildKenshiPrompt>[0]["context"];
  let label: KenshiContextLabel;
  let scenarioPolicyIds: string[] = [];
  let notCompleted: string[];

  if (input.attemptId) {
    const loaded = await loadAttemptChatContext(supabase, userId, input.attemptId);
    promptContext = { kind: "attempt", attempt: loaded.context, notCompletedTitles: loaded.notCompleted };
    scenarioPolicyIds = loaded.policyIds;
    notCompleted = loaded.notCompleted;
    label = {
      mode: "attempt",
      attemptId: loaded.context.attemptId,
      title: loaded.context.title,
      isPractice: loaded.context.isPractice,
      attemptNumber: loaded.context.attemptNumber,
    };
  } else {
    const overview = await loadOverview(supabase, userId);
    promptContext = { kind: "overview", overview };
    notCompleted = overview.notCompletedTitles;
    label = { mode: "general" };
  }

  if (!isGeminiConfigured()) throw unavailable();

  const policies = retrievePolicies(input.message, scenarioPolicyIds);
  const policyIds = policies.map((p) => p.policyId);
  const result = await generateJson({
    category: "chat",
    // A separate per-user budget, so chatting never uses up the budget for scenario feedback.
    rateKey: `chat:${userId}`,
    systemInstruction: KENSHI_SYSTEM,
    prompt: buildKenshiPrompt({
      context: promptContext,
      policies,
      history: input.history,
      question: input.message,
    }),
    jsonSchema: kenshiJsonSchema(policyIds),
    parse: (raw) =>
      parseKenshiOutput(raw, {
        policyIds,
        notCompletedTitles: notCompleted,
        verifiedFacts: policies.flatMap((p) => p.facts.map((f) => f.text)),
      }),
    maxOutputTokens: 900,
    temperature: 0.5,
    thinking: "minimal",
  });
  if (!result.ok) {
    recordFallback("chat");
    if (result.reason === "rate_limited" || result.reason === "quota_exhausted")
      throw new ApiError(
        429,
        "kenshi_busy",
        "Sensei Kenshi is answering a lot of questions right now. Please wait a minute and try again.",
      );
    throw unavailable();
  }
  return {
    reply: result.value.reply,
    sources: sourcesFor(policies, result.value.citedPolicyIds, result.value.reply),
    followUps: result.value.followUps,
    context: label,
  };
}

function unavailable() {
  return new ApiError(
    503,
    "kenshi_unavailable",
    "Sensei Kenshi can't answer right now. Please try again in a moment. Meanwhile, Your Recovery Playbook and your scenario results are good places to look.",
  );
}
