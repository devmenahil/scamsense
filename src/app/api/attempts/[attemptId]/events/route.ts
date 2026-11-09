import { z } from "zod";
import { errorResponse, json, parseBody, requireApiUser } from "@/lib/api/server";
import { idSchema } from "@/content/scenarios/schema";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { applyAttemptEvent, loadAttempt } from "@/lib/scenario/server";

type Context = { params: Promise<{ attemptId: string }> };

/**
 * Events the BROWSER may send. Server-only events (PAYMENT_CAPTURED, PAYMENT_FAILED, FEEDBACK_READY, …) are not
 * accepted here: only the Step 7 capture flow and the Step 8–9 results pipeline can produce them. The explanation
 * has its own route (/justification). Unknown keys are rejected (`strict`).
 */
const clientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("START") }).strict(),
  z.object({ type: z.literal("RECORD_ACTION"), actionId: idSchema }).strict(),
  z.object({ type: z.literal("SELECT_DECISION"), decisionId: idSchema }).strict(),
  z.object({ type: z.literal("CLEAR_DECISION") }).strict(),
  z.object({ type: z.literal("CONFIRM_DECISION") }).strict(),
  z.object({ type: z.literal("PAYMENT_CANCELLED") }).strict(),
  z.object({ type: z.literal("RETRY_PAYMENT") }).strict(),
  z.object({ type: z.literal("FINALIZE") }).strict(),
]);

/** POST /api/attempts/[attemptId]/events — applies one state-machine event (illegal transitions → 409). */
export async function POST(request: Request, { params }: Context) {
  try {
    const { attemptId } = await params;
    const { supabase, user } = await requireApiUser();
    const event = await parseBody(request, clientEventSchema);
    const [profile, loaded] = await Promise.all([
      requireOnboardedProgressProfile(supabase, user.id),
      loadAttempt(supabase, user.id, attemptId),
    ]);
    const attempt = await applyAttemptEvent(user.id, profile.displayName, loaded, event);
    return json({ attempt });
  } catch (e) {
    return errorResponse(e);
  }
}
