/**
 * PayPal Sandbox checkout — pure domain rules (Step 7). No I/O: the HTTP client is `paypal.ts` and the orchestration is
 * `server.ts`; both call into this file so every decision about money is deterministic and unit-tested.
 *
 * Lifecycle (ARCHITECTURE §9):
 *
 *   EXPLANATION_REQUIRED ─SUBMIT_EXPLANATION(pay decision)→ PAYMENT_PENDING
 *     1. checkout request  buildCheckoutRequest(): amount + currency from the module run (never the client, R32)
 *     2. create order      Orders v2, PayPal-Request-Id = request.idempotencyKey → payment_transactions (CREATED)
 *     3. buyer approval    PayPal JS SDK v6 (Sandbox) → onApprove(orderId)
 *     4. settle            GET the order first, then decideSettlement(): capture an APPROVED order (idempotent
 *                          capture request id), record an already COMPLETED capture, wait, or fail
 *     5. verify            verifyCapture(): capture COMPLETED for exactly the stored amount + currency, and the
 *                          order's custom_id is this attempt — otherwise it is NOT a payment
 *     6. record            record_payment_capture(): CAPTURED + ledger debit (scored attempt only) + attempt
 *                          PAYMENT_COMPLETED → FINALIZED, in one database transaction
 *        cancellation      buyer cancels → CANCELLED → PAYMENT_CANCELLED (retry = new sequence, or finish unpaid)
 *        failure           declined / voided / unverifiable → FAILED → PAYMENT_CANCELLED (never recorded as paid)
 *        pending           capture PENDING at PayPal → row PENDING, attempt stays PAYMENT_PENDING, no wallet change
 *
 * Duplicate-payment protection: one idempotency key per (attempt, checkout sequence), reused for every retry of that
 * checkout (double click, network retry, refresh). A new key exists only after an explicit RETRY_PAYMENT following a
 * cancelled/failed checkout (nothing was captured). Separate replays have their own attempt ids, so their keys and
 * Sandbox orders are always distinct. Reconciliation always reads the order before capturing, so uncertainty is never
 * "resolved" by a second capture.
 */
import { z } from "zod";
import type { ScenarioState } from "@/lib/domain/scenarioStateMachine";
import { getPayPalCurrency, isSupportedCurrency, minorToMajorString } from "@/lib/domain/currency";
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

export type CheckoutErrorCode =
  "not_payable" | "wrong_state" | "invalid_sequence" | "unsupported_currency" | "invalid_amount";

