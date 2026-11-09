/**
 * Scenario attempt state machine (Step 6). Pure and deterministic: the API routes call `transition()` to decide the
 * next state, and the database independently re-checks the same (from → to) pairs in a trigger
 * (supabase/migrations/20261110090000_scenario_engine.sql; `scenarioStateMachineMigration.test.ts` guards drift).
 *
 *   INTRO ─START→ ACTIVE ⇄ INVESTIGATING            (RECORD_ACTION: in-environment actions; an investigation action
 *                   │            │                    moves ACTIVE → INVESTIGATING and it stays there)
 *                   └─SELECT_DECISION→ DECISION_SELECTED ─CLEAR_DECISION→ back to ACTIVE / INVESTIGATING
 *                                        │
 *                                  CONFIRM_DECISION (decision locked, R11)
 *                                        ▼
 *                               EXPLANATION_REQUIRED
 *                                        │ SUBMIT_EXPLANATION (justification locked)
 *                     ┌──────────────────┴───────────────────┐
 *               pay decision                           any other decision
 *                     ▼                                      │
 *              PAYMENT_PENDING ─PAYMENT_CAPTURED→ PAYMENT_COMPLETED ─FINALIZE─┐
 *                │   ▲                                                      │
 *  PAYMENT_CANCELLED / PAYMENT_FAILED                                       │
 *                ▼   │ RETRY_PAYMENT                                        ▼
 *            PAYMENT_CANCELLED ─────────FINALIZE (finish without paying)──▶ FINALIZED
 *                                                                           │ FEEDBACK_READY   (Step 8)
 *                                                               FEEDBACK_AVAILABLE
 *                                                                           │ REVIEW_READY     (Step 9)
 *                                                               REVIEW_AVAILABLE
 *                                                                           │ RECOVERY_READY   (Step 9/10)
 *                                                               RECOVERY_AVAILABLE
 *                                                                           │ COMPLETE (complete_scenario_attempt)
 *                                                                       COMPLETED
 *
 * Rules enforced here:
 *   • The final decision is chosen through an environment-native action, confirmed, and then explained; the
 *     explanation is required before anything else happens, including a payment (Step 6 brief §8, §9).
 *   • A pay decision leads to PAYMENT_PENDING. Only a verified Sandbox capture (server event, Step 7) moves it to
 *     PAYMENT_COMPLETED. Cancelling never counts as paying, and nothing here can fake a successful payment.
 *   • Nothing about correctness is involved: this machine never needs the answer key (R10, R13).
 *   • Events are split by who may send them. The browser can only send CLIENT_EVENTS; the server-only events are
 *     reserved for the PayPal Sandbox payment service (Step 7: captured / failed / cancelled, recorded atomically
 *     with the payment) and the evaluation/results pipeline (Steps 8–9).
 */

export const SCENARIO_STATES = [
  "INTRO",
  "ACTIVE",
  "INVESTIGATING",
  "DECISION_SELECTED",
  "EXPLANATION_REQUIRED",
  "PAYMENT_PENDING",
  "PAYMENT_COMPLETED",
  "PAYMENT_CANCELLED",
  "FINALIZED",
  "FEEDBACK_AVAILABLE",
  "REVIEW_AVAILABLE",
  "RECOVERY_AVAILABLE",
  "COMPLETED",
] as const;
export type ScenarioState = (typeof SCENARIO_STATES)[number];

/** States in which the player is still exploring the environment (actions and decision selection allowed). */
export const EXPLORING_STATES: readonly ScenarioState[] = ["ACTIVE", "INVESTIGATING"];
/** States after the decision AND explanation are locked: the answer can no longer change (R11). */
export const LOCKED_STATES: readonly ScenarioState[] = [
  "PAYMENT_PENDING",
  "PAYMENT_COMPLETED",
  "PAYMENT_CANCELLED",
  "FINALIZED",
  "FEEDBACK_AVAILABLE",
  "REVIEW_AVAILABLE",
  "RECOVERY_AVAILABLE",
  "COMPLETED",
];
/** States reached once the attempt is finalized (evaluation may begin). */
export const FINALIZED_STATES: readonly ScenarioState[] = [
  "FINALIZED",
  "FEEDBACK_AVAILABLE",
  "REVIEW_AVAILABLE",
  "RECOVERY_AVAILABLE",
  "COMPLETED",
];

export const CLIENT_EVENT_TYPES = [
  "START",
  "RECORD_ACTION",
  "SELECT_DECISION",
  "CLEAR_DECISION",
  "CONFIRM_DECISION",
  "SUBMIT_EXPLANATION",
  "RETRY_PAYMENT",
  "FINALIZE",
] as const;
/**
 * Server-only events. Since Step 7, PAYMENT_CANCELLED is also server-only: a cancellation goes through the payment
 * service, which first confirms with PayPal that nothing was approved or captured.
 */
export const SERVER_EVENT_TYPES = [
  "PAYMENT_CANCELLED",
  "PAYMENT_CAPTURED",
  "PAYMENT_FAILED",
  "FEEDBACK_READY",
  "REVIEW_READY",
  "RECOVERY_READY",
  "COMPLETE",
] as const;
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];
export type ServerEventType = (typeof SERVER_EVENT_TYPES)[number];
export type ScenarioEventType = ClientEventType | ServerEventType;

