import { ApiError, errorResponse, json, parseBody } from "@/lib/api/server";
import { friendlyAuthError } from "@/lib/auth/errors";
import { signInSchema } from "@/lib/auth/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** POST /api/auth/sign-in — email/password sign-in. Sets the Supabase session cookies on success. */
export async function POST(request: Request) {
  try {
    const input = await parseBody(request, signInSchema);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(input);
    if (error) {
      const f = friendlyAuthError(error, "sign-in");
      throw new ApiError(f.status, f.code, f.message);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("user_id", data.user.id)
      .maybeSingle();
    return json({ onboarded: profile?.onboarding_completed === true });
  } catch (e) {
    return errorResponse(e);
  }
}
