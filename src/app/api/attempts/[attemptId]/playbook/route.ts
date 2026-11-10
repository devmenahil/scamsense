import { ApiError, errorResponse, json, requireApiUser } from "@/lib/api/server";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { personalizePlaybook } from "@/lib/recovery/server";
import { NotCompletedError } from "@/lib/review/server";

type Context = { params: Promise<{ attemptId: string }> };

export const maxDuration = 30;

/**
 * POST /api/attempts/[attemptId]/playbook — (Step 9) returns the personal Recovery Playbook note of the caller's own
 * COMPLETED attempt, generating it with ONE Gemini call the first time only (claimed in the database; repeat calls
 * return the stored note). No body is accepted: the attempt id comes from the URL and the user from the session.
 * Policy content is never part of the response: it is rendered from the verified knowledge base.
 */
export async function POST(_request: Request, { params }: Context) {
  try {
    const { attemptId } = await params;
    const { supabase, user } = await requireApiUser();
    await requireOnboardedProgressProfile(supabase, user.id);
    try {
      return json({ note: await personalizePlaybook(supabase, user.id, attemptId) });
    } catch (e) {
      if (e instanceof NotCompletedError)
        throw new ApiError(409, "not_completed", "Finish the scenario to open its Recovery Playbook.");
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
