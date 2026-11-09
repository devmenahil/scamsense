import { errorResponse, json, requireApiUser } from "@/lib/api/server";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { loadProgressSnapshot } from "@/lib/progress/server";

/**
 * GET /api/progress — the signed-in user's own progress snapshot: module lock states, scenario statuses (with resume /
 * replay actions), training funds per module (ledger + summary), score totals, and badges.
 *
 * Every row is read through the user's session, so RLS scopes it to the caller. The snapshot never contains answer-key
 * data: payments stay "pending" until their scenario is completed (R10).
 */
export async function GET() {
  try {
    const { supabase, user } = await requireApiUser();
    const profile = await requireOnboardedProgressProfile(supabase, user.id);
    const snapshot = await loadProgressSnapshot(supabase, user.id, profile);
    return json({ progress: snapshot });
  } catch (e) {
    return errorResponse(e);
  }
}
