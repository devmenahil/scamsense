import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Brand icon set: 2px rounded outline on a 24px grid with at most ONE yellow-filled part (Brand guide p.5).
 * The yellow part only renders when `accent` is true; otherwise it is an outline in the current colour.
 * Icons are decorative by default (aria-hidden). Pass `label` when an icon carries meaning on its own.
 */
export type IconName =
  | "home"
  | "modules"
  | "chat"
  | "award"
  | "user"
  | "shield"
  | "flag"
  | "check"
  | "lock"
  | "mail"
  | "wallet"
  | "arrow-right"
  | "close"
  | "otp"
  | "phishing"
  | "invoice"
  | "marketplace"
  | "job"
  | "search"
  | "report"
  | "send"
  | "info"
  | "play"
  | "book"
  | "clock"
  | "sign-out"
  | "target";

type Part = (accentClass: string) => ReactNode;

const ICONS: Record<IconName, Part> = {
  home: (a) => (
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <rect x="9.5" y="14" width="5" height="6.5" rx="1.5" className={a} />
    </>
  ),
  modules: (a) => (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" className={a} />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  chat: (a) => (
    <>
      <path d="M5.5 4h13A2.5 2.5 0 0 1 21 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 3 14.5v-8A2.5 2.5 0 0 1 5.5 4z" />
      <circle cx="10" cy="10.5" r="2.25" className={a} />
    </>
  ),
  award: (a) => (
    <>
      <circle cx="12" cy="9" r="5.5" className={a} />
      <path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7" />
    </>
  ),
  user: (a) => (
    <>
      <circle cx="12" cy="8.5" r="4" className={a} />
      <path d="M4.5 20.5c.8-3.6 3.8-6 7.5-6s6.7 2.4 7.5 6" />
    </>
  ),
  shield: (a) => (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.4-2.9 7.9-7 9-4.1-1.1-7-4.6-7-9V6z" className={a} />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  flag: (a) => (
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h11.5l-2.5 4 2.5 4H6" className={a} />
    </>
  ),
  check: () => <path d="m5 12.5 4.5 4.5L19 7.5" />,
  lock: (a) => (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" className={a} />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  mail: (a) => (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7 7.5 6 7.5-6" />
      <circle cx="19" cy="6" r="2.5" className={a} />
    </>
  ),
  wallet: (a) => (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3" />
      <rect x="4" y="8" width="16" height="11.5" rx="2.5" />
      <circle cx="16" cy="13.75" r="1.75" className={a} />
    </>
  ),
  "arrow-right": () => (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  close: () => (
    <>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  otp: (a) => (
    <>
      <rect x="3.5" y="7" width="17" height="10" rx="3" />
      <circle cx="8" cy="12" r="1.25" className={a} />
      <circle cx="12" cy="12" r="1.25" className={a} />
      <circle cx="16" cy="12" r="1.25" className={a} />
    </>
  ),
  phishing: (a) => (
    <>
      <circle cx="12" cy="5" r="2" className={a} />
      <path d="M12 7v10.5a3.5 3.5 0 0 1-7 0V15" />
      <path d="M12 17.5a3.5 3.5 0 0 0 7 0V15" />
      <path d="M8.5 11h7" />
    </>
  ),
  invoice: (a) => (
    <>
      <path d="M6.5 3.5h11A1.5 1.5 0 0 1 19 5v15.5l-2.5-1.5-2 1.5-2.5-1.5-2.5 1.5-2-1.5L5 20.5V5a1.5 1.5 0 0 1 1.5-1.5z" />
      <rect x="9" y="8" width="6" height="5" rx="1" className={a} />
    </>
  ),
  marketplace: (a) => (
    <>
      <path d="M5 8.5h14l-1 11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5z" className={a} />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  job: (a) => (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <rect x="10" y="11.5" width="4" height="3" rx="1" className={a} />
    </>
  ),
  search: (a) => (
    <>
      <circle cx="10.5" cy="10.5" r="6" className={a} />
      <path d="m15 15 5 5" />
    </>
  ),
  report: (a) => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5" />
      <circle cx="12" cy="16" r="1.25" className={a} />
    </>
  ),
  send: (a) => (
    <>
      <path d="M4 11.5 20 4l-6.5 16-2.5-6.5z" className={a} />
      <path d="m11 13.5 4-4" />
    </>
  ),
  info: (a) => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.75" r="1.25" className={a} />
    </>
  ),
  play: (a) => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 8.5v7l5.5-3.5z" className={a} />
    </>
  ),
  book: (a) => (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13z" className={a} />
    </>
  ),
  clock: (a) => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
      <circle cx="12" cy="12" r="1" className={a} />
    </>
  ),
  target: (a) => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.75" />
      <circle cx="12" cy="12" r="1.5" className={a} />
    </>
  ),
  "sign-out": (a) => (
    <>
      <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14z" className={a} />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  /** Fill the icon's one accent part in brand yellow. */
  accent?: boolean;
  /** Accessible name. When omitted the icon is hidden from assistive technology. */
  label?: string;
  className?: string;
}

export function Icon({ name, accent = false, label, className }: IconProps) {
  const accentClass = accent ? "fill-yellow" : "";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(!className?.includes("size-") && "size-6", "shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {ICONS[name](accentClass)}
    </svg>
  );
}
