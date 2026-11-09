import { z } from "zod";
import { errorResponse, json, parseBody } from "@/lib/api/server";
import { checkoutContext } from "@/lib/payments/route";
import { settleCheckout } from "@/lib/payments/server";

type Context = { params: Promise<{ attemptId: string }> };

const bodySchema = z.object({ orderId: z.string().regex(/^[A-Z0-9]{1,64}$/i) }).strict();

/**
 * POST /api/attempts/[attemptId]/checkout/capture — called after the buyer approved in PayPal. The browser's callback
 * is NOT proof of payment: the server reads the order, captures it once (idempotent PayPal-Request-Id), verifies the
 * capture, and only then records it (Training Funds for the scored attempt) and finalizes the attempt.
 * Returns `{ attempt, outcome }`; the order must belong to this attempt (404 otherwise).
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const { attemptId } = await params;
    const { orderId } = await parseBody(request, bodySchema);
    const { actor, loaded } = await checkoutContext(attemptId);
    return json(await settleCheckout(actor, loaded, orderId, "capture"));
  } catch (e) {
    return errorResponse(e);
  }
}
