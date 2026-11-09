import { ApiError, appOrigin, errorResponse, json, parseBody } from "@/lib/api/server";
import { friendlyAuthError } from "@/lib/auth/errors";
import { forgotPasswordSchema } from "@/lib/auth/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/forgot-password — asks Supabase to email a password-reset link. The response is the same whether
 * or not the email has an account, so the form cannot be used to discover who is registered.
 */
export async function POST(request: Request) {
  try {
    const { email } = await parseBody(request, forgotPasswordSchema);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appOrigin(request)}/auth/confirm?next=/reset-password`,
    });
    if (error) {
      const f = friendlyAuthError(error, "reset");
      // Only surface failures that the user can act on; anything else looks like success.
      if (f.status === 429 || f.status === 503) throw new ApiError(f.status, f.code, f.message);
      console.error("[auth] reset request failed", { code: error.code });
    }
    return json({ status: "sent" });
  } catch (e) {
    return errorResponse(e);
  }
}
