import "server-only";
/**
 * Scenario payment service (Step 7): the single place where ScamSense talks to PayPal for a scenario attempt.
 * Route handlers authenticate, load the caller's own attempt (RLS), and call one of:
 *
 *   createCheckoutOrder  → create (or reuse) the Orders v2 order for the attempt's current checkout
 *   settleCheckout       → read the order, capture it if approved, and record the verified outcome
 *   cancelCheckout       → close the current checkout after confirming nothing was approved or captured
 *
 * Amounts, currency, ownership and state are decided here and in pure `checkout.ts` from the module run and the
 * attempt, never from the browser (R32). All database writes are trusted-writer functions that re-check the same
 * rules (supabase/migrations/20261111090000_paypal_checkout.sql). Nothing here ever reports a payment that PayPal has
 * not confirmed as a COMPLETED capture of exactly the stored amount (R30).
 */
import { getScenarioRender } from "@/content/scenarios/renders";
import { ApiError, dbError } from "@/lib/api/server";
import { applyAttemptEvent, loadAttempt, viewFor, type LoadedAttempt } from "@/lib/scenario/server";
import { checkoutSequence, type AttemptPaymentData, type ClientAttemptView } from "@/lib/scenario/view";
import { getTrustedWriter, TrustedWriterNotConfiguredError } from "@/lib/supabase/admin";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import {
  buildCheckoutRequest,
  captureRequestId,
  CheckoutError,
  decideSettlement,
  type OrderSnapshot,
  type Settlement,
  type StoredOrder,
} from "./checkout";
import { getPayPalClient } from "./config";
import type { PayPalClient, PayPalResult } from "./paypal";

export type SettleOutcome = "captured" | "pending" | "failed" | "cancelled" | "awaiting_approval";

/** Who is acting: the verified session user, their RLS-scoped client, and the display name for the view. */
export interface PaymentActor {
  supabase: SupabaseServerClient;
  userId: string;
  displayName: string | null;
}

export interface SettleResult {
  attempt: ClientAttemptView;
  outcome: SettleOutcome;
}

const UNKNOWN_OUTCOME = new ApiError(
  503,
  "paypal_unconfirmed",
  "We couldn't confirm this payment with PayPal yet. Nothing will be charged twice: check again in a moment.",
);

function paypal(): PayPalClient {
  const client = getPayPalClient();
  if (!client) {
    console.error("[paypal] not configured: set NEXT_PUBLIC_PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET");
    throw new ApiError(503, "paypal_unavailable", "Sandbox checkout is unavailable right now.");
  }
  return client;
}

function writer() {
  try {
    return getTrustedWriter();
  } catch (e) {
    if (e instanceof TrustedWriterNotConfiguredError) {
      throw new ApiError(
        503,
        "service_unavailable",
        "Payments can't be saved right now. Please try again later.",
      );
    }
    throw e;
  }
}

/** Maps the payment functions' stable P0001 messages to calm responses. */
export function paymentFunctionError(error: { code?: string; message?: string }): ApiError {
  if (error.code === "P0001") {
    switch (error.message) {
      case "attempt_state_conflict":
      case "invalid_state_transition":
      case "payment_closed":
      case "checkout_sequence_mismatch":
      case "payment_order_open":
        return new ApiError(409, "state_conflict", "This checkout changed in another tab. Refreshing…");
      case "attempt_already_paid":
      case "duplicate_attempt_payment":
        return new ApiError(409, "already_paid", "This attempt's payment has already been made.");
      case "insufficient_funds":
        return new ApiError(
          409,
          "insufficient_funds",
          "There aren't enough Training Funds left for this payment.",
        );
      case "amount_mismatch":
      case "currency_mismatch":
      case "capture_amount_mismatch":
      case "capture_mismatch":
      case "payment_order_mismatch":
        console.error("[paypal] verification rejected by database", { reason: error.message });
        return new ApiError(
          409,
          "payment_mismatch",
          "This payment couldn't be verified, so it wasn't counted.",
        );
      case "attempt_not_found":
      case "payment_not_found":
        return new ApiError(404, "not_found", "We couldn't find that checkout.");
      default:
        console.error("[paypal] rejected by database", { reason: error.message });
        return new ApiError(409, "conflict", "That payment step isn't available right now. Please refresh.");
    }
  }
  return dbError(error, "Payments");
}

