import { describe, expect, it } from "vitest";
import {
  CLIENT_EVENT_TYPES,
  isLegalTransition,
  SCENARIO_STATES,
  STATE_TRANSITIONS,
  transition,
  TransitionError,
  type AttemptSnapshot,
  type ScenarioEvent,
  type ScenarioRules,
  type ScenarioState,
} from "./scenarioStateMachine";

const rules: ScenarioRules = {
  actions: [
    { id: "check_sender", kind: "investigate" },
    { id: "reply", kind: "interact" },
    { id: "ask_more", kind: "investigate", requires: ["reply"] },
  ],
  decisions: [
    { id: "pay_now", kind: "pay", requires: ["reply"] },
    { id: "report", kind: "other" },
  ],
};

const snap = (state: ScenarioState, over: Partial<AttemptSnapshot> = {}): AttemptSnapshot => ({
  state,
  recordedActionIds: [],
  pendingDecisionId: null,
  decisionId: null,
  ...over,
});

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof TransitionError ? e.code : "other";
  }
  return "none";
};

const LONG = "I checked the sender and the details before deciding.";

describe("scenario state machine", () => {
  it("has the thirteen Step 6 states and only transitions between known states", () => {
    expect(SCENARIO_STATES).toHaveLength(13);
    for (const [f, t] of STATE_TRANSITIONS) {
      expect(SCENARIO_STATES).toContain(f);
      expect(SCENARIO_STATES).toContain(t);
    }
    expect(isLegalTransition("INTRO", "COMPLETED")).toBe(false);
    expect(isLegalTransition("ACTIVE", "FINALIZED")).toBe(false);
    expect(isLegalTransition("ACTIVE", "PAYMENT_PENDING")).toBe(false);
  });

  it("starts from the intro, and START again is a harmless no-op", () => {
    expect(transition(snap("INTRO"), { type: "START" }, rules)).toMatchObject({ to: "ACTIVE" });
    expect(transition(snap("ACTIVE"), { type: "START" }, rules)).toEqual({ kind: "noop" });
    expect(code(() => transition(snap("FINALIZED"), { type: "START" }, rules))).toBe("invalid_transition");
  });

  it("records actions once; investigation moves to INVESTIGATING; interaction keeps the state", () => {
    expect(transition(snap("ACTIVE"), { type: "RECORD_ACTION", actionId: "reply" }, rules)).toMatchObject({
      to: "ACTIVE",
      actionId: "reply",
    });
    expect(
      transition(snap("ACTIVE"), { type: "RECORD_ACTION", actionId: "check_sender" }, rules),
    ).toMatchObject({
      to: "INVESTIGATING",
    });
    const repeat = transition(
      snap("INVESTIGATING", { recordedActionIds: ["check_sender"] }),
      { type: "RECORD_ACTION", actionId: "check_sender" },
      rules,
    );
    expect(repeat).toEqual({ kind: "noop" });
  });

  it("enforces controlled branching (requires) and rejects unknown actions", () => {
    expect(
      code(() => transition(snap("ACTIVE"), { type: "RECORD_ACTION", actionId: "ask_more" }, rules)),
    ).toBe("action_unavailable");
    expect(code(() => transition(snap("ACTIVE"), { type: "RECORD_ACTION", actionId: "nope" }, rules))).toBe(
      "unknown_action",
    );
    expect(code(() => transition(snap("INTRO"), { type: "RECORD_ACTION", actionId: "reply" }, rules))).toBe(
      "invalid_transition",
    );
  });

  it("selecting a decision is not final: it can be cleared back to the right exploring state", () => {
    expect(
      transition(snap("ACTIVE"), { type: "SELECT_DECISION", decisionId: "report" }, rules),
    ).toMatchObject({
      to: "DECISION_SELECTED",
      decisionId: "report",
    });
    expect(
      code(() => transition(snap("ACTIVE"), { type: "SELECT_DECISION", decisionId: "pay_now" }, rules)),
    ).toBe("decision_unavailable");
    expect(transition(snap("DECISION_SELECTED"), { type: "CLEAR_DECISION" }, rules)).toMatchObject({
      to: "ACTIVE",
    });
    expect(
      transition(
        snap("DECISION_SELECTED", { recordedActionIds: ["check_sender"] }),
        { type: "CLEAR_DECISION" },
        rules,
      ),
    ).toMatchObject({ to: "INVESTIGATING" });
  });

  it("confirming locks the decision and requires an explanation before anything else", () => {
    const confirmed = transition(
      snap("DECISION_SELECTED", { pendingDecisionId: "report" }),
      { type: "CONFIRM_DECISION" },
      rules,
    );
    expect(confirmed).toMatchObject({ to: "EXPLANATION_REQUIRED", decisionId: "report" });
    // Bypass attempts: no finalize, payment, or new decision while the explanation is missing.
    const waiting = snap("EXPLANATION_REQUIRED", { decisionId: "report" });
    for (const e of [
      { type: "FINALIZE" },
      { type: "PAYMENT_CANCELLED" },
      { type: "PAYMENT_CAPTURED" },
      { type: "SELECT_DECISION", decisionId: "pay_now" },
      { type: "CLEAR_DECISION" },
      { type: "RECORD_ACTION", actionId: "reply" },
    ] as ScenarioEvent[]) {
      expect(
        code(() => transition(waiting, e, rules)),
        e.type,
      ).toBe("invalid_transition");
    }
  });

  it("validates explanation length (trimmed, 20–1000)", () => {
    const waiting = snap("EXPLANATION_REQUIRED", { decisionId: "report" });
    expect(
      code(() => transition(waiting, { type: "SUBMIT_EXPLANATION", text: "   too short   " }, rules)),
    ).toBe("explanation_too_short");
    expect(
      code(() => transition(waiting, { type: "SUBMIT_EXPLANATION", text: "x".repeat(1001) }, rules)),
    ).toBe("explanation_too_long");
    expect(transition(waiting, { type: "SUBMIT_EXPLANATION", text: `  ${LONG}  ` }, rules)).toMatchObject({
      to: "FINALIZED",
      justification: LONG,
    });
  });

  it("a pay decision goes to PAYMENT_PENDING after the explanation, never straight to completed", () => {
    const waiting = snap("EXPLANATION_REQUIRED", { decisionId: "pay_now" });
    expect(transition(waiting, { type: "SUBMIT_EXPLANATION", text: LONG }, rules)).toMatchObject({
      to: "PAYMENT_PENDING",
    });
  });

  it("cancelled or failed checkouts never count as paid; retry and finish-without-paying are explicit", () => {
    const pending = snap("PAYMENT_PENDING", { decisionId: "pay_now" });
    expect(transition(pending, { type: "PAYMENT_CANCELLED" }, rules)).toMatchObject({
      to: "PAYMENT_CANCELLED",
    });
    expect(transition(pending, { type: "PAYMENT_FAILED" }, rules)).toMatchObject({ to: "PAYMENT_CANCELLED" });
    expect(code(() => transition(pending, { type: "FINALIZE" }, rules))).toBe("invalid_transition");
    const cancelled = snap("PAYMENT_CANCELLED", { decisionId: "pay_now" });
    expect(transition(cancelled, { type: "RETRY_PAYMENT" }, rules)).toMatchObject({ to: "PAYMENT_PENDING" });
    expect(transition(cancelled, { type: "FINALIZE" }, rules)).toMatchObject({ to: "FINALIZED" });
    expect(code(() => transition(cancelled, { type: "PAYMENT_CAPTURED" }, rules))).toBe("invalid_transition");
    expect(transition(pending, { type: "PAYMENT_CAPTURED" }, rules)).toMatchObject({
      to: "PAYMENT_COMPLETED",
    });
    expect(
      transition(snap("PAYMENT_COMPLETED", { decisionId: "pay_now" }), { type: "FINALIZE" }, rules),
    ).toMatchObject({ to: "FINALIZED" });
  });

  it("the results pipeline is strictly ordered and COMPLETED is terminal", () => {
    const order: [ScenarioState, ScenarioEvent["type"], ScenarioState][] = [
      ["FINALIZED", "FEEDBACK_READY", "FEEDBACK_AVAILABLE"],
      ["FEEDBACK_AVAILABLE", "REVIEW_READY", "REVIEW_AVAILABLE"],
      ["REVIEW_AVAILABLE", "RECOVERY_READY", "RECOVERY_AVAILABLE"],
      ["RECOVERY_AVAILABLE", "COMPLETE", "COMPLETED"],
    ];
    for (const [from, type, to] of order) {
      expect(
        transition(snap(from, { decisionId: "report" }), { type } as ScenarioEvent, rules),
      ).toMatchObject({ to });
    }
    expect(code(() => transition(snap("FINALIZED"), { type: "COMPLETE" }, rules))).toBe("invalid_transition");
    for (const type of CLIENT_EVENT_TYPES) {
      const e = { type, actionId: "reply", decisionId: "report", text: LONG } as ScenarioEvent;
      expect(
        code(() => transition(snap("COMPLETED", { decisionId: "report" }), e, rules)),
        type,
      ).toBe("invalid_transition");
    }
  });

  it("every transition the reducer can produce is in the legal list (mirrored in SQL)", () => {
    const produced = new Set<string>();
    const events: ScenarioEvent[] = [
      { type: "START" },
      { type: "RECORD_ACTION", actionId: "check_sender" },
      { type: "RECORD_ACTION", actionId: "reply" },
      { type: "SELECT_DECISION", decisionId: "report" },
      { type: "CLEAR_DECISION" },
      { type: "CONFIRM_DECISION" },
      { type: "SUBMIT_EXPLANATION", text: LONG },
      { type: "PAYMENT_CANCELLED" },
      { type: "PAYMENT_FAILED" },
      { type: "PAYMENT_CAPTURED" },
      { type: "RETRY_PAYMENT" },
      { type: "FINALIZE" },
      { type: "FEEDBACK_READY" },
      { type: "REVIEW_READY" },
      { type: "RECOVERY_READY" },
      { type: "COMPLETE" },
    ];
    for (const state of SCENARIO_STATES) {
      for (const [decisionId, recordedActionIds] of [
        ["report", ["reply"]],
        ["pay_now", ["reply"]],
        ["report", ["reply", "check_sender"]],
      ] as const) {
        for (const e of events) {
          try {
            const r = transition(
              snap(state, { pendingDecisionId: decisionId, decisionId, recordedActionIds }),
              e,
              rules,
            );
            if (r.kind === "apply" && r.from !== r.to) produced.add(`${r.from}>${r.to}`);
          } catch {
            /* illegal: fine */
          }
        }
      }
    }
    const legal = new Set(STATE_TRANSITIONS.map(([f, t]) => `${f}>${t}`));
    expect([...produced].sort()).toEqual([...legal].sort());
  });
});
