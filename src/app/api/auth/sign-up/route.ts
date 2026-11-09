import { ApiError, appOrigin, errorResponse, json, parseBody } from "@/lib/api/server";
import { DUPLICATE_EMAIL_MESSAGE, friendlyAuthError } from "@/lib/auth/errors";
import { signUpSchema } from "@/lib/auth/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/sign-up — creates a Supabase Auth account (Supabase stores and hashes the password).
 * The display name, optional age bracket, and the 18+ confirmation travel as sign-up metadata; the database trigger
 * `handle_new_user` creates the profile row and rejects the sign-up if the confirmation is missing.
 */
export async function POST(request: Request) {
  try {
    const input = await parseBody(request, signUpSchema);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${appOrigin(request)}/auth/confirm?next=/onboarding`,
        data: {
          display_name: input.displayName,
          age_bracket: input.ageBracket ?? null,
          age_confirmed: true,
        },
      },
    });

    if (error) {
      const f = friendlyAuthError(error, "sign-up");
      throw new ApiError(f.status, f.code, f.message, f.field ? { [f.field]: f.message } : undefined);
    }
    // With email confirmation on, Supabase hides duplicates by returning a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      throw new ApiError(409, "duplicate_email", DUPLICATE_EMAIL_MESSAGE, { email: DUPLICATE_EMAIL_MESSAGE });
    }

    return json({ status: data.session ? "signed_in" : "confirmation_required", next: "/onboarding" }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