function requestFor(loaded: LoadedAttempt) {
  const render = getScenarioRender(loaded.attempt.scenarioKey)!;
  if (!render.checkout) throw new ApiError(409, "not_payable", "This decision doesn't involve a payment.");
  try {
    return buildCheckoutRequest({
      attempt: {
        id: loaded.attempt.id,
        scenarioKey: loaded.attempt.scenarioKey,
        state: loaded.attempt.state,
        isPractice: loaded.attempt.isPractice,
        decisionId: loaded.attempt.decisionId,
      },
      run: loaded.run,
      // Payable = the authored `pay` decisions (client-safe render; the answer key is not needed, R10).
      payableDecisionIds: render.decisions.filter((d) => d.kind === "pay").map((d) => d.id),
      display: render.checkout,
      checkoutSequence: checkoutSequence(loaded.events),
    });
  } catch (e) {
    if (e instanceof CheckoutError) {
      const status = e.code === "unsupported_currency" || e.code === "invalid_amount" ? 422 : 409;
      throw new ApiError(status, e.code, e.message);
    }
    throw e;
  }
}

const openPayment = (loaded: LoadedAttempt) =>
  loaded.payments.find((p) => p.status === "CREATED" || p.status === "PENDING");

const stored = (loaded: LoadedAttempt, p: AttemptPaymentData): StoredOrder => ({
  attemptId: loaded.attempt.id,
  orderId: p.orderId,
  amountMinor: p.amountMinor,
  currency: p.currency,
});

function failure(r: Extract<PayPalResult<unknown>, { ok: false }>): ApiError {
  if (r.error.kind === "rejected") {
    return new ApiError(
      502,
      "paypal_rejected",
      "PayPal Sandbox didn't accept that request. Please try again.",
    );
  }
  if (r.error.kind === "not_configured") {
    return new ApiError(503, "paypal_unavailable", "Sandbox checkout is unavailable right now.");
  }
  return UNKNOWN_OUTCOME;
}

function unwrap<T>(r: PayPalResult<T>): T {
  if (r.ok) return r.value;
  throw failure(r);
}

/** Re-reads the attempt (RLS) after a database function changed it, so the view always reflects stored truth. */
async function reloadView(actor: PaymentActor, loaded: LoadedAttempt): Promise<ClientAttemptView> {
  return viewFor(await loadAttempt(actor.supabase, actor.userId, loaded.attempt.id), actor.displayName);
}

/**
 * POST …/checkout/order. Returns the PayPal order id for the attempt's current checkout. A retry of the same checkout
 * (double click, refresh, network retry) gets the SAME order: the stored open order is reused, and a repeated create
 * uses the same PayPal-Request-Id, which PayPal answers with the same order.
 */
export async function createCheckoutOrder(
  actor: PaymentActor,
  loaded: LoadedAttempt,
): Promise<{ orderId: string }> {
  if (loaded.payments.some((p) => p.status === "CAPTURED")) {
    throw new ApiError(409, "already_paid", "This attempt's payment has already been made.");
  }
  const request = requestFor(loaded);
  const client = paypal();
  const open = openPayment(loaded);
  if (open) {
    if (open.status === "PENDING") {
      throw new ApiError(
        409,
        "capture_pending",
        "PayPal is still processing this payment. Check again shortly.",
      );
    }
    // Reuse the order only while the buyer can still approve it; anything else must be settled first.
    const order = unwrap(await client.getOrder(open.orderId));
    if (decideSettlement(stored(loaded, open), order).kind === "awaiting_approval")
      return { orderId: open.orderId };
    throw new ApiError(
      409,
      "checkout_needs_sync",
      "This checkout already has an update from PayPal. Refreshing…",
    );
  }

  const created = unwrap(await client.createOrder(request));
  if (
    created.amountMinor !== null &&
    (created.amountMinor !== request.amountMinor || created.currency !== request.currency)
  ) {
    console.error("[paypal] created order amount differs from the request");
    throw new ApiError(
      502,
      "paypal_rejected",
      "PayPal Sandbox returned an unexpected order. Please try again.",
    );
  }
  const { error } = await writer().rpc("record_payment_order", {
    p_user_id: actor.userId,
    p_attempt_id: loaded.attempt.id,
    p_request_id: request.idempotencyKey,
    p_paypal_order_id: created.orderId,
    p_paypal_order_status: created.status,
    p_amount_minor: request.amountMinor,
    p_currency: request.currency,
  });
  if (error) {
    // A concurrent identical request (double click) stored this checkout's order first. Simultaneous requests can
    // even get two different Sandbox orders before PayPal's request-id deduplication applies; the database keeps the
    // first, so every caller is given that one stored order. Any other order stays unapproved and simply expires.
    if (error.code === "P0001" && ["payment_order_open", "payment_order_mismatch"].includes(error.message)) {
      const existing = openPayment(await loadAttempt(actor.supabase, actor.userId, loaded.attempt.id));
      if (existing?.requestId === request.idempotencyKey && existing.status === "CREATED") {
        return { orderId: existing.orderId };
      }
    }
    throw paymentFunctionError(error);
  }
  return { orderId: created.orderId };
}

