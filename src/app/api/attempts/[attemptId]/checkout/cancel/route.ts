import { errorResponse, json } from "@/lib/api/server";
import { checkoutContext } from "@/lib/payments/route";
import { cancelCheckout } from "@/lib/payments/server";

type Context = { params: Promise<{ attemptId: string }> };

/**
 * POST /api/attempts/[attemptId]/checkout/cancel — the buyer cancelled (closed PayPal, or "Cancel checkout"). The
 * open order, if any, is checked with PayPal first, then closed; the attempt moves to PAYMENT_CANCELLED with its
 * decision and explanation still locked. No payment, no Training Funds change. Returns `{ attempt, outcome }`.
 */
export async function POST(_request: Request, { params }: Context) {
  try {
    const { attemptId } = await params;
    const { actor, loaded } = await checkoutContext(attemptId);
    return json(await cancelCheckout(actor, loaded));
  } catch (e) {
    return errorResponse(e);
  }
}
