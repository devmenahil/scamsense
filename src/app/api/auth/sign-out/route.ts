import { errorResponse, json } from "@/lib/api/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** POST /api/auth/sign-out — ends the session and clears the auth cookies. Safe to call when already signed out. */
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    // "local" ends this browser's session only; other devices stay signed in.
    await supabase.auth.signOut({ scope: "local" });
    return json({ status: "signed_out" });
  } catch (e) {
    return errorResponse(e);
  }
}