async function applySettlement(
  actor: PaymentActor,
  loaded: LoadedAttempt,
  payment: AttemptPaymentData,
  settlement: Exclude<Settlement, { kind: "capture_needed" }>,
): Promise<SettleResult> {
  const db = writer();
  switch (settlement.kind) {
    case "captured": {
      const { error } = await db.rpc("record_payment_capture", {
        p_user_id: actor.userId,
        p_payment_id: payment.id,
        p_paypal_capture_id: settlement.captureId,
        p_paypal_capture_status: settlement.captureStatus,
        p_paypal_order_status: settlement.orderStatus,
        p_amount_minor: payment.amountMinor,
        p_currency: payment.currency,
      });
      if (error) {
        // PayPal has the money (Sandbox) but we couldn't save it: the next sync reads the order again and records
        // the same capture — never a second charge.
        if (error.code !== "P0001") {
          console.error("[paypal] capture verified but not saved yet", { code: error.code });
          throw new ApiError(
            503,
            "capture_not_saved",
            "PayPal confirmed the payment, but we couldn't save it yet. Check again: you won't be charged twice.",
          );
        }
        throw paymentFunctionError(error);
      }
      return { outcome: "captured", attempt: await reloadView(actor, loaded) };
    }
    case "pending":
    case "failed": {
      const status = settlement.kind === "pending" ? "PENDING" : "FAILED";
      const { error } = await db.rpc("update_payment_order", {
        p_user_id: actor.userId,
        p_payment_id: payment.id,
        p_status: status,
        p_paypal_order_status: settlement.orderStatus,
        p_paypal_capture_id: settlement.captureId,
        p_paypal_capture_status: settlement.captureStatus,
        p_failure_code: settlement.kind === "failed" ? settlement.code : null,
      });
      if (error) throw paymentFunctionError(error);
      return { outcome: settlement.kind, attempt: await reloadView(actor, loaded) };
    }
    case "awaiting_approval":
      return { outcome: "awaiting_approval", attempt: viewFor(loaded, actor.displayName) };
  }
}

/** Captures an approved order (one idempotent capture request), reading the order again if PayPal says it's done. */
async function captureApproved(
  client: PayPalClient,
  loaded: LoadedAttempt,
  payment: AttemptPaymentData,
): Promise<Exclude<Settlement, { kind: "capture_needed" }>> {
  const result = await client.captureOrder(payment.orderId, captureRequestId(payment.requestId));
  let order: OrderSnapshot;
  if (result.ok) {
    order = result.value;
  } else if (result.error.kind === "rejected" && result.error.issue === "ORDER_ALREADY_CAPTURED") {
    order = unwrap(await client.getOrder(payment.orderId)); // reconcile, never re-capture
  } else if (result.error.kind === "rejected" && result.error.status === 422) {
    const issue = (result.error.issue ?? "capture_rejected").toLowerCase();
    return {
      kind: "failed",
      code: issue.slice(0, 64),
      captureId: null,
      captureStatus: null,
      orderStatus: "APPROVED",
    };
  } else {
    throw failure(result);
  }
  const settlement = decideSettlement(stored(loaded, payment), order);
  // A capture response that still isn't settled is treated as processing: ask again later.
  return settlement.kind === "capture_needed" || settlement.kind === "awaiting_approval"
    ? { kind: "pending", captureId: null, captureStatus: null, orderStatus: order.status }
    : settlement;
}

