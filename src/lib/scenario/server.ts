import "server-only";
/**
 * Scenario attempt service (Step 6). READS use the signed-in user's session client (RLS scopes every row to the
 * user). WRITES go through the trusted writer's `create_scenario_attempt` / `apply_attempt_event` functions with the
 * user id from the verified session only (R32).
 *
 * The answer key is never loaded here: attempts only need the client-safe render (R10). Evaluation (Step 8) will
 * load templates.server.ts after FINALIZED.
 */
import { getScenarioSlot, type ScenarioKey } from "@/content/modules";
import { getScenarioRender, scenarioRules } from "@/content/scenarios/renders";
import { ApiError, dbError } from "@/lib/api/server";
import { planScenarioStart, ProgressionError } from "@/lib/domain/progression";
import {
  SCENARIO_STATES,
  transition,
  TransitionError,
  type ScenarioEvent,
  type ScenarioState,
} from "@/lib/domain/scenarioStateMachine";
import { loadProgressSnapshot } from "@/lib/progress/server";
import type { Profile } from "@/lib/profile/schema";
import { getTrustedWriter, TrustedWriterNotConfiguredError } from "@/lib/supabase/admin";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { isPayPalConfigured } from "@/lib/payments/config";
import {
  buildClientView,
  type AttemptData,
  type AttemptEventData,
  type AttemptPaymentData,
  type ClientAttemptView,
} from "./view";

const ATTEMPT_SELECT =
  "id, user_id, module_run_id, scenario_key, attempt_number, is_replay, state, pending_decision_id, decision_id, justification";

interface AttemptRow {
  id: string;
  user_id: string;
  module_run_id: string;
  scenario_key: string;
  attempt_number: number;
  is_replay: boolean;
  state: string;
  pending_decision_id: string | null;
  decision_id: string | null;
  justification: string | null;
}

export interface LoadedAttempt {
  attempt: AttemptData;
  events: AttemptEventData[];
  run: { currency: string; startingFundsMinor: number };
  /** The attempt's PayPal Sandbox orders (Step 7), oldest first. */
  payments: AttemptPaymentData[];
}

const PAYMENT_SELECT =
  "id, request_id, paypal_order_id, checkout_sequence, status, amount_minor, currency, paypal_capture_id, captured_at, failure_code";

interface PaymentRow {
  id: string;
  request_id: string;
  paypal_order_id: string;
  checkout_sequence: number;
  status: AttemptPaymentData["status"];
  amount_minor: number | string;
  currency: string;
  paypal_capture_id: string | null;
  captured_at: string | null;
  failure_code: string | null;
}

