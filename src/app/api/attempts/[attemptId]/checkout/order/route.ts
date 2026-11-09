import { errorResponse, json } from "@/lib/api/server";
import { checkoutContext } from "@/lib/payments/route";
import { createCheckoutOrder } from "@/lib/payments/server";

type Context = { params: Promise<{ attemptId: string }> };

/**
 * POST /api/attempts/[attemptId]/checkout/order — creates (or reuses) the PayPal Sandbox order for the attempt's
 * current checkout and returns `{ orderId }` for the PayPal JS SDK. No body: the amount and currency come from the
 * module run on the server (R32). Requires PAYMENT_PENDING with a locked pay decision and explanation.
 */
export async function POST(_request: Request, { params }: Context) {
  try {
    const { attemptId } = await params;
    const { actor, loaded } = await checkoutContext(attemptId);
    return json(await createCheckoutOrder(actor, loaded));
  } catch (e) {
    return errorResponse(e);
  }
}
