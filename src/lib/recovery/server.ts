import "server-only";
/**
 * Your Recovery Playbook service (Step 9).
 *
 *   1. Load the learner's own attempt (session client: RLS + user filter → 404 for anyone else's) and require
 *      COMPLETED (nothing about the scenario's truth leaves the server earlier, R10).
 *   2. Outcome from stored data only: the locked decision (correctness from the answer key) and a VERIFIED Sandbox
 *      capture from payment_transactions.
 *   3. Deterministic policy selection and Playbook assembly (playbook.ts) from the versioned knowledge base.
 *   4. Optional personal note: ONE Gemini call per attempt, claimed in the database first so refreshes, revisits,
 *      and concurrent tabs never call again; validated (no policy at all, playbook-step IDs only); stored.
 *      If Gemini is unavailable or its output is rejected, the stored source is 'fallback' and the authored Playbook
 *      is shown unchanged. If the Step 9 migration isn't applied, nothing is stored and Gemini is never called.
 * Opening the Playbook never writes to attempts, scores, ledger, payments, or progress, and never calls PayPal.
 */
import { SCENARIO_PLAYBOOKS } from "@/content/playbook/scenarios.server";
import { getScenarioTemplate } from "@/content/scenarios/templates.server";
import { generateJson, isGeminiConfigured } from "@/lib/ai/gemini";
import { recordCacheHit, recordFallback } from "@/lib/ai/usage";
import { ApiError } from "@/lib/api/server";
import { formatMoney } from "@/lib/domain/currency";
import { NotCompletedError } from "@/lib/review/server";
import { buildClientView } from "@/lib/scenario/view";
import { attemptFunctionError, loadAttempt, type LoadedAttempt } from "@/lib/scenario/server";
import { getTrustedWriter, TrustedWriterNotConfiguredError } from "@/lib/supabase/admin";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { buildPlaybookView, selectPolicyIds, type PlaybookView } from "./playbook";
import { buildPlaybookPrompt, PLAYBOOK_PROMPT_VERSION, PLAYBOOK_SYSTEM } from "./prompt";
import { parsePlaybookNote, playbookJsonSchema, type PlaybookNote } from "./schema";

export type NoteState =
  | { status: "ready"; source: "gemini"; note: PlaybookNote }
  | { status: "ready"; source: "fallback" }
  /** Not generated yet: the page may ask for it once (POST). */
  | { status: "missing" }
  /** Another request is generating it right now. */
  | { status: "pending" }
  /** Personal notes can't be stored (migration not applied) or Gemini isn't configured: authored Playbook only. */
  | { status: "unavailable" };

interface NoteRow {
  status: "pending" | "ready";
  source: "gemini" | "fallback" | null;
  note: string | null;
  emphasis_step_ids: string[] | null;
}

export function playbookFromLoaded(loaded: LoadedAttempt): PlaybookView {
  const { attempt } = loaded;
  if (attempt.state !== "COMPLETED" || !attempt.decisionId) throw new NotCompletedError();
  const template = getScenarioTemplate(attempt.scenarioKey);
  const guide = SCENARIO_PLAYBOOKS[attempt.scenarioKey];
  if (!template || !guide) throw new ApiError(404, "unknown_scenario", "That scenario doesn't exist.");
  const captured = loaded.payments.find((p) => p.status === "CAPTURED");
  const mod = buildClientView({ ...loaded, displayName: null }).module;
  return buildPlaybookView({
    attemptId: attempt.id,
    template,
    guide,
    module: mod,
    attemptNumber: attempt.attemptNumber,
    outcome: {
      decisionId: attempt.decisionId,
      appropriate: template.evaluationRubric.correctDecisionIds.includes(attempt.decisionId),
      paid: !!captured,
      amountText: captured ? formatMoney(captured.amountMinor, captured.currency) : null,
      isPractice: attempt.isPractice,
    },
  });
}

async function readNote(
  supabase: SupabaseServerClient,
  userId: string,
  attemptId: string,
  stepIds: readonly string[],
): Promise<NoteState> {
  const { data, error } = await supabase
    .from("attempt_recovery_playbooks")
    .select("status, source, note, emphasis_step_ids")
    .eq("attempt_id", attemptId)
    .eq("user_id", userId)
    .maybeSingle<NoteRow>();
  if (error) return { status: "unavailable" }; // table missing (migration not applied) or unreadable
  if (!data) return isGeminiConfigured() ? { status: "missing" } : { status: "unavailable" };
  if (data.status === "pending") return { status: "pending" };
  if (data.source === "gemini" && data.note)
    return {
      status: "ready",
      source: "gemini",
      // Stored step IDs are re-checked against the current Playbook (content may have changed since).
      note: {
        note: data.note,
        emphasisStepIds: (data.emphasis_step_ids ?? []).filter((id) => stepIds.includes(id)),
      },
    };
  return { status: "ready", source: "fallback" };
}

