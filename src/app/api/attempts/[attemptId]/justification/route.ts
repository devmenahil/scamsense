import { z } from "zod";
import { errorResponse, json, parseBody, requireApiUser } from "@/lib/api/server";
import { EXPLANATION_MAX_CHARS } from "@/lib/domain/scenarioStateMachine";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { applyAttemptEvent, loadAttempt } from "@/lib/scenario/server";

type Context = { params: Promise<{ attemptId: string }> };

// Length limits are enforced by the state machine (20–1000 after trimming) and again by the database.
const bodySchema = z.object({ text: z.string().max(EXPLANATION_MAX_CHARS * 2) }).strict();

/**
 * POST /api/attempts/[attemptId]/justification — submits and LOCKS the written explanation for the confirmed
 * decision (R11). A pay decision then moves to PAYMENT_PENDING (Sandbox checkout, Step 7); any other decision is
 * FINALIZED. The text is personal data: it is stored for the owner only and never logged.
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const { attemptId } = await params;
    const { supabase, user } = await requireApiUser();
    const { text } = await parseBody(request, bodySchema);
    const [profile, loaded] = await Promise.all([
      requireOnboardedProgressProfile(supabase, user.id),
      loadAttempt(supabase, user.id, attemptId),
    ]);
    const attempt = await applyAttemptEvent(user.id, profile.displayName, loaded, {
      type: "SUBMIT_EXPLANATION",
      text,
    });
    return json({ attempt });
  } catch (e) {
    return errorResponse(e);
  }
}