export function toPaymentData(r: PaymentRow): AttemptPaymentData {
  const amountMinor = Number(r.amount_minor);
  if (!Number.isSafeInteger(amountMinor)) throw new Error("Unexpected payment amount");
  return {
    id: r.id,
    requestId: r.request_id,
    orderId: r.paypal_order_id,
    checkoutSequence: r.checkout_sequence,
    status: r.status,
    amountMinor,
    currency: r.currency,
    captureId: r.paypal_capture_id,
    capturedAt: r.captured_at,
    failureCode: r.failure_code,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function writer() {
  try {
    return getTrustedWriter();
  } catch (e) {
    if (e instanceof TrustedWriterNotConfiguredError) {
      console.error("[scenario] trusted writer not configured");
      throw new ApiError(
        503,
        "service_unavailable",
        "Scenarios can't be saved right now. Please try again later.",
      );
    }
    throw e;
  }
}

/** Maps the migration's stable P0001 messages to calm responses. */
export function attemptFunctionError(error: { code?: string; message?: string }): ApiError {
  if (error.code === "P0001") {
    switch (error.message) {
      case "module_locked":
        return new ApiError(409, "module_locked", "Finish the previous module to unlock this scenario.");
      case "module_not_started":
        return new ApiError(
          409,
          "module_not_started",
          "Start the module first to set up your Training Funds.",
        );
      case "attempt_not_found":
        return new ApiError(404, "not_found", "We couldn't find that scenario attempt.");
      case "attempt_state_conflict":
      case "invalid_state_transition":
      case "attempt_final":
      case "attempt_decision_locked":
      case "decision_mismatch":
        return new ApiError(409, "state_conflict", "This scenario moved on in another tab. Refreshing…");
      case "attempt_event_limit":
        return new ApiError(409, "event_limit", "This attempt has recorded the maximum number of actions.");
      default:
        console.error("[scenario] rejected by database", { reason: error.message });
        return new ApiError(
          409,
          "conflict",
          "That action isn't available right now. Please refresh and try again.",
        );
    }
  }
  return dbError(error, "Scenarios");
}

function toAttemptData(r: AttemptRow): AttemptData {
  if (!(SCENARIO_STATES as readonly string[]).includes(r.state)) throw new Error("Unknown attempt state");
  if (!getScenarioSlot(r.scenario_key)) throw new Error("Unknown scenario key");
  return {
    id: r.id,
    scenarioKey: r.scenario_key as ScenarioKey,
    attemptNumber: r.attempt_number,
    isPractice: r.is_replay,
    state: r.state as ScenarioState,
    pendingDecisionId: r.pending_decision_id,
    decisionId: r.decision_id,
    justification: r.justification,
  };
}

/**
 * Loads the user's own attempt (RLS + explicit user filter), its module run, and its event log in ONE round trip
 * (two parallel queries). 404 for a missing or foreign attempt.
 */
export async function loadAttempt(
  supabase: SupabaseServerClient,
  userId: string,
  attemptId: string,
): Promise<LoadedAttempt> {
  if (!UUID.test(attemptId)) throw new ApiError(404, "not_found", "We couldn't find that scenario attempt.");
  const [attempt, events, payments] = await Promise.all([
    supabase
      .from("scenario_attempts")
      .select(`${ATTEMPT_SELECT}, module_runs!scenario_attempts_run_fk(currency, starting_funds_minor)`)
      .eq("id", attemptId)
      .eq("user_id", userId)
      .maybeSingle<
        AttemptRow & { module_runs: { currency: string; starting_funds_minor: number | string } | null }
      >(),
    supabase
      .from("scenario_attempt_events")
      .select("event_type, action_id")
      .eq("attempt_id", attemptId)
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .returns<{ event_type: string; action_id: string | null }[]>(),
    supabase
      .from("payment_transactions")
      .select(PAYMENT_SELECT)
      .eq("attempt_id", attemptId)
      .eq("user_id", userId)
      .order("checkout_sequence", { ascending: true })
      .returns<PaymentRow[]>(),
  ]);
  if (attempt.error) throw dbError(attempt.error, "Scenarios");
  if (events.error) throw dbError(events.error, "Scenarios");
  if (payments.error) throw dbError(payments.error, "Payments");
  const row = attempt.data;
  if (!row || !row.module_runs)
    throw new ApiError(404, "not_found", "We couldn't find that scenario attempt.");
  const funds = Number(row.module_runs.starting_funds_minor);
  if (!Number.isSafeInteger(funds)) throw new Error("Unexpected starting funds");
  return {
    attempt: toAttemptData(row),
    events: (events.data ?? []).map((e) => ({ eventType: e.event_type, actionId: e.action_id })),
    run: { currency: row.module_runs.currency, startingFundsMinor: funds },
    payments: (payments.data ?? []).map(toPaymentData),
  };
}

export function viewFor(loaded: LoadedAttempt, displayName: string | null): ClientAttemptView {
  return buildClientView({ ...loaded, displayName, paymentsAvailable: isPayPalConfigured() });
}

/**
 * Starts, resumes, or replays a scenario. The module must be unlocked and started (R7); a completed scenario starts a
 * new PRACTICE attempt (replay) with its own id; an unfinished attempt is always resumed, never duplicated.
 */
export async function startScenarioAttempt(
  supabase: SupabaseServerClient,
  userId: string,
  profile: Pick<Profile, "incomeBracket" | "preferredCurrency">,
  scenarioKey: string,
): Promise<{ attemptId: string; kind: "new" | "resume" | "replay" }> {
  const render = getScenarioRender(scenarioKey);
  if (!render) throw new ApiError(404, "unknown_scenario", "That scenario doesn't exist.");
  const snapshot = await loadProgressSnapshot(supabase, userId, profile);
  let plan;
  try {
    plan = planScenarioStart(snapshot.progression, scenarioKey);
  } catch (e) {
    if (e instanceof ProgressionError) {
      throw new ApiError(e.code === "unknown_scenario" ? 404 : 409, e.code, e.message);
    }
    throw e;
  }
  if (plan.kind === "resume") return { attemptId: plan.attemptId, kind: "resume" };

  const { data, error } = await writer().rpc("create_scenario_attempt", {
    p_user_id: userId,
    p_scenario_key: scenarioKey,
    p_content_version: render.contentVersion,
  });
  if (error) throw attemptFunctionError(error);
  const row = data as { id: string; attempt_number: number } | null;
  if (!row?.id)
    throw new ApiError(503, "service_unavailable", "We couldn't start the scenario. Please try again.");
  return { attemptId: row.id, kind: row.attempt_number > 1 ? "replay" : "new" };
}

/**
 * Applies one event to an attempt: the pure state machine decides, the database re-checks and records. Returns the
 * fresh client view. `SUBMIT_EXPLANATION` carries the justification text.
 */
export async function applyAttemptEvent(
  userId: string,
  displayName: string | null,
  loaded: LoadedAttempt,
  event: ScenarioEvent,
): Promise<ClientAttemptView> {
  const attemptId = loaded.attempt.id;
  const render = getScenarioRender(loaded.attempt.scenarioKey)!;
  let result;
  try {
    result = transition(
      {
        state: loaded.attempt.state,
        recordedActionIds: loaded.events
          .filter((e) => e.eventType === "RECORD_ACTION")
          .map((e) => e.actionId!),
        pendingDecisionId: loaded.attempt.pendingDecisionId,
        decisionId: loaded.attempt.decisionId,
      },
      event,
      scenarioRules(render),
    );
  } catch (e) {
    if (e instanceof TransitionError) {
      const status = e.code.startsWith("explanation") ? 400 : e.code.startsWith("unknown") ? 400 : 409;
      throw new ApiError(status, e.code, e.message);
    }
    throw e;
  }
  if (result.kind === "noop") return viewFor(loaded, displayName);

  const { data, error } = await writer().rpc("apply_attempt_event", {
    p_user_id: userId,
    p_attempt_id: attemptId,
    p_from_state: result.from,
    p_to_state: result.to,
    p_event_type: event.type,
    p_action_id: result.actionId ?? null,
    p_decision_id: result.decisionId ?? null,
    p_justification: result.justification ?? null,
  });
  if (error) throw attemptFunctionError(error);
  // The function returns the updated row; the new event is appended locally (no second read).
  return viewFor(
    {
      ...loaded,
      attempt: { ...toAttemptData(data as AttemptRow), isPractice: loaded.attempt.isPractice },
      events: [...loaded.events, { eventType: event.type, actionId: result.actionId ?? null }],
    },
    displayName,
  );
}
