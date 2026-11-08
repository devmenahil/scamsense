import Link from "next/link";
import { cn } from "@/lib/cn";
import { FOOTER_NAV } from "@/lib/navigation";
import { Logo } from "@/components/brand/Logo";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("on-dark mt-auto bg-teal text-white", className)}>
      <div className="container-page flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo variant="dark" />
          <p className="mt-3 font-heading text-lg font-extrabold">Pause. Check. Verify. Then Pay.</p>
          <p className="mt-2 text-small text-white/90">
            ScamSense is an educational simulator. Every scenario is fictional. It does not detect fraud in
            real messages, access real accounts, or move real money. Payments run in PayPal Sandbox only.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-col gap-1">
            {FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center font-heading font-bold underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/25">
        <p className="container-page py-4 text-caption text-white/85">
          PayPal AI Hackathon project · For adults 18+ · No real passwords, codes, or card numbers are ever
          needed.
        </p>
      </div>
    </footer>
  );
}