export type ScenarioEvent =
  | { type: "START" }
  | { type: "RECORD_ACTION"; actionId: string }
  | { type: "SELECT_DECISION"; decisionId: string }
  | { type: "CLEAR_DECISION" }
  | { type: "CONFIRM_DECISION" }
  | { type: "SUBMIT_EXPLANATION"; text: string }
  | { type: "PAYMENT_CANCELLED" }
  | { type: "RETRY_PAYMENT" }
  | { type: "FINALIZE" }
  | { type: "PAYMENT_CAPTURED" }
  | { type: "PAYMENT_FAILED" }
  | { type: "FEEDBACK_READY" }
  | { type: "REVIEW_READY" }
  | { type: "RECOVERY_READY" }
  | { type: "COMPLETE" };

/** Every legal (from → to) pair. Mirrored in SQL; the trigger rejects anything else. */
export const STATE_TRANSITIONS: readonly (readonly [ScenarioState, ScenarioState])[] = [
  ["INTRO", "ACTIVE"],
  ["ACTIVE", "INVESTIGATING"],
  ["ACTIVE", "DECISION_SELECTED"],
  ["INVESTIGATING", "DECISION_SELECTED"],
  ["DECISION_SELECTED", "ACTIVE"],
  ["DECISION_SELECTED", "INVESTIGATING"],
  ["DECISION_SELECTED", "EXPLANATION_REQUIRED"],
  ["EXPLANATION_REQUIRED", "PAYMENT_PENDING"],
  ["EXPLANATION_REQUIRED", "FINALIZED"],
  ["PAYMENT_PENDING", "PAYMENT_COMPLETED"],
  ["PAYMENT_PENDING", "PAYMENT_CANCELLED"],
  ["PAYMENT_CANCELLED", "PAYMENT_PENDING"],
  ["PAYMENT_CANCELLED", "FINALIZED"],
  ["PAYMENT_COMPLETED", "FINALIZED"],
  ["FINALIZED", "FEEDBACK_AVAILABLE"],
  ["FEEDBACK_AVAILABLE", "REVIEW_AVAILABLE"],
  ["REVIEW_AVAILABLE", "RECOVERY_AVAILABLE"],
  ["RECOVERY_AVAILABLE", "COMPLETED"],
];

