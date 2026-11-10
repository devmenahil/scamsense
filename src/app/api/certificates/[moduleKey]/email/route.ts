import { errorResponse, json, parseBody, requireApiUser } from "@/lib/api/server";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { requestCertificateEmail } from "@/lib/rewards/email.server";
import { certificateEmailRequestSchema } from "@/lib/rewards/emailStatus";

type Context = { params: Promise<{ moduleKey: string }> };

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/certificates/[moduleKey]/email — (Step 11) `{email, requestId}`. Session user only; the certificate must be
 * the caller's own. Deduplicated by `requestId` (network retries), in-flight requests, and a 30 s same-address window;
 * rate-limited (429). Sends the certificate to the existing Zapier Catch Hook with a short-lived signed PDF URL.
 * Returns `{outcome, email}` where `email.status` is `submitted` (Zapier accepted; not proof of delivery), `processing`,
 * or `failed` (retryable). The signed URL and the webhook URL are never returned to the browser.
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const { moduleKey } = await params;
    const { supabase, user } = await requireApiUser();
    await requireOnboardedProgressProfile(supabase, user.id);
    const body = await parseBody(request, certificateEmailRequestSchema);
    return json(await requestCertificateEmail(supabase, user.id, moduleKey, body));
  } catch (e) {
    return errorResponse(e);
  }
}
