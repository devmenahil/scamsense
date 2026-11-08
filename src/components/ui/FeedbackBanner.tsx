import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/Icon";

/**
 * Brand feedback banners (Brand guide p.3 and p.5), never red or green:
 * - "success": teal + tick ("Nice catch!")
 * - "look-again": yellow tint + flag ("Look again.")
 * - "info": mist + info icon (neutral notices)
 * The title words and the icon carry the meaning; colour only reinforces it.
 */
export type FeedbackTone = "success" | "look-again" | "info";

const tones: Record<FeedbackTone, { box: string; icon: "check" | "flag" | "info" }> = {
  success: { box: "on-dark bg-teal border-teal text-white shadow-edge-shade", icon: "check" },
  "look-again": {
    box: "bg-yellow-tint border-yellow-shade text-teal-shade shadow-edge-yellow",
    icon: "flag",
  },
  info: { box: "bg-mist border-mist text-teal", icon: "info" },
};

export function FeedbackBanner({
  tone,
  title,
  children,
  className,
  live = false,
}: {
  tone: FeedbackTone;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Announce politely when the banner appears in response to a user action. */
  live?: boolean;
}) {
  const t = tones[tone];
  return (
    <div
      role={live ? "status" : undefined}
      className={cn("flex items-start gap-3 rounded-card border-2 px-4 py-3", t.box, className)}
    >
      <Icon name={t.icon} accent={tone === "look-again"} className="mt-0.5 size-5" />
      <p className="min-w-0">
        <strong className="font-heading font-extrabold">{title}</strong>
        {children && <span> {children}</span>}
      </p>
    </div>
  );
}