export class CheckoutError extends Error {
  constructor(
    public readonly code: CheckoutErrorCode,
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

/** The PayPal-Request-Id for capturing an order: derived from the order's own key, so retries never capture twice. */
export function captureRequestId(idempotencyKey: string): string {
  return `${idempotencyKey}-capture`;
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
  // Only currencies verified with the Sandbox merchant may be charged (R4); USD is the verified default.
  if (!isSupportedCurrency(run.currency)) {
    throw new CheckoutError("unsupported_currency", "This currency isn't available for Sandbox checkout.");
  }
  const amountMinor = scenarioAmountMinor(attempt.scenarioKey, run.startingFundsMinor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new CheckoutError("invalid_amount", "This payment amount isn't valid.");
  }
  return {
    attemptId: attempt.id,
    scenarioKey: attempt.scenarioKey,
    decisionId: attempt.decisionId,
    isPractice: attempt.isPractice,
    amountMinor,
    currency: run.currency,
    payee: input.display.payee,
    description: input.display.description,
    checkoutSequence: input.checkoutSequence,
    idempotencyKey: checkoutIdempotencyKey(attempt.id, input.checkoutSequence),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// PayPal amounts (R38: integer minor units ↔ PayPal decimal strings, no floating point)
// ---------------------------------------------------------------------------------------------------------------------

/** "36000" minor USD → "360.00"; 0-decimal currencies stay whole. */
export function toPayPalValue(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new CheckoutError("invalid_amount", "Amounts must be positive integers in minor units.");
  }
  return minorToMajorString(amountMinor, currency);
}

/** Strict inverse for PayPal responses: exactly the currency's decimals, otherwise null (never rounded). */
export function fromPayPalValue(value: string, currency: string): number | null {
  let digits: number;
  try {
    digits = getPayPalCurrency(currency).minorUnitDigits;
  } catch {
    return null;
  }
  const pattern = digits === 0 ? /^\d{1,12}$/ : new RegExp(`^\\d{1,12}\\.\\d{${digits}}$`);
  if (!pattern.test(value)) return null;
  const minor = Number(value.replace(".", ""));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Orders v2 create-order body. The fictional payee never appears: the Sandbox merchant is ScamSense's own. */
export function buildOrderBody(request: CheckoutRequest) {
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: request.scenarioKey,
        custom_id: request.attemptId,
        description: `ScamSense training simulation (Sandbox): ${request.description}`.slice(0, 127),
        amount: {
          currency_code: request.currency,
          value: toPayPalValue(request.amountMinor, request.currency),
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Order snapshots (validated subset of the Orders v2 response)
// ---------------------------------------------------------------------------------------------------------------------

const moneySchema = z.object({ currency_code: z.string(), value: z.string() });
const captureSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.string(),
  amount: moneySchema.optional(),
});
export const paypalOrderSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.string(),
  purchase_units: z
    .array(
      z.object({
        custom_id: z.string().optional(),
        amount: moneySchema.optional(),
        payments: z.object({ captures: z.array(captureSchema).optional() }).optional(),
      }),
    )
    .optional(),
});

export interface CaptureSnapshot {
  captureId: string;
  /** COMPLETED · PENDING · DECLINED · FAILED · REFUNDED · PARTIALLY_REFUNDED (PayPal capture statuses). */
  status: string;
  amountMinor: number | null;
  currency: string | null;
}

export interface OrderSnapshot {
  orderId: string;
  /** CREATED · SAVED · APPROVED · VOIDED · COMPLETED · PAYER_ACTION_REQUIRED (PayPal order statuses). */
  status: string;
  customId: string | null;
  amountMinor: number | null;
  currency: string | null;
  capture: CaptureSnapshot | null;
}

/** Maps a raw Orders v2 response onto a snapshot, or null if it doesn't look like an order. */
export function parseOrder(raw: unknown): OrderSnapshot | null {
  const parsed = paypalOrderSchema.safeParse(raw);
  if (!parsed.success) return null;
  const unit = parsed.data.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const money = (m: z.infer<typeof moneySchema> | undefined) =>
    m ? { amountMinor: fromPayPalValue(m.value, m.currency_code), currency: m.currency_code } : null;
  const unitMoney = money(unit?.amount);
  const captureMoney = money(capture?.amount);
  return {
    orderId: parsed.data.id,
    status: parsed.data.status,
    customId: unit?.custom_id ?? null,
    amountMinor: unitMoney?.amountMinor ?? null,
    currency: unitMoney?.currency ?? null,
    capture: capture
      ? {
          captureId: capture.id,
          status: capture.status,
          amountMinor: captureMoney?.amountMinor ?? null,
          currency: captureMoney?.currency ?? null,
        }
      : null,
  };
}

/** The stored order a settlement is checked against (from payment_transactions, never from the browser). */
export interface StoredOrder {
  attemptId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
}

/** A capture only counts as a payment if PayPal says COMPLETED for exactly the stored amount and currency. */
export function verifyCapture(stored: StoredOrder, order: OrderSnapshot): boolean {
  const c = order.capture;
  return (
    order.orderId === stored.orderId &&
    order.customId === stored.attemptId &&
    c !== null &&
    c.status === "COMPLETED" &&
    c.amountMinor === stored.amountMinor &&
    c.currency === stored.currency
  );
}

export type Settlement =
  /** Verified COMPLETED capture: record it (ledger for the scored attempt) and finalize. */
  | { kind: "captured"; captureId: string; captureStatus: string; orderStatus: string }
  /** The buyer approved but nothing was captured yet: capture now (idempotent request id). */
  | { kind: "capture_needed" }
  /** The buyer hasn't approved yet (popup still open, closed, or the page was refreshed). */
  | { kind: "awaiting_approval" }
  /** PayPal is still processing the capture: not a payment yet, no wallet change. */
  | { kind: "pending"; captureId: string | null; captureStatus: string | null; orderStatus: string }
  /** Declined, voided, or unverifiable: never a payment. */
  | {
      kind: "failed";
      code: string;
      captureId: string | null;
      captureStatus: string | null;
      orderStatus: string;
    };

/** Decides what an order snapshot means for the stored order. Anything not provably paid is not paid. */
export function decideSettlement(stored: StoredOrder, order: OrderSnapshot): Settlement {
  if (order.orderId !== stored.orderId || (order.customId !== null && order.customId !== stored.attemptId)) {
    return {
      kind: "failed",
      code: "order_mismatch",
      captureId: null,
      captureStatus: null,
      orderStatus: order.status,
    };
  }
  const c = order.capture;
  if (c) {
    if (c.status === "COMPLETED") {
      return verifyCapture(stored, order)
        ? { kind: "captured", captureId: c.captureId, captureStatus: c.status, orderStatus: order.status }
        : {
            kind: "failed",
            code: "capture_verification_failed",
            captureId: c.captureId,
            captureStatus: c.status,
            orderStatus: order.status,
          };
    }
    if (c.status === "PENDING") {
      return { kind: "pending", captureId: c.captureId, captureStatus: c.status, orderStatus: order.status };
    }
    return {
      kind: "failed",
      code: `capture_${c.status.toLowerCase()}`.slice(0, 64),
      captureId: c.captureId,
      captureStatus: c.status,
      orderStatus: order.status,
    };
  }
  switch (order.status) {
    case "APPROVED":
      return { kind: "capture_needed" };
    case "CREATED":
    case "SAVED":
    case "PAYER_ACTION_REQUIRED":
      return { kind: "awaiting_approval" };
    case "COMPLETED":
      // COMPLETED without a capture in the response can't be verified: ask again later, never assume payment.
      return { kind: "pending", captureId: null, captureStatus: null, orderStatus: order.status };
    default:
      return {
        kind: "failed",
        code: `order_${order.status.toLowerCase()}`.slice(0, 64),
        captureId: null,
        captureStatus: null,
        orderStatus: order.status,
      };
  }
}

/** How a verified capture affects the fictional Training Funds (R18–R20). Enforced again by the database. */
export function walletEffectFor(
  request: Pick<CheckoutRequest, "isPractice" | "amountMinor" | "idempotencyKey">,
): { kind: "ledger_debit"; amountMinor: number; idempotencyKey: string } | { kind: "practice_only" } {
  return request.isPractice
    ? { kind: "practice_only" }
    : { kind: "ledger_debit", amountMinor: request.amountMinor, idempotencyKey: request.idempotencyKey };
}

/** The script the browser loads. Hard-coded to the Sandbox host: there is no live switch anywhere (R28). */
export const PAYPAL_SANDBOX_SDK_URL = "https://www.sandbox.paypal.com/web-sdk/v6/core";
