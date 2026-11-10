import { errorResponse, json, requireApiUser } from "@/lib/api/server";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { requireModuleRewards } from "@/lib/rewards/server";

type Context = { params: Promise<{ moduleKey: string }> };

/**
 * GET /api/certificates/[moduleKey] — (Step 11) the caller's own certificate data for the on-screen preview, the badge,
 * and the latest email-request status. No file and no download link: certificates are not downloadable (R25).
 * 409 `module_not_completed` until both original scenarios are complete.
 */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { moduleKey } = await params;
    const { supabase, user } = await requireApiUser();
    await requireOnboardedProgressProfile(supabase, user.id);
    const { certificate, badge, email } = await requireModuleRewards(supabase, user.id, moduleKey);
    const { id: _internalId, ...publicCertificate } = certificate;
    void _internalId;
    return json({ certificate: publicCertificate, badge, email });
  } catch (e) {
    return errorResponse(e);
  }
}