/**
 * POST …/checkout/capture ({orderId}, after the buyer approved) and POST …/checkout/sync (after a refresh or an
 * interrupted request). Always reads the order from PayPal first, so an earlier capture whose response was lost is
 * recorded, not repeated. `orderId`, when given, must be this attempt's own order.
 */
export async function settleCheckout(
  actor: PaymentActor,
  loaded: LoadedAttempt,
  orderId: string | null,
  mode: "capture" | "sync",
): Promise<SettleResult> {
  const payment = orderId
    ? loaded.payments.find((p) => p.orderId === orderId)
    : (openPayment(loaded) ?? loaded.payments.find((p) => p.status === "CAPTURED"));
  if (!payment) {
    if (orderId)
      throw new ApiError(404, "order_not_found", "That checkout doesn't belong to this scenario attempt.");
    return { outcome: "awaiting_approval", attempt: viewFor(loaded, actor.displayName) };
  }
  if (payment.status === "CAPTURED")
    return { outcome: "captured", attempt: viewFor(loaded, actor.displayName) };
  if (payment.status === "CANCELLED" || payment.status === "FAILED") {
    throw new ApiError(409, "checkout_closed", "That checkout was already closed. No payment was taken.");
  }
  if (loaded.attempt.state !== "PAYMENT_PENDING") {
    throw new ApiError(409, "state_conflict", "This checkout changed in another tab. Refreshing…");
  }

  const client = paypal();
  const order = unwrap(await client.getOrder(payment.orderId));
  let settlement = decideSettlement(stored(loaded, payment), order);
  if (settlement.kind === "capture_needed") settlement = await captureApproved(client, loaded, payment);
  if (settlement.kind === "awaiting_approval" && mode === "capture") {
    throw new ApiError(409, "not_approved", "The payment hasn't been approved in PayPal yet.");
  }
  return applySettlement(actor, loaded, payment, settlement);
}

/**
 * POST …/checkout/cancel. Closes the current checkout without paying. If an order exists, PayPal is asked first:
 * an approved or captured order is never marked cancelled (it is settled instead), so a cancellation can't hide a
 * payment that actually happened.
 */
export async function cancelCheckout(actor: PaymentActor, loaded: LoadedAttempt): Promise<SettleResult> {
  if (loaded.attempt.state === "PAYMENT_CANCELLED") {
    return { outcome: "cancelled", attempt: viewFor(loaded, actor.displayName) };
  }
  if (loaded.attempt.state !== "PAYMENT_PENDING") {
    throw new ApiError(409, "state_conflict", "This checkout changed in another tab. Refreshing…");
  }
  const payment = openPayment(loaded);
  if (!payment) {
    // No order was ever created for this checkout: just record the cancellation.
    const attempt = await applyAttemptEvent(actor.userId, actor.displayName, loaded, {
      type: "PAYMENT_CANCELLED",
    });
    return { outcome: "cancelled", attempt };
  }
  if (payment.status === "PENDING") {
    throw new ApiError(
      409,
      "capture_pending",
      "PayPal is still processing this payment, so it can't be cancelled.",
    );
  }
  const order = unwrap(await paypal().getOrder(payment.orderId));
  const settlement = decideSettlement(stored(loaded, payment), order);
  if (settlement.kind === "capture_needed") {
    throw new ApiError(409, "checkout_needs_sync", "This payment was approved in PayPal. Refreshing…");
  }
  if (settlement.kind !== "awaiting_approval") return applySettlement(actor, loaded, payment, settlement);

  const { error } = await writer().rpc("update_payment_order", {
    p_user_id: actor.userId,
    p_payment_id: payment.id,
    p_status: "CANCELLED",
    p_paypal_order_status: order.status,
    p_paypal_capture_id: null,
    p_paypal_capture_status: null,
    p_failure_code: "buyer_cancelled",
  });
  if (error) throw paymentFunctionError(error);
  return { outcome: "cancelled", attempt: await reloadView(actor, loaded) };
}
