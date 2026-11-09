import { ApiError, dbError, errorResponse, json, parseBody, requireApiUser } from "@/lib/api/server";
import {
  draftToRow,
  inputToRow,
  PROFILE_COLUMNS,
  rowToProfile,
  type ProfileRow,
} from "@/lib/profile/mapping";
import { profileDraftSchema, profileInputSchema } from "@/lib/profile/schema";

/**
 * /api/profile — the signed-in user's own profile.
 *
 * Ownership: the row is always selected by the session's user id (never an id from the request), AND Row Level
 * Security restricts every query to `auth.uid() = user_id`. A request cannot address another user's profile.
 * Request bodies are `.strict()` Zod schemas, so unknown keys such as `user_id` or `onboarding_completed` are
 * rejected rather than ignored.
 */

export async function GET() {
  try {
    const { supabase, user } = await requireApiUser();
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle<ProfileRow>();
    if (error) throw dbError(error);
    if (!data)
      throw new ApiError(404, "not_found", "We couldn't find your profile. Please sign out and back in.");
    return json({ profile: rowToProfile(data) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Saves onboarding steps 1–2 as the user moves forward, so a refresh or later sign-in resumes where they left off. */
export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const draft = await parseBody(request, profileDraftSchema);
    return await update(supabase, user.id, draftToRow(draft));
  } catch (e) {
    return errorResponse(e);
  }
}

/** Saves the complete profile: finishing onboarding, or edits on My Profile. Marks onboarding as completed. */
export async function PUT(request: Request) {
  try {
    const { supabase, user } = await requireApiUser();
    const input = await parseBody(request, profileInputSchema);
    return await update(supabase, user.id, inputToRow(input));
  } catch (e) {
    return errorResponse(e);
  }
}

async function update(
  supabase: Awaited<ReturnType<typeof requireApiUser>>["supabase"],
  userId: string,
  row: Record<string, unknown>,
) {
  if (Object.keys(row).length === 0) throw new ApiError(400, "validation", "There's nothing to save.");
  const { data, error } = await supabase
    .from("profiles")
    .update(row)
    .eq("user_id", userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle<ProfileRow>();
  if (error) throw dbError(error);
  if (!data)
    throw new ApiError(404, "not_found", "We couldn't find your profile. Please sign out and back in.");
  return json({ profile: rowToProfile(data) });
}
