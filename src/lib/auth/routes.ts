/**
 * Route access rules (pure, unit-tested). Used by middleware.ts to decide redirects before any private content is
 * rendered. Server components and API routes re-check access themselves; middleware is never the only guard.
 */

/** Pages that require a signed-in user who has completed onboarding. */
const APP_PREFIXES = ["/dashboard", "/modules", "/play", "/profile", "/certificates", "/sensei"] as const;
/** Pages that require a signed-in user but not completed onboarding. */
const ONBOARDING_PATH = "/onboarding";
const RESET_PASSWORD_PATH = "/reset-password";
/** Pages for signed-out visitors; signed-in users are sent onward. */
const GUEST_ONLY = ["/sign-in", "/sign-up"] as const;

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export type RouteKind = "app" | "onboarding" | "reset-password" | "guest-only" | "public";

export function classifyRoute(pathname: string): RouteKind {
  if (APP_PREFIXES.some((p) => matches(pathname, p))) return "app";
  if (matches(pathname, ONBOARDING_PATH)) return "onboarding";
  if (matches(pathname, RESET_PASSWORD_PATH)) return "reset-password";
  if (GUEST_ONLY.some((p) => matches(pathname, p))) return "guest-only";
  return "public";
}

export interface AccessState {
  signedIn: boolean;
  /** null when unknown (e.g. the profile could not be read); unknown never causes a redirect loop. */
  onboarded: boolean | null;
  /** The request carried an auth cookie that no longer yields a valid session. */
  sessionExpired?: boolean;
}

/**
 * Returns the path to redirect to, or null to let the request through. Designed to be loop-free:
 * - signed-out users are only ever sent to /sign-in, which is always allowed for them;
 * - not-onboarded users are only ever sent to /onboarding, which is always allowed for them;
 * - onboarded users are only ever sent to /dashboard, which is always allowed for them.
 */
export function redirectFor(pathname: string, search: string, state: AccessState): string | null {
  const kind = classifyRoute(pathname);

  if (!state.signedIn) {
    if (kind === "app" || kind === "onboarding" || kind === "reset-password") {
      const params = new URLSearchParams({ next: `${pathname}${search}` });
      if (state.sessionExpired) params.set("notice", "expired");
      return `/sign-in?${params.toString()}`;
    }
    return null;
  }

  if (kind === "guest-only") return state.onboarded === false ? ONBOARDING_PATH : "/dashboard";
  if (kind === "app" && state.onboarded === false) return ONBOARDING_PATH;
  if (kind === "onboarding" && state.onboarded === true) return "/dashboard";
  return null;
}
