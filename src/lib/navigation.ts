import type { IconName } from "@/components/icons/Icon";

export interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the mobile bottom bar. */
  shortLabel: string;
  icon: IconName;
}

/** Primary authenticated navigation. Every entry must resolve to a real page (enforced by navigation.test.ts). */
export const APP_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: "home" },
  { href: "/modules", label: "Modules", shortLabel: "Modules", icon: "modules" },
  { href: "/sensei", label: "Sensei Kenshi", shortLabel: "Sensei", icon: "chat" },
  { href: "/certificates", label: "Certificates", shortLabel: "Awards", icon: "award" },
  { href: "/profile", label: "My Profile", shortLabel: "Profile", icon: "user" },
];

/** Secondary links shown in the footer on every page. */
export const FOOTER_NAV: readonly { href: string; label: string }[] = [
  { href: "/playbook", label: "Your Recovery Playbook" },
  { href: "/#journey", label: "How it works" },
  { href: "/sign-in", label: "Sign in" },
];

/**
 * The immersive scenario player (/play/[attemptId]). Sensei Kenshi must not be reachable from here (Step 10): the
 * player covers investigation, decision, justification, and checkout. Debrief pages (/play/[id]/results, /review,
 * /playbook) are only served for COMPLETED attempts and are not gameplay.
 */
export function isGameplayPath(pathname: string): boolean {
  return /^\/play\/[^/]+\/?$/.test(pathname);
}

/** Primary navigation for a path: everything, minus Sensei Kenshi on gameplay screens. */
export function navItemsFor(pathname: string): readonly NavItem[] {
  return isGameplayPath(pathname) ? APP_NAV.filter((i) => i.href !== "/sensei") : APP_NAV;
}

export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
