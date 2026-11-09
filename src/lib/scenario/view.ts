/**
 * Builds the CLIENT-SAFE view of a scenario attempt (GET /api/attempts/[id] and the /play page). Pure.
 *
 * It is built from the render (environment content) and the attempt's own records only. It cannot include the answer
 * key, because nothing from the answer key is passed in (R10); `view.test.ts` also checks the serialized output.
 */
import { getModule, getScenarioSlot, type ScenarioKey } from "@/content/modules";
import { getScenarioRender } from "@/content/scenarios/renders";
import type { ScenarioRender } from "@/content/scenarios/schema";
import {
  EXPLANATION_MAX_CHARS,
  EXPLANATION_MIN_CHARS,
  LOCKED_STATES,
  type ScenarioState,
} from "@/lib/domain/scenarioStateMachine";
import { formatMoney } from "@/lib/domain/currency";
import { scenarioAmountMinor } from "@/lib/domain/trainingFunds";
import { buildTokenValues, fillDeep, firstNameFrom } from "./tokens";

export interface AttemptData {
  id: string;
  scenarioKey: ScenarioKey;
  attemptNumber: number;
  isPractice: boolean;
  state: ScenarioState;
  pendingDecisionId: string | null;
  decisionId: string | null;
  justification: string | null;
}

export interface AttemptEventData {
  eventType: string;
  actionId: string | null;
}

export interface ClientAttemptView {
  attemptId: string;
  scenarioKey: ScenarioKey;
  title: string;
  module: { key: string; title: string; order: number };
  attemptNumber: number;
  /** Replays are practice attempts: never official (PRODUCT_SPEC §4.3). */
  isPractice: boolean;
  state: ScenarioState;
  introLine: string;
  render: ScenarioRender;
  recordedActionIds: string[];
  pendingDecisionId: string | null;
  decisionId: string | null;
  /** The player's own locked explanation (only once locked). */
  justification: string | null;
  explanation: { minChars: number; maxChars: number };
  /** Present only while a pay decision's checkout is pending, cancelled, or completed. */
  checkout: {
    amountText: string;
    payee: string;
    description: string;
    checkoutSequence: number;
    /** Step 6: the Sandbox integration is not connected yet (Step 7). */
    integration: "pending";
  } | null;
}

export class ViewError extends Error {}

/** Recorded action IDs in order, each once (the event log is append-only and may contain repeats from old clients). */
export function recordedActions(events: readonly AttemptEventData[]): string[] {
  const out: string[] = [];
  for (const e of events)
    if (e.eventType === "RECORD_ACTION" && e.actionId && !out.includes(e.actionId)) out.push(e.actionId);
  return out;
}

export function checkoutSequence(events: readonly AttemptEventData[]): number {
  return 1 + events.filter((e) => e.eventType === "RETRY_PAYMENT").length;
}

export function buildClientView(input: {
  attempt: AttemptData;
  events: readonly AttemptEventData[];
  run: { currency: string; startingFundsMinor: number };
  displayName: string | null;
  /** Personalization slot values; Step 6 uses the authored defaults. */
  slots?: Record<string, string>;
}): ClientAttemptView {
  const { attempt, run } = input;
  const raw = getScenarioRender(attempt.scenarioKey);
  const slot = getScenarioSlot(attempt.scenarioKey);
  const mod = slot ? getModule(slot.moduleKey) : undefined;
  if (!raw || !slot || !mod) throw new ViewError(`Unknown scenario ${attempt.scenarioKey}`);

  const amountMinor = scenarioAmountMinor(attempt.scenarioKey, run.startingFundsMinor);
  const values = buildTokenValues(raw, {
    amountMinor,
    currency: run.currency,
    playerName: firstNameFrom(input.displayName),
    slots: input.slots ?? {},
  });
  const render = fillDeep(raw, values);
  const locked = (LOCKED_STATES as readonly string[]).includes(attempt.state);
  const decision = render.decisions.find((d) => d.id === attempt.decisionId);
  const inCheckout =
    decision?.kind === "pay" &&
    (attempt.state === "PAYMENT_PENDING" ||
      attempt.state === "PAYMENT_CANCELLED" ||
      attempt.state === "PAYMENT_COMPLETED");

  return {
    attemptId: attempt.id,
    scenarioKey: attempt.scenarioKey,
    title: slot.title,
    module: { key: mod.key, title: mod.title, order: mod.order },
    attemptNumber: attempt.attemptNumber,
    isPractice: attempt.isPractice,
    state: attempt.state,
    introLine: render.introLine,
    render,
    recordedActionIds: recordedActions(input.events),
    pendingDecisionId: attempt.state === "DECISION_SELECTED" ? attempt.pendingDecisionId : null,
    decisionId: attempt.decisionId,
    justification: locked ? attempt.justification : null,
    explanation: { minChars: EXPLANATION_MIN_CHARS, maxChars: EXPLANATION_MAX_CHARS },
    checkout:
      inCheckout && render.checkout
        ? {
            amountText: formatMoney(amountMinor, run.currency),
            payee: render.checkout.payee,
            description: render.checkout.description,
            checkoutSequence: checkoutSequence(input.events),
            integration: "pending",
          }
        : null,
  };
}
