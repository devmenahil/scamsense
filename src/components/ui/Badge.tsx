import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Pill label (Brand guide: pill bars). Meaning is carried by the text (and optional icon), never by colour alone.
 * Yellow is reserved for the one highlight per screen.
 */
export type BadgeTone = "teal" | "mist" | "outline" | "yellow" | "on-dark";

const tones: Record<BadgeTone, string> = {
  teal: "bg-teal text-white border-teal",
  mist: "bg-mist text-teal border-mist",
  outline: "bg-white text-teal border-teal",
  yellow: "bg-yellow text-teal-shade border-yellow-shade",
  "on-dark": "bg-teal-shade text-white border-white/40",
};

export function Badge({
  tone = "mist",
  icon,
  wrap = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  /** Allow long labels to wrap onto a second line instead of truncating. */
  wrap?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 border-2 px-3 py-0.5 font-heading text-caption font-extrabold",
        wrap ? "rounded-card" : "rounded-pill whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {icon}
      <span className={wrap ? "min-w-0" : "truncate"}>{children}</span>
    </span>
  );
}
