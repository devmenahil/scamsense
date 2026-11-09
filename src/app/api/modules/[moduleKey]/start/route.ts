import { ApiError, errorResponse, json, requireApiUser } from "@/lib/api/server";
import { getModule } from "@/content/modules";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { startModule } from "@/lib/progress/server";

type Context = { params: Promise<{ moduleKey: string }> };

/**
 * POST /api/modules/[moduleKey]/start — begins the module's training-funds period (R20). No body: the currency and
 * amount come from the server (saved profile + deterministic config), never from the client (R32).
 * Idempotent: repeating it never resets or re-credits funds. Locked modules → 409.
 */
export async function POST(_request: Request, { params }: Context) {
  try {
    const { moduleKey } = await params;
    if (!getModule(moduleKey)) throw new ApiError(404, "unknown_module", "That module doesn't exist.");
    const { supabase, user } = await requireApiUser();
    const profile = await requireOnboardedProgressProfile(supabase, user.id);
    const result = await startModule(supabase, user.id, profile, moduleKey);
    return json(result, result.alreadyStarted ? 200 : 201);
  } catch (e) {
    return errorResponse(e);
  }
}
