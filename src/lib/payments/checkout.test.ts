import { describe, expect, it } from "vitest";
import {
  buildCheckoutRequest,
  buildOrderBody,
  captureRequestId,
  checkoutIdempotencyKey,
  decideSettlement,
  fromPayPalValue,
  parseOrder,
  PAYPAL_SANDBOX_SDK_URL,
  toPayPalValue,
  verifyCapture,
  walletEffectFor,
  type CheckoutAttempt,
  type OrderSnapshot,
  type StoredOrder,
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
const req = (a: CheckoutAttempt, seq = 1, r = run) =>
  buildCheckoutRequest({
    attempt: a,
    run: r,
    payableDecisionIds: ["place_order"],
    display,
    checkoutSequence: seq,
  });

/** Orders v2 responses as PayPal Sandbox returns them (trimmed). */
const orderJson = (
  status: string,
  capture?: { id: string; status: string; value?: string; currency?: string },
) => ({
  id: "5O190127TN364715T",
  status,
  purchase_units: [
    {
      reference_id: "m2-s2",
      custom_id: scored.id,
      amount: { currency_code: "USD", value: "360.00" },
      ...(capture
        ? {
            payments: {
              captures: [
                {
                  id: capture.id,
                  status: capture.status,
                  amount: { currency_code: capture.currency ?? "USD", value: capture.value ?? "360.00" },
                },
              ],
            },
          }
        : {}),
    },
  ],
});
const snap = (raw: unknown) => parseOrder(raw) as OrderSnapshot;
const stored: StoredOrder = {
  attemptId: scored.id,
  orderId: "5O190127TN364715T",
  amountMinor: 36_000,
  currency: "USD",
};

describe("checkout request (server-computed, R19, R32)", () => {
  it("computes the amount and currency from the module run, never from the client", () => {
    expect(req(scored)).toMatchObject({ amountMinor: 36_000, currency: "USD", decisionId: "place_order" });
    expect(req({ ...scored, scenarioKey: "m2-s1", decisionId: "place_order" }).amountMinor).toBe(30_000);
  });

  it("refuses non-payable decisions, non-pending states, and unverified currencies", () => {
    expect(() => req({ ...scored, decisionId: "skip_purchase" })).toThrow(/doesn't involve a payment/);
    expect(() => req({ ...scored, decisionId: null })).toThrow(/doesn't involve a payment/);
    expect(() => req({ ...scored, state: "EXPLANATION_REQUIRED" })).toThrow(/pending/);
    expect(() => req({ ...scored, state: "PAYMENT_CANCELLED" })).toThrow(/pending/);
    expect(() => req({ ...scored, state: "FINALIZED" })).toThrow(/pending/);
    expect(() => req(scored, 1, { currency: "EUR", startingFundsMinor: 300_000 })).toThrow(/currency/);
    expect(() => req(scored, 1, { currency: "XXX", startingFundsMinor: 300_000 })).toThrow(/currency/);
  });

  it("retries of the same checkout share an idempotency key; a new checkout or a replay never does", () => {
    expect(req(scored).idempotencyKey).toBe(req(scored).idempotencyKey);
    expect(req(scored, 2).idempotencyKey).not.toBe(req(scored, 1).idempotencyKey);
    expect(req(replay).idempotencyKey).not.toBe(req(scored).idempotencyKey);
    expect(checkoutIdempotencyKey(scored.id, 1)).toBe(`scamsense-${scored.id}-checkout-1`); // mirrored in SQL
    expect(checkoutIdempotencyKey(scored.id, 1).length).toBeLessThanOrEqual(200);
    expect(captureRequestId(req(scored).idempotencyKey)).toBe(`${req(scored).idempotencyKey}-capture`);
    expect(() => checkoutIdempotencyKey(scored.id, 0)).toThrow();
  });
});

describe("PayPal amounts (R38)", () => {
  it("converts integer minor units to PayPal strings and back without floating point", () => {
    expect(toPayPalValue(36_000, "USD")).toBe("360.00");
    expect(toPayPalValue(5, "USD")).toBe("0.05");
    expect(toPayPalValue(1234, "JPY")).toBe("1234");
    expect(fromPayPalValue("360.00", "USD")).toBe(36_000);
    expect(fromPayPalValue("1234", "JPY")).toBe(1234);
  });

  it("rejects malformed, zero, and negative amounts", () => {
    expect(() => toPayPalValue(0, "USD")).toThrow();
    expect(() => toPayPalValue(-100, "USD")).toThrow();
    expect(() => toPayPalValue(1.5, "USD")).toThrow();
    for (const v of ["360", "360.0", "360.001", "-360.00", "3e2", "", "360.00 "]) {
      expect(fromPayPalValue(v, "USD"), v).toBeNull();
    }
    expect(fromPayPalValue("360.00", "NOPE")).toBeNull();
  });

  it("builds a CAPTURE order for the ScamSense Sandbox merchant tagged with the attempt id", () => {
    const body = buildOrderBody(req(scored));
    expect(body.intent).toBe("CAPTURE");
    expect(body.purchase_units).toHaveLength(1);
    expect(body.purchase_units[0]).toMatchObject({
      custom_id: scored.id,
      amount: { currency_code: "USD", value: "360.00" },
    });
    expect(body.purchase_units[0]!.description.length).toBeLessThanOrEqual(127);
    // No payee override: the money goes to ScamSense's own Sandbox merchant, never a fictional or real third party.
    expect(JSON.stringify(body)).not.toContain("payee");
  });

  it("loads the browser SDK from the Sandbox host only", () => {
    expect(PAYPAL_SANDBOX_SDK_URL).toBe("https://www.sandbox.paypal.com/web-sdk/v6/core");
  });
});

describe("settlement (mocked Orders v2 responses)", () => {
  it("records only a COMPLETED capture of exactly the stored amount, currency, order, and attempt", () => {
    const ok = snap(orderJson("COMPLETED", { id: "3C679366HH908993F", status: "COMPLETED" }));
    expect(verifyCapture(stored, ok)).toBe(true);
    expect(decideSettlement(stored, ok)).toEqual({
      kind: "captured",
      captureId: "3C679366HH908993F",
      captureStatus: "COMPLETED",
      orderStatus: "COMPLETED",
    });
    for (const [label, bad] of [
      ["amount", orderJson("COMPLETED", { id: "C1", status: "COMPLETED", value: "359.99" })],
      ["currency", orderJson("COMPLETED", { id: "C1", status: "COMPLETED", currency: "EUR" })],
      [
        "attempt",
        {
          ...orderJson("COMPLETED", { id: "C1", status: "COMPLETED" }),
          purchase_units: [
            {
              ...orderJson("COMPLETED", { id: "C1", status: "COMPLETED" }).purchase_units[0],
              custom_id: replay.id,
            },
          ],
        },
      ],
    ] as const) {
      expect(verifyCapture(stored, snap(bad)), label).toBe(false);
      expect(decideSettlement(stored, snap(bad)).kind, label).toBe("failed");
    }
    // A different order is never applied to this attempt.
    expect(decideSettlement({ ...stored, orderId: "OTHER" }, ok)).toMatchObject({
      kind: "failed",
      code: "order_mismatch",
    });
  });

  it("captures an approved order, waits for an unapproved one, and never treats either as paid", () => {
    expect(decideSettlement(stored, snap(orderJson("APPROVED")))).toEqual({ kind: "capture_needed" });
    for (const s of ["CREATED", "SAVED", "PAYER_ACTION_REQUIRED"]) {
      expect(decideSettlement(stored, snap(orderJson(s))).kind, s).toBe("awaiting_approval");
    }
  });

  it("keeps a PENDING capture pending, and fails declined, failed, and voided payments", () => {
    expect(
      decideSettlement(stored, snap(orderJson("COMPLETED", { id: "C2", status: "PENDING" }))),
    ).toMatchObject({
      kind: "pending",
      captureId: "C2",
    });
    expect(
      decideSettlement(stored, snap(orderJson("COMPLETED", { id: "C3", status: "DECLINED" }))),
    ).toMatchObject({
      kind: "failed",
      code: "capture_declined",
    });
    expect(decideSettlement(stored, snap(orderJson("COMPLETED", { id: "C4", status: "FAILED" }))).kind).toBe(
      "failed",
    );
    expect(decideSettlement(stored, snap(orderJson("VOIDED")))).toMatchObject({
      kind: "failed",
      code: "order_voided",
    });
    // COMPLETED but no capture visible: unverifiable, so it stays pending (asked again later), never "paid".
    expect(decideSettlement(stored, snap(orderJson("COMPLETED"))).kind).toBe("pending");
  });

  it("rejects responses that aren't orders", () => {
    expect(parseOrder(null)).toBeNull();
    expect(parseOrder({ name: "UNPROCESSABLE_ENTITY" })).toBeNull();
    expect(parseOrder({ id: "", status: "CREATED" })).toBeNull();
  });
});

describe("wallet effect (R18–R20)", () => {
  it("debits the official ledger for the scored attempt only; practice replays never touch it", () => {
    expect(walletEffectFor(req(scored))).toEqual({
      kind: "ledger_debit",
      amountMinor: 36_000,
      idempotencyKey: req(scored).idempotencyKey,
    });
    expect(walletEffectFor(req(replay))).toEqual({ kind: "practice_only" });
  });
});
