import { z } from "zod";
import { errorResponse, json, parseBody, requireApiUser } from "@/lib/api/server";
import { askKenshi } from "@/lib/kenshi/server";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";

export const maxDuration = 30;

const MAX_MESSAGE_CHARS = 500;

const bodySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Type a question for Sensei Kenshi.")
    .max(MAX_MESSAGE_CHARS, `Keep questions under ${MAX_MESSAGE_CHARS} characters.`),
  /** Bounded, untrusted recent turns (the conversation itself is not stored). */
  history: z
    .array(z.object({ role: z.enum(["user", "kenshi"]), text: z.string().max(1_500) }))
    .max(12)
    .default([]),
  /** A completed attempt to discuss. Ownership and completion are checked on the server. */
  attemptId: z.string().uuid().optional(),
});

/**
 * POST /api/chat — (Step 10) one Sensei Kenshi answer. The user comes from the verified session; an attemptId is only
 * honoured for the caller's own COMPLETED attempt (404 foreign/missing, 409 unfinished). Exactly one Gemini request
 * per call; 503/429 are friendly, retryable errors and nothing is fabricated.
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    await requireOnboardedProgressProfile(supabase, user.id);
    const body = await parseBody(request, bodySchema);
    return json(
      await askKenshi(supabase, user.id, {
        message: body.message,
        history: body.history.map((t) => ({ role: t.role, text: t.text.slice(0, 1_200) })),
        attemptId: body.attemptId,
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
