"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientAttemptView } from "@/lib/scenario/view";
import { apiRequest } from "@/lib/api/client";
import { publicEnv } from "@/lib/public-env";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { getPayPalInstance, type PayPalPaymentSession } from "./paypalSdk";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      /** The official PayPal JS SDK v6 button web component. */
      "paypal-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        type?: string;
      };
    }
  }
}

type SettleResponse = {
  attempt: ClientAttemptView;
  outcome: "captured" | "pending" | "failed" | "cancelled" | "awaiting_approval";
};

type Phase =
  { kind: "loading" } | { kind: "ready" } | { kind: "sdk_error" } | { kind: "working"; label: string };

/**
 * The genuine PayPal Sandbox checkout step (R12, Step 7). ScamSense chrome shows the server-computed payment; the buyer
 * approves in PayPal's own UI (official JS SDK v6, Sandbox) — never a restyled or imitated PayPal page (R34).
 * The browser only relays: the server creates the order, captures it, verifies the capture, and records the outcome.
 * Nothing here says whether the payment is wise (R10).
 */
export function CheckoutPanel({
  view,
  busy,
  onView,
  onRetry,
  onFinishWithoutPaying,
}: {
  view: ClientAttemptView;
  busy: boolean;
  onView: (view: ClientAttemptView) => void;
  onRetry: () => void;
  onFinishWithoutPaying: () => void;
}) {
  const checkout = view.checkout;
  const base = `/api/attempts/${view.attemptId}/checkout`;
  const clientId = publicEnv.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const available = !!checkout?.available && !!clientId;
  const pendingCapture = checkout?.openOrder?.status === "PENDING";
  const cancelled = view.state === "PAYMENT_CANCELLED";

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [message, setMessage] = useState<string | null>(null);
  const session = useRef<PayPalPaymentSession | null>(null);
  const inFlight = useRef(false);

  const settled = useCallback(
    (r: SettleResponse) => {
      onView(r.attempt);
      if (r.outcome === "pending") {
        setMessage(
          "PayPal is still processing this payment. Your Training Funds change only once it completes.",
        );
      } else if (r.outcome === "failed") {
        setMessage("The payment didn't go through, so no payment was taken.");
      }
    },
    [onView],
  );

  const post = useCallback(
    async (path: string, body?: unknown, label?: string) => {
      setPhase({ kind: "working", label: label ?? "Checking with PayPal Sandbox…" });
      setMessage(null);
      const r = await apiRequest<SettleResponse>(`${base}/${path}`, { method: "POST", body });
      setPhase({ kind: "ready" });
      if (r.ok) settled(r.data);
      else {
        setMessage(r.error.message);
        if (
          ["state_conflict", "checkout_closed", "checkout_needs_sync", "already_paid"].includes(r.error.code)
        ) {
          const v = await apiRequest<{ attempt: ClientAttemptView }>(`/api/attempts/${view.attemptId}`);
          if (v.ok) onView(v.data.attempt);
        }
      }
      return r.ok;
    },
    [base, onView, settled, view.attemptId],
  );

  // Load the official SDK and create one payment session for this checkout.
  useEffect(() => {
    if (!available || cancelled || pendingCapture || !clientId || !checkout) return;
    let active = true;
    setPhase({ kind: "loading" });
    getPayPalInstance(clientId)
      .then(async (sdk) => {
        const methods = await sdk.findEligibleMethods({ currencyCode: checkout.currency });
        if (!active) return;
        if (!methods.isEligible("paypal")) throw new Error("not_eligible");
        session.current = sdk.createPayPalOneTimePaymentSession({
          onApprove: async ({ orderId }) => {
            // The approval callback is not proof of payment: the server captures and verifies.
            await post("capture", { orderId }, "Confirming your payment with PayPal Sandbox…");
            inFlight.current = false;
          },
          onCancel: async () => {
            await post("cancel", undefined, "Closing the checkout…");
            inFlight.current = false;
          },
          onError: async () => {
            inFlight.current = false;
            setPhase({ kind: "ready" });
            setMessage(
              "PayPal Sandbox couldn't complete that step. No payment was taken. You can try again.",
            );
          },
        });
        setPhase({ kind: "ready" });
      })
      .catch(() => active && setPhase({ kind: "sdk_error" }));
    return () => {
      active = false;
    };
    // The session depends only on the checkout identity, not on every view refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, cancelled, pendingCapture, clientId, checkout?.checkoutSequence, checkout?.currency]);

  // After a refresh with an order already open, ask the server what PayPal says actually happened.
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current || !checkout?.openOrder || cancelled) return;
    synced.current = true;
    void post("sync", undefined, "Checking your checkout with PayPal Sandbox…");
  }, [checkout?.openOrder, cancelled, post]);

  if (!checkout) return null;

  function startCheckout() {
    if (inFlight.current || !session.current || phase.kind !== "ready" || busy) return;
    inFlight.current = true;
    setMessage(null);
    // The order promise is passed straight to PayPal so the popup opens within this click (no popup blocking).
    const order = apiRequest<{ orderId: string }>(`${base}/order`, { method: "POST" }).then((r) => {
      if (r.ok) return { orderId: r.data.orderId };
      setMessage(r.error.message);
      throw new Error(r.error.code);
    });
    session.current.start({ presentationMode: "auto" }, order).catch(() => {
      inFlight.current = false;
    });
  }

  const working = phase.kind === "working";

  return (
    <Card padding="lg" className="mx-auto max-w-2xl" as="section" aria-labelledby="checkout-title">
      <p className="label-eyebrow text-teal/80">{cancelled ? "Checkout closed" : "Checkout"}</p>
      <h1 id="checkout-title" className="mt-1 text-subheading font-bold">
        PayPal Sandbox checkout
      </h1>
      <dl className="mt-5 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-6 gap-y-2 rounded-card bg-mist p-4">
        <dt className="font-semibold">Pay to</dt>
        <dd className="break-words">{checkout.payee}</dd>
        <dt className="font-semibold">For</dt>
        <dd className="break-words">{checkout.description}</dd>
        <dt className="font-semibold">Amount</dt>
        <dd className="font-heading text-lg font-black">{checkout.amountText}</dd>
      </dl>
      <p className="mt-3 text-caption text-teal/85">
        PayPal Sandbox test account and test money only: no real money moves. In PayPal you&apos;ll see the
        ScamSense training merchant.{" "}
        {view.isPractice
          ? "This is a practice attempt, so it never changes your official Training Funds."
          : "Your Training Funds change only after PayPal confirms the payment."}
      </p>

      {message && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-card bg-yellow-tint p-3 text-small">
          <Icon name="info" className="mt-0.5 size-4 shrink-0" />
          {message}
        </p>
      )}

      {cancelled ? (
        <>
          <p className="mt-5 flex items-start gap-2">
            <Icon name="info" className="mt-1 size-5 shrink-0" />
            {checkout.lastClosed === "FAILED"
              ? "The payment didn't go through. No payment was taken and your Training Funds are unchanged."
              : "The checkout was cancelled. No payment was made and your Training Funds are unchanged."}
          </p>
          <p className="mt-2 text-small">Your decision and reasoning stay locked either way.</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="secondary" onClick={onFinishWithoutPaying} disabled={busy}>
              Finish without paying
            </Button>
            <Button onClick={onRetry} loading={busy} loadingText="Opening…">
              Return to checkout
            </Button>
          </div>
        </>
      ) : pendingCapture ? (
        <>
          <div role="status" className="mt-5 flex items-start gap-3 rounded-card border-2 border-teal/30 p-4">
            <Icon name="clock" className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-heading font-extrabold">PayPal is still processing this payment</p>
              <p className="mt-1 text-small">
                It isn&apos;t counted until PayPal completes it, and checking again never charges twice.
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => void post("sync")} loading={working} loadingText="Checking…">
              Check again
            </Button>
          </div>
        </>
      ) : !available ? (
        <>
          <div role="status" className="mt-5 flex items-start gap-3 rounded-card border-2 border-teal/30 p-4">
            <Icon name="info" className="mt-0.5 size-5 shrink-0" />
            <p>Sandbox checkout is unavailable right now. No payment has been made.</p>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              variant="secondary"
              onClick={() => void post("cancel")}
              loading={working}
              loadingText="Cancelling…"
            >
              Cancel checkout
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-6 min-h-14" aria-busy={phase.kind === "loading" || working}>
            {phase.kind === "loading" && (
              <p className="flex items-center gap-2 text-small" role="status">
                <Spinner className="size-5" /> Loading PayPal Sandbox…
              </p>
            )}
            {phase.kind === "sdk_error" && (
              <p className="flex items-start gap-2" role="status">
                <Icon name="info" className="mt-1 size-5 shrink-0" />
                PayPal Sandbox couldn&apos;t load. Check your connection, then refresh the page. No payment
                has been made.
              </p>
            )}
            {working && (
              <p className="flex items-center gap-2 text-small" role="status">
                <Spinner className="size-5" /> {phase.label}
              </p>
            )}
            <div className={phase.kind === "ready" && !busy ? "max-w-sm" : "hidden"}>
              <paypal-button type="pay" onClick={startCheckout} className="block w-full" />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              variant="ghost"
              onClick={() => void post("cancel", undefined, "Closing the checkout…")}
              disabled={working || busy}
            >
              Cancel checkout
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