export function isLegalTransition(from: ScenarioState, to: ScenarioState): boolean {
  return STATE_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export const EXPLANATION_MIN_CHARS = 20;
export const EXPLANATION_MAX_CHARS = 1000;
/** Hard cap on recorded events per attempt (a browser can't flood the log). Mirrored in SQL. */
export const MAX_EVENTS_PER_ATTEMPT = 500;

/** The scenario facts the machine needs. All client-safe: no answer key, no correctness (R10). */
export interface ScenarioRules {
  actions: readonly { id: string; kind: "investigate" | "interact"; requires?: readonly string[] }[];
  decisions: readonly { id: string; kind: "pay" | "other"; requires?: readonly string[] }[];
}

export interface AttemptSnapshot {
  state: ScenarioState;
  /** Action IDs already recorded for this attempt, in order (each at most once). */
  recordedActionIds: readonly string[];
  /** The decision chosen but not yet confirmed (DECISION_SELECTED only). */
  pendingDecisionId: string | null;
  /** The confirmed, locked decision. */
  decisionId: string | null;
}

/** What the server must persist for an accepted event. `noop` means nothing changes (idempotent repeat). */
export type TransitionResult =
  | { kind: "noop" }
  | {
      kind: "apply";
      from: ScenarioState;
      to: ScenarioState;
      actionId?: string;
      decisionId?: string;
      justification?: string;
    };

export type TransitionErrorCode =
  | "invalid_transition"
  | "unknown_action"
  | "action_unavailable"
  | "unknown_decision"
  | "decision_unavailable"
  | "explanation_too_short"
  | "explanation_too_long";

export class TransitionError extends Error {
  constructor(
    public readonly code: TransitionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

const requirementsMet = (requires: readonly string[] | undefined, recorded: readonly string[]) =>
  (requires ?? []).every((id) => recorded.includes(id));

function exploringStateFor(rules: ScenarioRules, recorded: readonly string[]): ScenarioState {
  const investigated = recorded.some((id) => rules.actions.find((a) => a.id === id)?.kind === "investigate");
  return investigated ? "INVESTIGATING" : "ACTIVE";
}

function illegal(state: ScenarioState, type: ScenarioEventType): never {
  throw new TransitionError("invalid_transition", `${type} is not allowed while the attempt is ${state}`);
}

/** Normalizes an explanation the same way everywhere (trimmed; inner whitespace kept). */
export function normalizeExplanation(text: string): string {
  return text.trim();
}

export function validateExplanation(text: string): string {
  const t = normalizeExplanation(text);
  if (t.length < EXPLANATION_MIN_CHARS) {
    throw new TransitionError(
      "explanation_too_short",
      `Write at least ${EXPLANATION_MIN_CHARS} characters so your reasoning can be reviewed.`,
    );
  }
  if (t.length > EXPLANATION_MAX_CHARS) {
    throw new TransitionError("explanation_too_long", `Keep it under ${EXPLANATION_MAX_CHARS} characters.`);
  }
  return t;
}

/**
 * Decides what an event does to an attempt. Throws `TransitionError` for anything illegal; never mutates input.
 */
export function transition(
  snapshot: AttemptSnapshot,
  event: ScenarioEvent,
  rules: ScenarioRules,
): TransitionResult {
  const { state, recordedActionIds: recorded } = snapshot;
  const exploring = (EXPLORING_STATES as readonly string[]).includes(state);

  switch (event.type) {
    case "START":
      if (state === "INTRO") return { kind: "apply", from: state, to: "ACTIVE" };
      // Starting again after the intro is harmless (e.g. a second tab): nothing changes.
      if (exploring) return { kind: "noop" };
      return illegal(state, event.type);

    case "RECORD_ACTION": {
      if (!exploring) return illegal(state, event.type);
      const action = rules.actions.find((a) => a.id === event.actionId);
      if (!action) throw new TransitionError("unknown_action", "That action isn't part of this scenario.");
      if (recorded.includes(action.id)) return { kind: "noop" };
      if (!requirementsMet(action.requires, recorded)) {
        throw new TransitionError("action_unavailable", "That action isn't available yet.");
      }
      const to = action.kind === "investigate" ? "INVESTIGATING" : state;
      return { kind: "apply", from: state, to, actionId: action.id };
    }

    case "SELECT_DECISION": {
      if (!exploring) return illegal(state, event.type);
      const decision = rules.decisions.find((d) => d.id === event.decisionId);
      if (!decision)
        throw new TransitionError("unknown_decision", "That decision isn't part of this scenario.");
      if (!requirementsMet(decision.requires, recorded)) {
        throw new TransitionError("decision_unavailable", "That option isn't available yet.");
      }
      return { kind: "apply", from: state, to: "DECISION_SELECTED", decisionId: decision.id };
    }

    case "CLEAR_DECISION":
      if (state !== "DECISION_SELECTED") return illegal(state, event.type);
      return { kind: "apply", from: state, to: exploringStateFor(rules, recorded) };

    case "CONFIRM_DECISION":
      if (state !== "DECISION_SELECTED" || !snapshot.pendingDecisionId) return illegal(state, event.type);
      return {
        kind: "apply",
        from: state,
        to: "EXPLANATION_REQUIRED",
        decisionId: snapshot.pendingDecisionId,
      };

    case "SUBMIT_EXPLANATION": {
      if (state !== "EXPLANATION_REQUIRED" || !snapshot.decisionId) return illegal(state, event.type);
      const justification = validateExplanation(event.text);
      const decision = rules.decisions.find((d) => d.id === snapshot.decisionId);
      if (!decision)
        throw new TransitionError("unknown_decision", "That decision isn't part of this scenario.");
      return {
        kind: "apply",
        from: state,
        to: decision.kind === "pay" ? "PAYMENT_PENDING" : "FINALIZED",
        justification,
      };
    }

    case "PAYMENT_CAPTURED":
      if (state !== "PAYMENT_PENDING") return illegal(state, event.type);
      return { kind: "apply", from: state, to: "PAYMENT_COMPLETED" };

    case "PAYMENT_CANCELLED":
    case "PAYMENT_FAILED":
      if (state !== "PAYMENT_PENDING") return illegal(state, event.type);
      return { kind: "apply", from: state, to: "PAYMENT_CANCELLED" };

    case "RETRY_PAYMENT":
      if (state !== "PAYMENT_CANCELLED") return illegal(state, event.type);
      return { kind: "apply", from: state, to: "PAYMENT_PENDING" };

    case "FINALIZE":
      if (state !== "PAYMENT_CANCELLED" && state !== "PAYMENT_COMPLETED") return illegal(state, event.type);
      return { kind: "apply", from: state, to: "FINALIZED" };

    case "FEEDBACK_READY":
      if (state !== "FINALIZED") return illegal(state, event.type);
      return { kind: "apply", from: state, to: "FEEDBACK_AVAILABLE" };

    case "REVIEW_READY":
      if (state !== "FEEDBACK_AVAILABLE") return illegal(state, event.type);
      return { kind: "apply", from: state, to: "REVIEW_AVAILABLE" };

    case "RECOVERY_READY":
      if (state !== "REVIEW_AVAILABLE") return illegal(state, event.type);
      return { kind: "apply", from: state, to: "RECOVERY_AVAILABLE" };

    case "COMPLETE":
      if (state !== "RECOVERY_AVAILABLE") return illegal(state, event.type);
      return { kind: "apply", from: state, to: "COMPLETED" };
  }
}

/** Whether a decision/action with `requires` is currently available (shared by the UI and the server). */
export function isAvailable(requires: readonly string[] | undefined, recorded: readonly string[]): boolean {
  return requirementsMet(requires, recorded);
}
