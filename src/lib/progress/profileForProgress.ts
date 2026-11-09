import "server-only";
import { ApiError, dbError } from "@/lib/api/server";
import type { Profile } from "@/lib/profile/schema";
import type { SupabaseServerClient } from "@/lib/supabase/server";

/** The profile fields gameplay routes need, read through RLS. Requires completed onboarding. */
export async function requireOnboardedProgressProfile(supabase: SupabaseServerClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, income_bracket, preferred_currency, onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle<{
      display_name: string | null;
      income_bracket: string | null;
      preferred_currency: string;
      onboarding_completed: boolean;
    }>();
  if (error) throw dbError(error);
  if (!data)
    throw new ApiError(404, "not_found", "We couldn't find your profile. Please sign out and back in.");
  if (!data.onboarding_completed) {
    throw new ApiError(403, "onboarding_required", "Please finish setting up your profile first.");
  }
  return {
    displayName: data.display_name,
    incomeBracket: data.income_bracket as Profile["incomeBracket"],
    preferredCurrency: data.preferred_currency,
  };
}
