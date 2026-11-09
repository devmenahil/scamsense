import { errorResponse, json } from "@/lib/api/server";
import { checkoutContext } from "@/lib/payments/route";
import { settleCheckout } from "@/lib/payments/server";

type Context = { params: Promise<{ attemptId: string }> };

/**
 * POST /api/attempts/[attemptId]/checkout/sync — reconciliation after a refresh, a lost response, or a pending
 * capture: reads the open order from PayPal and records whatever PayPal says actually happened. It never sends a second
 * capture; an approved-but-uncaptured order gets its single idempotent capture. Returns `{ attempt, outcome }`.
 */
export async function POST(_request: Request, { params }: Context) {
  try {
    const { attemptId } = await params;
    const { actor, loaded } = await checkoutContext(attemptId);
    return json(await settleCheckout(actor, loaded, null, "sync"));
  } catch (e) {
    return errorResponse(e);
  }
}
