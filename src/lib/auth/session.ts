import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { PROFILE_COLUMNS, rowToProfile, type ProfileRow } from "@/lib/profile/mapping";
import type { Profile } from "@/lib/profile/schema";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Server-side session helpers for Server Components. Deduplicated per request with React `cache`, so the layout and
 * the page share one Auth check and one profile read.
 */

/** The verified signed-in user (validated with the Supabase Auth server), or null. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export type ProfileResult = { status: "ok"; profile: Profile } | { status: "missing" } | { status: "error" };

/** The signed-in user's own profile. RLS guarantees no other row can be returned. */
export const getCurrentProfile = cache(async (): Promise<ProfileResult> => {
  const user = await getCurrentUser();
  if (!user) return { status: "missing" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();
  if (error) {
    console.error("[profile] read failed", { code: error.code });
    return { status: "error" };
  }
  return data ? { status: "ok", profile: rowToProfile(data) } : { status: "missing" };
});

/** Redirects to sign-in when there is no valid session. */
export async function requireUser(next = "/dashboard"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}

/**
 * For app pages: requires a session AND completed onboarding. Returns the profile result so the page can render a
 * calm error state (instead of looping redirects) when the profile cannot be read.
 */
export async function requireOnboardedProfile(next = "/dashboard"): Promise<ProfileResult> {
  await requireUser(next);
  const result = await getCurrentProfile();
  if (result.status === "ok" && !result.profile.onboardingCompleted) redirect("/onboarding");
  return result;
}
