import { describe, expect, it } from "vitest";
import { SCENARIO_KEYS, type ScenarioKey } from "@/content/modules";
import { SCENARIO_TEMPLATES } from "@/content/scenarios/templates.server";
import type { ScenarioState } from "@/lib/domain/scenarioStateMachine";
import { scenarioAmountMinor } from "@/lib/domain/trainingFunds";
import { buildClientView, type AttemptData, type AttemptPaymentData } from "./view";
import { firstNameFrom, shareOfMinor } from "./tokens";

const run = { currency: "USD", startingFundsMinor: 300_000 };
const attempt = (scenarioKey: ScenarioKey, over: Partial<AttemptData> = {}): AttemptData => ({
  id: "11111111-1111-4111-8111-111111111111",
  scenarioKey,
  attemptNumber: 1,
  isPractice: false,
  state: "ACTIVE",
  pendingDecisionId: null,
  decisionId: null,
  justification: null,
  ...over,
});
const view = (a: AttemptData, events: { eventType: string; actionId: string | null }[] = []) =>
  buildClientView({ attempt: a, events, run, displayName: "Alex Rivera" });

describe("client attempt view", () => {
  it("can be built for all six scenarios with every token filled", () => {
    for (const key of SCENARIO_KEYS) {
      const json = JSON.stringify(view(attempt(key)));
      expect(json, key).not.toMatch(/\{\{/);
      expect(json).toContain("Alex");
      expect(json).not.toContain("Rivera"); // first name only
    }
  });

  it("never contains the answer key in any state (R10)", () => {
    const states: ScenarioState[] = [
      "INTRO",
      "ACTIVE",
      "DECISION_SELECTED",
      "EXPLANATION_REQUIRED",
      "PAYMENT_PENDING",
      "FINALIZED",
    ];
    for (const key of SCENARIO_KEYS) {
      const t = SCENARIO_TEMPLATES[key];
      const secrets = [
        ...t.evidenceDefinitions.flatMap((e) => [e.explanation, e.title, e.evidenceId]),
        ...t.fixedCorrectDecisionRules.flatMap((r) => [r.ruleId, r.description]),
        ...Object.values(t.fallbackContent.outcomeByDecision),
        t.fallbackContent.feedbackCorrect,
        t.fallbackContent.safestNextStep,
        ...t.learningObjectives,
      ].filter((s) => s.length > 12);
      for (const state of states) {
        const json = JSON.stringify(
          view(
            attempt(key, {
              state,
              decisionId: state === "INTRO" || state === "ACTIVE" ? null : t.decisionOptions[0]!,
              pendingDecisionId: state === "DECISION_SELECTED" ? t.decisionOptions[0]! : null,
            }),
          ),
        );
        for (const word of [
          "legitimate",
          "fraudulent",
          "red_flag",
          "worth_verifying",
          "positive_verification",
          "correctDecision",
          "unsafe",
          "weight",
          "keywords",
          "evidence",
        ]) {
          expect(json, `${key}/${state}: ${word}`).not.toContain(word);
        }
        for (const s of secrets) expect(json, `${key}/${state}: ${s.slice(0, 40)}`).not.toContain(s);
      }
    }
  });

  it("computes the scenario amount on the server from the module run (R19, R38)", () => {
    const v = view(attempt("m2-s2"));
    const amount = scenarioAmountMinor("m2-s2", run.startingFundsMinor);
    expect(amount).toBe(36_000);
    expect(JSON.stringify(v.render)).toContain("$360.00");
    // Invoice lines always add up to the total exactly.
    const upgrade = shareOfMinor(scenarioAmountMinor("m2-s1", run.startingFundsMinor), 7_200);
    const invoice = JSON.stringify(view(attempt("m2-s1")).render);
    expect(invoice).toContain(`$${(upgrade / 100).toFixed(2)}`);
    expect(invoice).toContain(`$${((30_000 - upgrade) / 100).toFixed(2)}`);
    expect(invoice).toContain("$300.00");
  });

  it("reports recorded actions in order, once each, and the checkout sequence", () => {
    const v = view(
      attempt("m2-s2", {
        state: "PAYMENT_PENDING",
        decisionId: "place_order",
        justification: "x".repeat(25),
      }),
      [
        { eventType: "START", actionId: null },
        { eventType: "RECORD_ACTION", actionId: "view_product" },
        { eventType: "RECORD_ACTION", actionId: "read_reviews" },
        { eventType: "RECORD_ACTION", actionId: "view_product" },
        { eventType: "PAYMENT_CANCELLED", actionId: null },
        { eventType: "RETRY_PAYMENT", actionId: null },
      ],
    );
    expect(v.recordedActionIds).toEqual(["view_product", "read_reviews"]);
    expect(v.checkout).toMatchObject({ amountText: "$360.00", checkoutSequence: 2, currency: "USD" });
  });

  it("shows checkout details only for a pay decision in a payment state", () => {
    expect(view(attempt("m2-s2")).checkout).toBeNull();
    expect(
      view(
        attempt("m2-s1", { state: "FINALIZED", decisionId: "report_invoice", justification: "x".repeat(25) }),
      ).checkout,
    ).toBeNull();
    expect(
      view(
        attempt("m2-s1", {
          state: "PAYMENT_CANCELLED",
          decisionId: "pay_invoice",
          justification: "x".repeat(25),
        }),
      ).checkout,
    ).not.toBeNull();
  });

  it("returns the player's own justification only once it is locked, and labels practice attempts", () => {
    const text = "Because the sender address did not match my bank.";
    expect(
      view(
        attempt("m1-s2", { state: "EXPLANATION_REQUIRED", decisionId: "report_email", justification: null }),
      ).justification,
    ).toBeNull();
    const locked = view(
      attempt("m1-s2", {
        state: "FINALIZED",
        decisionId: "report_email",
        justification: text,
        isPractice: true,
        attemptNumber: 2,
      }),
    );
    expect(locked.justification).toBe(text);
    expect(locked).toMatchObject({ isPractice: true, attemptNumber: 2 });
  });

  it("uses a safe first name", () => {
    expect(firstNameFrom("  Sam   Lee ")).toBe("Sam");
    expect(firstNameFrom("{{amount}}")).toBe("amount");
    expect(firstNameFrom("")).toBe("there");
  });

  it("reports the open order, the last closed checkout, and a verified payment — never its scam/legit meaning", () => {
    const pay = (over: Partial<AttemptPaymentData>): AttemptPaymentData => ({
      id: "p1",
      requestId: "scamsense-x-checkout-1",
      orderId: "ORDER1",
      checkoutSequence: 1,
      status: "CREATED",
      amountMinor: 36_000,
      currency: "USD",
      captureId: null,
      capturedAt: null,
      failureCode: null,
      ...over,
    });
    const locked = { decisionId: "place_order", justification: "x".repeat(25) };
    const build = (state: ScenarioState, payments: AttemptPaymentData[], available = true) =>
      buildClientView({
        attempt: attempt("m2-s2", { state, ...locked }),
        events: [],
        run,
        displayName: "Alex",
        payments,
        paymentsAvailable: available,
      });

    const open = build("PAYMENT_PENDING", [pay({})]);
    expect(open.checkout).toMatchObject({
      available: true,
      openOrder: { orderId: "ORDER1", status: "CREATED" },
    });
    expect(open.payment).toBeNull();
    expect(build("PAYMENT_PENDING", [], false).checkout).toMatchObject({ available: false, openOrder: null });
    expect(build("PAYMENT_CANCELLED", [pay({ status: "FAILED" })]).checkout?.lastClosed).toBe("FAILED");

    const paid = build("FINALIZED", [
      pay({ status: "CANCELLED" }),
      pay({
        id: "p2",
        orderId: "ORDER2",
        status: "CAPTURED",
        captureId: "CAP2",
        capturedAt: "2026-11-11T10:00:00Z",
      }),
    ]);
    expect(paid.checkout).toBeNull();
    expect(paid.payment).toEqual({
      amountText: "$360.00",
      orderId: "ORDER2",
      captureId: "CAP2",
      capturedAt: "2026-11-11T10:00:00Z",
    });
    const json = JSON.stringify(paid);
    for (const secret of ["spending", "fraud_loss", "fraudulent", "legitimate"])
      expect(json).not.toContain(secret);
  });
});
