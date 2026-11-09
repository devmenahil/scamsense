/**
 * PayPal Sandbox checkout — INTEGRATION BOUNDARY (Step 6). Step 7 implements `PaymentGateway` with the PayPal Orders v2
 * REST API (Sandbox only); everything the scenario engine needs around it is defined and tested here.
 *
 * Lifecycle (ARCHITECTURE §9, updated in Step 6: the explanation now comes BEFORE checkout):
 *
 *   EXPLANATION_REQUIRED ─SUBMIT_EXPLANATION(pay decision)→ PAYMENT_PENDING
 *     1. initiate checkout   buildCheckoutRequest(): amount + currency from the module run (never the client, R32)
 *     2. create order        gateway.createOrder(request)       PayPal-Request-Id = request.idempotencyKey
 *     3. buyer approval      PayPal JS SDK popup (Sandbox buyer account) → onApprove(orderId)
 *     4. capture             gateway.captureOrder(orderId, request)
 *     5. verify              verifyCapture(): status COMPLETED + exact amount + currency, else it is NOT a payment
 *     6. record references   payment_transactions row (order id, capture id, request id, practice flag)
 *     7. wallet              walletEffectFor(): scored attempt → record_training_payment(idempotencyKey);
 *                            practice replay → nothing on the official ledger
 *     8. state               captured → PAYMENT_CAPTURED → PAYMENT_COMPLETED → FINALIZE → FINALIZED
 *        cancellation        onCancel → PAYMENT_CANCELLED (player may RETRY_PAYMENT or FINALIZE without paying)
 *        failure             declined / error → PAYMENT_FAILED → PAYMENT_CANCELLED (never recorded as paid)
 *
 * Duplicate-payment protection: one idempotency key per (attempt, checkout sequence). Retrying the same checkout
 * (double click, network retry) reuses the key, so PayPal and the ledger see one payment. Only an explicit
 * RETRY_PAYMENT after a cancellation starts a new sequence, and that is only possible because nothing was captured.
 * Separate replay attempts have their own attempt IDs, so their keys (and Sandbox orders) are always distinct.
 *
 * Nothing in this file fakes a payment: `pendingIntegrationGateway` reports "integration_pending" for every call.
 */
import type { ScenarioState } from "@/lib/domain/scenarioStateMachine";
import { scenarioAmountMinor } from "@/lib/domain/trainingFunds";

export interface CheckoutAttempt {
  id: string;
  scenarioKey: string;
  state: ScenarioState;
  isPractice: boolean;
  decisionId: string | null;
}

export interface CheckoutRun {
  currency: string;
  startingFundsMinor: number;
}

export interface CheckoutRequest {
  attemptId: string;
  scenarioKey: string;
  decisionId: string;
  isPractice: boolean;
  amountMinor: number;
  currency: string;
  payee: string;
  description: string;
  /** 1 for the first checkout of the attempt, +1 after each cancelled/failed checkout the player retries. */
  checkoutSequence: number;
  /** PayPal-Request-Id and ledger idempotency key. Stable for retries of the same checkout. */
  idempotencyKey: string;
}

export class CheckoutError extends Error {
  constructor(
    public readonly code: "not_payable" | "wrong_state" | "invalid_sequence",
    message: string,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export function checkoutIdempotencyKey(attemptId: string, checkoutSequence: number): string {
  if (!Number.isInteger(checkoutSequence) || checkoutSequence < 1) {
    throw new CheckoutError("invalid_sequence", "checkout sequence must be a positive integer");
  }
  return `scamsense-${attemptId}-checkout-${checkoutSequence}`;
}

/** Builds the server-side checkout request for an attempt waiting for payment. */
export function buildCheckoutRequest(input: {
  attempt: CheckoutAttempt;
  run: CheckoutRun;
  payableDecisionIds: readonly string[];
  display: { payee: string; description: string };
  checkoutSequence: number;
}): CheckoutRequest {
  const { attempt, run } = input;
  if (attempt.state !== "PAYMENT_PENDING") {
    throw new CheckoutError("wrong_state", "Checkout is only available while a payment is pending.");
  }
  if (!attempt.decisionId || !input.payableDecisionIds.includes(attempt.decisionId)) {
    throw new CheckoutError("not_payable", "This decision doesn't involve a payment.");
  }
  return {
    attemptId: attempt.id,
    scenarioKey: attempt.scenarioKey,
    decisionId: attempt.decisionId,
    isPractice: attempt.isPractice,
    amountMinor: scenarioAmountMinor(attempt.scenarioKey, run.startingFundsMinor),
    currency: run.currency,
    payee: input.display.payee,
    description: input.display.description,
    checkoutSequence: input.checkoutSequence,
    idempotencyKey: checkoutIdempotencyKey(attempt.id, input.checkoutSequence),
  };
}

/** What PayPal reported for a capture (Step 7 maps the Orders v2 response onto this). */
export interface CaptureResult {
  orderId: string;
  captureId: string | null;
  status: "COMPLETED" | "PENDING" | "DECLINED" | "FAILED";
  amountMinor: number | null;
  currency: string | null;
}

/** A capture only counts as a payment if PayPal says COMPLETED for exactly the amount and currency requested. */
export function verifyCapture(request: CheckoutRequest, capture: CaptureResult): boolean {
  return (
    capture.status === "COMPLETED" &&
    capture.captureId !== null &&
    capture.amountMinor === request.amountMinor &&
    capture.currency === request.currency
  );
}

/** The state-machine event a capture result produces. Anything unverified is a failure, never a payment. */
export function eventForCapture(
  request: CheckoutRequest,
  capture: CaptureResult,
): "PAYMENT_CAPTURED" | "PAYMENT_FAILED" {
  return verifyCapture(request, capture) ? "PAYMENT_CAPTURED" : "PAYMENT_FAILED";
}

/** How a verified capture affects the fictional Training Funds (R18–R20). */
export function walletEffectFor(
  request: CheckoutRequest,
): { kind: "ledger_debit"; amountMinor: number; idempotencyKey: string } | { kind: "practice_only" } {
  return request.isPractice
    ? { kind: "practice_only" }
    : { kind: "ledger_debit", amountMinor: request.amountMinor, idempotencyKey: request.idempotencyKey };
}

export type GatewayResult<T> =
  { ok: true; value: T } | { ok: false; reason: "integration_pending" | "unavailable" };

/** Implemented in Step 7 against https://api-m.sandbox.paypal.com (Sandbox guard in the env schema). */
export interface PaymentGateway {
  readonly name: string;
  createOrder(request: CheckoutRequest): Promise<GatewayResult<{ orderId: string }>>;
  captureOrder(orderId: string, request: CheckoutRequest): Promise<GatewayResult<CaptureResult>>;
  getOrderStatus(orderId: string): Promise<GatewayResult<{ status: string }>>;
}

/** The Step 6 gateway: always reports that the Sandbox integration is not connected yet. Never fakes success. */
export const pendingIntegrationGateway: PaymentGateway = {
  name: "pending-integration",
  async createOrder() {
    return { ok: false, reason: "integration_pending" };
  },
  async captureOrder() {
    return { ok: false, reason: "integration_pending" };
  },
  async getOrderStatus() {
    return { ok: false, reason: "integration_pending" };
  },
};

/** Which gateway the server uses. Step 7 swaps in the PayPal Sandbox implementation here. */
export function getPaymentGateway(): PaymentGateway {
  return pendingIntegrationGateway;
}
