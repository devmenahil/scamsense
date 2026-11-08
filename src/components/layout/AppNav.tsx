"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { APP_NAV, isActive } from "@/lib/navigation";
import { Icon } from "@/components/icons/Icon";

/** Desktop (≥1024px) horizontal navigation inside the app header. */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {APP_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-11 items-center gap-2 rounded-pill px-3.5 py-2 font-heading text-[0.9375rem] font-extrabold transition-colors duration-150",
                  active ? "bg-mist text-teal" : "text-teal/85 hover:bg-mist hover:text-teal",
                )}
              >
                <Icon name={item.icon} accent={active} className="size-5" />
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-4 -bottom-[9px] h-1 rounded-pill bg-teal"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mobile/tablet (<1024px) fixed bottom navigation: full access to every primary destination. */
export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-teal bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {APP_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 font-heading text-[0.75rem] leading-none font-extrabold",
                  active ? "text-teal" : "text-teal/80 hover:text-teal",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-12 items-center justify-center rounded-pill transition-colors",
                    active ? "bg-mist" : "",
                  )}
                >
                  <Icon name={item.icon} accent={active} className="size-5" />
                </span>
                <span className="max-w-full truncate">{item.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
