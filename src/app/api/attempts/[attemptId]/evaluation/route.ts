import { z } from "zod";
import { errorResponse, json, parseBody, requireApiUser } from "@/lib/api/server";
import { evaluateAttempt, getEvaluationStatus } from "@/lib/evaluation/server";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { loadAttempt } from "@/lib/scenario/server";

type Context = { params: Promise<{ attemptId: string }> };

// Evaluation can take a while (one Gemini call with a bounded deadline, Step 8).
export const maxDuration = 60;

const bodySchema = z.object({ mode: z.enum(["ai", "basic"]).default("ai") }).strict();

/**
 * GET /api/attempts/[attemptId]/evaluation — the stored evaluation status/results of the caller's own attempt.
 * Never calls Gemini: revisiting results reuses saved feedback. Results exist only once the attempt is COMPLETED.
 */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { attemptId } = await params;
    const { supabase, user } = await requireApiUser();
    const [, loaded] = await Promise.all([
      requireOnboardedProgressProfile(supabase, user.id),
      loadAttempt(supabase, user.id, attemptId),
    ]);
    return json({ evaluation: await getEvaluationStatus(supabase, user.id, loaded) });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST /api/attempts/[attemptId]/evaluation — evaluates a FINALIZED attempt once (Gemini), scores it
 * deterministically, and completes it. Idempotent and duplicate-safe: a completed attempt returns its stored result,
 * a concurrent request returns `pending`. `{mode: "basic"}` (authored feedback) is accepted only after a failure.
 * The explanation is never logged.
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const { attemptId } = await params;
    const { supabase, user } = await requireApiUser();
    const { mode } = await parseBody(request, bodySchema);
    await requireOnboardedProgressProfile(supabase, user.id);
    return json({ evaluation: await evaluateAttempt(supabase, user.id, attemptId, mode) });
  } catch (e) {
    return errorResponse(e);
  }
}