export async function loadPlaybook(
  supabase: SupabaseServerClient,
  userId: string,
  attemptId: string,
): Promise<{ playbook: PlaybookView; note: NoteState }> {
  const loaded = await loadAttempt(supabase, userId, attemptId);
  if (loaded.attempt.state !== "COMPLETED") throw new NotCompletedError();
  const playbook = playbookFromLoaded(loaded);
  const note = await readNote(
    supabase,
    userId,
    attemptId,
    playbook.steps.map((s) => s.id),
  );
  if (note.status === "ready") recordCacheHit("recovery");
  return { playbook, note };
}

/**
 * Generates (once) and stores the personal note. Safe to call repeatedly: a stored note is returned as is, a
 * concurrent generation answers "pending", and Gemini is called at most once per claim.
 */
export async function personalizePlaybook(
  supabase: SupabaseServerClient,
  userId: string,
  attemptId: string,
): Promise<NoteState> {
  const { playbook, note } = await loadPlaybook(supabase, userId, attemptId);
  if (note.status !== "missing") return note;

  let w;
  try {
    w = getTrustedWriter();
  } catch (e) {
    if (e instanceof TrustedWriterNotConfiguredError) return { status: "unavailable" };
    throw e;
  }
  const stepIds = playbook.steps.map((s) => s.id);
  const { data: claim, error: claimError } = await w.rpc("claim_recovery_playbook", {
    p_user_id: userId,
    p_attempt_id: attemptId,
  });
  if (claimError) {
    if (claimError.code === "P0001" && claimError.message === "attempt_not_completed")
      throw new NotCompletedError();
    if (claimError.code === "P0001") throw attemptFunctionError(claimError);
    return { status: "unavailable" }; // e.g. the Step 9 migration isn't applied: never call Gemini without storage
  }
  if (claim === "ready") return readNote(supabase, userId, attemptId, stepIds);
  if (claim === "busy") return { status: "pending" };

  const policyIds = selectPolicyIds(
    SCENARIO_PLAYBOOKS[playbook.scenarioKey as keyof typeof SCENARIO_PLAYBOOKS],
    {
      appropriate: playbook.whatHappened.appropriate,
      paid: !!playbook.whatHappened.payment,
    },
  );
  const result = await generateJson({
    category: "recovery",
    rateKey: userId,
    systemInstruction: PLAYBOOK_SYSTEM,
    prompt: buildPlaybookPrompt(playbook),
    jsonSchema: playbookJsonSchema(playbook.scenarioKey, stepIds),
    parse: (raw) => parsePlaybookNote(raw, { scenarioKey: playbook.scenarioKey, stepIds }),
    maxOutputTokens: 400,
    temperature: 0.4,
    thinking: "minimal",
  });

  // A rate-limited request never reached Gemini: leave the claim to expire so a later visit can try again.
  if (!result.ok && result.reason === "rate_limited") return { status: "pending" };
  if (!result.ok) recordFallback("recovery");

  const { error } = await w.rpc("complete_recovery_playbook", {
    p_user_id: userId,
    p_attempt_id: attemptId,
    p_source: result.ok ? "gemini" : "fallback",
    p_policy_ids: policyIds,
    p_note: result.ok ? result.value.note : null,
    p_emphasis_step_ids: result.ok ? result.value.emphasisStepIds : [],
    p_kb_version: playbook.kbVersion,
    p_prompt_version: PLAYBOOK_PROMPT_VERSION,
    p_model: result.ok ? result.model : null,
    p_fallback_reason: result.ok ? null : result.reason,
    p_input_tokens: result.ok ? result.usage.inputTokens : null,
    p_output_tokens: result.ok ? result.usage.outputTokens : null,
    p_latency_ms: result.latencyMs,
  });
  if (error) {
    console.error("[recovery] note not saved", { code: error.code });
    return result.ok
      ? { status: "ready", source: "gemini", note: result.value }
      : { status: "ready", source: "fallback" };
  }
  return result.ok
    ? { status: "ready", source: "gemini", note: result.value }
    : { status: "ready", source: "fallback" };
}
