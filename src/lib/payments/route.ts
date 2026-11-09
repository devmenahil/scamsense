import "server-only";
import { requireApiUser } from "@/lib/api/server";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { loadAttempt, type LoadedAttempt } from "@/lib/scenario/server";
import type { PaymentActor } from "./server";

/**
 * Shared start of every checkout route: authenticate (Supabase Auth, 401 otherwise), require onboarding, and load the
 * caller's OWN attempt through RLS with an explicit user filter (another user's or an unknown attempt is a 404).
 * The user id comes only from the verified session, never from the request body.
 */
export async function checkoutContext(
  attemptId: string,
): Promise<{ actor: PaymentActor; loaded: LoadedAttempt }> {
  const { supabase, user } = await requireApiUser();
  const [profile, loaded] = await Promise.all([
    requireOnboardedProgressProfile(supabase, user.id),
    loadAttempt(supabase, user.id, attemptId),
  ]);
  return { actor: { supabase, userId: user.id, displayName: profile.displayName }, loaded };
}
