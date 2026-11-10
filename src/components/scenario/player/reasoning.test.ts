/**
 * Split-screen reasoning step: the scenario shown beside the explanation form is strictly read-only, on the client
 * (the read-only sim API never records, decides, or talks to the server) and on the server (in EXPLANATION_REQUIRED
 * the state machine accepts nothing but SUBMIT_EXPLANATION, and checkout can't start).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  transition,
  TransitionError,
  type AttemptSnapshot,
  type ScenarioEvent,
  type ScenarioRules,
} from "@/lib/domain/scenarioStateMachine";
import { buildCheckoutRequest, CheckoutError } from "@/lib/payments/checkout";
import { getScenarioRender } from "@/content/scenarios/renders";
import { readOnlySim } from "./ReasoningWorkspace";

const rules: ScenarioRules = {
  actions: [
    { id: "check_sender", kind: "investigate" },
    { id: "reply", kind: "interact" },
  ],
  decisions: [
    { id: "pay_now", kind: "pay" },
    { id: "report", kind: "other" },
  ],
};

const waiting: AttemptSnapshot = {
  state: "EXPLANATION_REQUIRED",
  recordedActionIds: ["reply"],
  pendingDecisionId: null,
  decisionId: "pay_now",
};

describe("server: nothing but the explanation is accepted while reasoning", () => {
  const gameplay: ScenarioEvent[] = [
    { type: "START" },
    { type: "RECORD_ACTION", actionId: "check_sender" },
    { type: "RECORD_ACTION", actionId: "reply" },
    { type: "SELECT_DECISION", decisionId: "report" },
    { type: "CLEAR_DECISION" },
    { type: "CONFIRM_DECISION" },
    { type: "PAYMENT_CAPTURED" },
    { type: "PAYMENT_CANCELLED" },
    { type: "PAYMENT_FAILED" },
    { type: "RETRY_PAYMENT" },
    { type: "FINALIZE" },
  ];

  it.each(gameplay.map((e) => [e.type, e] as const))("rejects %s", (_t, event) => {
    expect(() => transition(waiting, event, rules)).toThrow(TransitionError);
  });

  it("still accepts the explanation itself", () => {
    const r = transition(
      waiting,
      { type: "SUBMIT_EXPLANATION", text: "The sender wasn't saved and the link looked wrong." },
      rules,
    );
    expect(r).toMatchObject({ kind: "apply", to: "PAYMENT_PENDING" });
  });

  it("can't create a PayPal Sandbox order before the explanation is submitted", () => {
    expect(() =>
      buildCheckoutRequest({
        attempt: {
          id: "a",
          scenarioKey: "m2-s1",
          state: "EXPLANATION_REQUIRED",
          isPractice: false,
          decisionId: "pay_now",
        },
        run: { currency: "USD", startingFundsMinor: 300_000 },
        payableDecisionIds: ["pay_now"],
        display: { payee: "x", description: "y" },
        checkoutSequence: 1,
      } as Parameters<typeof buildCheckoutRequest>[0]),
    ).toThrow(CheckoutError);
  });
});

describe("client: the read-only scenario", () => {
  const render = getScenarioRender("m1-s1")!;
  const view = { recordedActionIds: ["check_sender_details"], render };

  it("never records, decides, or is interactive, and marks no evidence", () => {
    const openApp = vi.fn();
    const sim = readOnlySim(view, openApp);
    expect(sim.readOnly).toBe(true);
    expect(sim.interactive).toBe(false);
    expect(sim.reveal).toBeNull();
    expect(sim.navRequest).toBeNull();
    expect(sim.record("send_code")).toBeUndefined();
    expect(sim.decide("block_report")).toBeUndefined();
    sim.openApp("messages"); // navigation is allowed and stays local
    expect(openApp).toHaveBeenCalledWith("messages");
  });

  it("shows exactly what the learner had unlocked (their own recorded actions, not the review's full set)", () => {
    const sim = readOnlySim(view, () => {});
    expect(sim.recorded).toEqual(["check_sender_details"]);
    expect(sim.decisions).toBe(render.decisions); // the same (personalized) render instance, not regenerated
  });

  it("contains no network calls, answer-key data, or Gemini/PayPal code", () => {
    const src = readFileSync("src/components/scenario/player/ReasoningWorkspace.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, ""); // code only, not comments
    expect(src).not.toMatch(/apiRequest|fetch\(|\/api\/|answerKey|evidence|gemini|paypal/i);
    const player = readFileSync("src/components/scenario/player/ScenarioPlayer.tsx", "utf8");
    // The live sim (with `record`/`decide`) is only mounted while exploring; the reasoning step gets the read-only one.
    expect(player).toMatch(/<ReasoningWorkspace view=\{view\}>/);
  });
});
