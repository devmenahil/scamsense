import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * GET /auth/confirm — landing point for Supabase email links (sign-up confirmation and password reset).
 * Supports both the PKCE `?code=` flow and the `?token_hash=&type=` flow. On success the session cookie is set and
 * the user continues to `next` (same-site paths only). On failure they land on sign-in with a calm notice.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  let next = safeNextPath(url.searchParams.get("next"), "/onboarding");
  if (type === "recovery") next = "/reset-password";

  try {
    const supabase = await createSupabaseServerClient();
    let ok = false;
    if (code) {
      ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
    } else if (tokenHash && type && OTP_TYPES.includes(type)) {
      ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
    }
    if (ok) return NextResponse.redirect(new URL(next, request.url));
  } catch {
    // Fall through to the friendly notice.
  }
  return NextResponse.redirect(new URL("/sign-in?notice=link_invalid", request.url));
}
