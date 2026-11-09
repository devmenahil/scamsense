import { errorResponse, json, requireApiUser } from "@/lib/api/server";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { loadAttempt, viewFor } from "@/lib/scenario/server";

type Context = { params: Promise<{ attemptId: string }> };

/**
 * GET /api/attempts/[attemptId] — the client-safe view of the caller's own attempt: state, neutral intro, filled-in
 * environment, recorded actions, the chosen decision, and checkout details while a payment is pending.
 * Never the answer key (R10). Another user's attempt is a 404.
 */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { attemptId } = await params;
    const { supabase, user } = await requireApiUser();
    const [profile, loaded] = await Promise.all([
      requireOnboardedProgressProfile(supabase, user.id),
      loadAttempt(supabase, user.id, attemptId),
    ]);
    return json({ attempt: viewFor(loaded, profile.displayName) });
  } catch (e) {
    return errorResponse(e);
  }
}
