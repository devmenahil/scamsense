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

export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
