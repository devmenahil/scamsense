import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { classifyRoute, redirectFor } from "@/lib/auth/routes";
import { supabasePublicConfig } from "@/lib/env.schema";
import { publicEnv } from "@/lib/public-env";

/**
 * 1. Refreshes the Supabase session cookie on every request (session restoration after refresh, token rotation).
 * 2. Redirects before any private page renders: signed-out → /sign-in, not onboarded → /onboarding, signed-in on
 *    sign-in/up → onward. API routes are never redirected; they return 401 JSON themselves.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const kind = classifyRoute(pathname);
  const config = supabasePublicConfig(publicEnv);

  if (!config) {
    // Auth cannot work without Supabase. Keep private pages unreachable rather than showing them unprotected.
    if (kind === "app" || kind === "onboarding" || kind === "reset-password") {
      return NextResponse.redirect(new URL("/sign-in?notice=unavailable", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Do not run code between createServerClient and getClaims (Supabase SSR guidance).
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  if (pathname.startsWith("/api/") || kind === "public") return response;

  let onboarded: boolean | null = null;
  if (userId && kind !== "reset-password") {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("user_id", userId)
      .maybeSingle();
    // On a read error, `null` (unknown) lets the page itself render a calm error state instead of looping.
    onboarded = error ? null : profile ? profile.onboarding_completed : false;
  }

  const hadAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth"));
  const target = redirectFor(pathname, search, {
    signedIn: userId !== null,
    onboarded,
    sessionExpired: userId === null && hadAuthCookie,
  });
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  // Carry refreshed/cleared auth cookies onto the redirect.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
