import { describe, expect, it } from "vitest";
import {
  buildCheckoutRequest,
  checkoutIdempotencyKey,
  eventForCapture,
  getPaymentGateway,
  pendingIntegrationGateway,
  verifyCapture,
  walletEffectFor,
  type CaptureResult,
  type CheckoutAttempt,
} from "./checkout";

const run = { currency: "USD", startingFundsMinor: 300_000 };
const scored: CheckoutAttempt = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  scenarioKey: "m2-s2",
  state: "PAYMENT_PENDING",
  isPractice: false,
  decisionId: "place_order",
};
const replay: CheckoutAttempt = { ...scored, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", isPractice: true };
const display = { payee: "Circuitry Market", description: "Aster 14 Laptop" };
const req = (a: CheckoutAttempt, seq = 1) =>
  buildCheckoutRequest({
    attempt: a,
    run,
    payableDecisionIds: ["place_order"],
    display,
    checkoutSequence: seq,
  });

describe("PayPal Sandbox integration boundary", () => {
  it("computes the amount and currency from the module run, never from the client (R19, R32)", () => {
    expect(req(scored)).toMatchObject({ amountMinor: 36_000, currency: "USD", decisionId: "place_order" });
  });

  it("refuses non-payable decisions and non-pending states", () => {
    expect(() => req({ ...scored, decisionId: "skip_purchase" })).toThrow(/doesn't involve a payment/);
    expect(() => req({ ...scored, state: "EXPLANATION_REQUIRED" })).toThrow(/pending/);
    expect(() => req({ ...scored, state: "PAYMENT_CANCELLED" })).toThrow(/pending/);
  });

  it("retries of the same checkout share an idempotency key; a new checkout or a replay never does", () => {
    expect(req(scored).idempotencyKey).toBe(req(scored).idempotencyKey);
    expect(req(scored, 2).idempotencyKey).not.toBe(req(scored, 1).idempotencyKey);
    expect(req(replay).idempotencyKey).not.toBe(req(scored).idempotencyKey);
    expect(checkoutIdempotencyKey(scored.id, 1).length).toBeLessThanOrEqual(200);
    expect(() => checkoutIdempotencyKey(scored.id, 0)).toThrow();
  });

  it("only a COMPLETED capture of exactly the requested amount and currency counts as paid", () => {
    const r = req(scored);
    const ok: CaptureResult = {
      orderId: "O1",
      captureId: "C1",
      status: "COMPLETED",
      amountMinor: 36_000,
      currency: "USD",
    };
    expect(verifyCapture(r, ok)).toBe(true);
    expect(eventForCapture(r, ok)).toBe("PAYMENT_CAPTURED");
    for (const bad of [
      { ...ok, status: "PENDING" as const },
      { ...ok, status: "DECLINED" as const },
      { ...ok, amountMinor: 35_999 },
      { ...ok, currency: "EUR" },
      { ...ok, captureId: null },
    ]) {
      expect(eventForCapture(r, bad)).toBe("PAYMENT_FAILED");
    }
  });

  it("debits the official ledger for the scored attempt only; practice replays never touch it", () => {
    expect(walletEffectFor(req(scored))).toEqual({
      kind: "ledger_debit",
      amountMinor: 36_000,
      idempotencyKey: req(scored).idempotencyKey,
    });
    expect(walletEffectFor(req(replay))).toEqual({ kind: "practice_only" });
  });

  it("the Step 6 gateway never reports a successful payment", async () => {
    expect(getPaymentGateway()).toBe(pendingIntegrationGateway);
    const r = req(scored);
    expect(await pendingIntegrationGateway.createOrder(r)).toEqual({
      ok: false,
      reason: "integration_pending",
    });
    expect(await pendingIntegrationGateway.captureOrder("O1", r)).toEqual({
      ok: false,
      reason: "integration_pending",
    });
    expect(await pendingIntegrationGateway.getOrderStatus("O1")).toEqual({
      ok: false,
      reason: "integration_pending",
    });
  });
});
