import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Logo } from "@/components/brand/Logo";
import { DesktopNav, MobileBottomNav } from "@/components/layout/AppNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TrainingIndicator } from "@/components/layout/TrainingIndicator";
import { requireUser } from "@/lib/auth/session";

/**
 * Authenticated app shell. middleware.ts redirects signed-out and not-onboarded users before anything renders; this
 * layout re-checks the session on the server as a second guard, so private content never renders without one.
 * Desktop: header with full navigation. Below 1024px: compact header + fixed bottom navigation.
 */
/** Every authenticated page is per-user: never prerender or cache it at build time. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <header className="sticky top-0 z-30 border-b-2 border-mist bg-white/95 backdrop-blur-sm">
        <div className="container-page flex h-16 items-center justify-between gap-2 sm:h-[4.5rem] sm:gap-4">
          <Link href="/dashboard" aria-label="ScamSense dashboard" className="rounded-tile p-1">
            <Logo />
          </Link>
          <DesktopNav />
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Visibility is controlled by wrappers so it never competes with the component's own display class. */}
            <div className="hidden sm:block lg:hidden 2xl:block">
              <TrainingIndicator />
            </div>
            <div className="sm:hidden">
              <TrainingIndicator compact />
            </div>
            <SignOutButton compact />
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      {/* Bottom padding keeps the footer clear of the fixed mobile navigation. */}
      <SiteFooter className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0" />
      <MobileBottomNav />
    </>
  );
}
