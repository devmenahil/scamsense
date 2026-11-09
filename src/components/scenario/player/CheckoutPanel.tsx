"use client";

import type { ClientAttemptView } from "@/lib/scenario/view";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * The PayPal Sandbox checkout step (R12). Step 6 stops at the integration boundary: it shows the server-computed
 * payment and says plainly that the Sandbox connection isn't there yet. It never pretends a payment happened.
 * Step 7 renders the official PayPal Buttons (Sandbox) inside this panel.
 */
export function CheckoutPanel({
  view,
  busy,
  onCancel,
  onRetry,
  onFinishWithoutPaying,
}: {
  view: ClientAttemptView;
  busy: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onFinishWithoutPaying: () => void;
}) {
  const checkout = view.checkout;
  if (!checkout) return null;
  const cancelled = view.state === "PAYMENT_CANCELLED";

  return (
    <Card padding="lg" className="mx-auto max-w-2xl" as="section" aria-labelledby="checkout-title">
      <p className="label-eyebrow text-teal/80">{cancelled ? "Checkout cancelled" : "Checkout"}</p>
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
        Sandbox test money only.{" "}
        {view.isPractice
          ? "This is a practice attempt, so it never changes your official Training Funds."
          : "Your Training Funds change only after a verified Sandbox payment."}
      </p>

      {cancelled ? (
        <>
          <p className="mt-5 flex items-start gap-2">
            <Icon name="info" className="mt-1 size-5 shrink-0" />
            The checkout was cancelled. No payment was made and your Training Funds are unchanged.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="secondary" onClick={onFinishWithoutPaying} disabled={busy}>
              Finish without paying
            </Button>
            <Button onClick={onRetry} loading={busy} loadingText="Opening…">
              Return to checkout
            </Button>
          </div>
        </>
      ) : (
        <>
          <div role="status" className="mt-5 flex items-start gap-3 rounded-card border-2 border-teal/30 p-4">
            <Icon name="clock" className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-heading font-extrabold">Waiting for the PayPal Sandbox connection</p>
              <p className="mt-1 text-small">
                The Sandbox checkout is connected in the next build step. No payment has been made, and this
                attempt stays here until a real Sandbox payment is verified or you cancel.
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="secondary" onClick={onCancel} loading={busy} loadingText="Cancelling…">
              Cancel checkout
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
