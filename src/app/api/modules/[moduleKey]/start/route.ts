import { ApiError, errorResponse, json, requireApiUser } from "@/lib/api/server";
import { getModule, type ModuleKey } from "@/content/modules";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { startModule } from "@/lib/progress/server";
import { ensureModuleOrder } from "@/lib/routing/server";

type Context = { params: Promise<{ moduleKey: string }> };

/**
 * POST /api/modules/[moduleKey]/start — begins the module's training-funds period (R20). No body: the currency and
 * amount come from the server (saved profile + deterministic config), never from the client (R32).
 * Idempotent: repeating it never resets or re-credits funds. Locked modules → 409.
 *
 * Step 8: starting a module also fixes the order of its two scenarios (hybrid routing). This is the only place routing
 * may call Gemini, and only for a meaningful custom "Other" description that has no cached interpretation. The order
 * is written once; if routing fails the module still starts and keeps the authored order.
 */
export async function POST(_request: Request, { params }: Context) {
  try {
    const { moduleKey } = await params;
    if (!getModule(moduleKey)) throw new ApiError(404, "unknown_module", "That module doesn't exist.");
    const { supabase, user } = await requireApiUser();
    const profile = await requireOnboardedProgressProfile(supabase, user.id);
    const result = await startModule(supabase, user.id, profile, moduleKey);
    await ensureModuleOrder(supabase, user.id, moduleKey as ModuleKey, { allowGemini: true });
    return json(result, result.alreadyStarted ? 200 : 201);
  } catch (e) {
    return errorResponse(e);
  }
}
