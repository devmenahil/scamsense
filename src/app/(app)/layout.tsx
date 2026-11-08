import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { DesktopNav, MobileBottomNav } from "@/components/layout/AppNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TrainingIndicator } from "@/components/layout/TrainingIndicator";

/**
 * Authenticated app shell. Phase 1: no auth yet — route protection (middleware + requireUser) arrives in Phase 2.
 * Desktop: header with full navigation. Below 1024px: compact header + fixed bottom navigation.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b-2 border-mist bg-white/95 backdrop-blur-sm">
        <div className="container-page flex h-16 items-center justify-between gap-4 sm:h-[4.5rem]">
          <Link href="/dashboard" aria-label="ScamSense dashboard" className="rounded-tile p-1">
            <Logo />
          </Link>
          <DesktopNav />
          {/* Visibility is controlled by wrappers so it never competes with the component's own display class. */}
          <div className="hidden sm:block lg:hidden xl:block">
            <TrainingIndicator />
          </div>
          <div className="sm:hidden">
            <TrainingIndicator compact />
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
