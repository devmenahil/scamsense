import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

/** Public header (landing, playbook, auth). */
export function MarketingHeader({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-mist bg-white/95 backdrop-blur-sm">
      <div className="container-page flex h-16 items-center justify-between gap-3 sm:h-[4.5rem]">
        <Link href="/" aria-label="ScamSense home" className="rounded-tile p-1">
          <Logo />
        </Link>
        {!minimal && (
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <ul className="hidden items-center gap-1 md:flex">
              <li>
                <Link
                  href="/#journey"
                  className="inline-flex min-h-11 items-center rounded-pill px-3.5 font-heading font-extrabold text-teal/85 hover:bg-mist hover:text-teal"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link
                  href="/playbook"
                  className="inline-flex min-h-11 items-center rounded-pill px-3.5 font-heading font-extrabold text-teal/85 hover:bg-mist hover:text-teal"
                >
                  Recovery Playbook
                </Link>
              </li>
            </ul>
            <Link
              href="/sign-in"
              className="inline-flex min-h-11 items-center rounded-pill px-3 font-heading font-extrabold text-teal hover:bg-mist"
            >
              Sign in
            </Link>
            <div className="hidden sm:block">
              <ButtonLink href="/sign-up" variant="secondary" size="sm">
                Start Training
              </ButtonLink>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
