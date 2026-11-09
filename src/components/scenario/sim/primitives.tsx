"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { DecisionContent } from "@/content/scenarios/schema";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons/Icon";
import { anchor, useSim } from "./SimContext";

/**
 * Small building blocks shared by the simulated apps. In-simulation controls deliberately look like the fictional
 * app's own UI (compact, squarer, no ScamSense 3D edge) so the simulation never resembles a quiz (R8).
 */

export function SimButton({
  variant = "outline",
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "quiet";
  icon?: IconName;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-tile px-3 text-small font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variant === "solid" && "border-2 border-teal-shade bg-teal-shade text-white hover:bg-teal",
        variant === "outline" && "border-2 border-teal/35 bg-white text-teal hover:border-teal hover:bg-mist",
        variant === "quiet" && "border-2 border-transparent text-teal hover:bg-mist",
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </button>
  );
}

const DECISION_ICONS: Record<DecisionContent["intent"], IconName> = {
  pay: "wallet",
  report: "report",
  decline: "close",
  share_code: "send",
  continue_on_site: "arrow-right",
  ship: "send",
  hold: "clock",
};

/** An environment-native control that opens the final-decision confirmation. */
export function DecisionButton({
  decision,
  variant = "outline",
  className,
  anchorId,
}: {
  decision: DecisionContent;
  variant?: "solid" | "outline" | "quiet";
  className?: string;
  anchorId?: string;
}) {
  const { decide, interactive } = useSim();
  return (
    <SimButton
      variant={variant}
      icon={DECISION_ICONS[decision.intent]}
      onClick={() => decide(decision.id)}
      disabled={!interactive}
      className={className}
      {...anchor(anchorId)}
    >
      {decision.label}
    </SimButton>
  );
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-pill bg-teal font-heading text-small font-black text-white",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function KvList({
  rows,
  className,
}: {
  rows: readonly { label: string; value: string; anchor?: string }[];
  className?: string;
}) {
  return (
    <dl
      className={cn("grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-small", className)}
    >
      {rows.map((r) => (
        <div key={r.label} className="contents" {...anchor(r.anchor)}>
          <dt className="font-semibold">{r.label}</dt>
          <dd className="min-w-0 break-words">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A back link used inside narrow (mobile) app layouts. */
export function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-pill px-2 font-heading text-small font-extrabold hover:bg-mist"
    >
      <Icon name="arrow-right" className="size-4 rotate-180" />
      {children}
    </button>
  );
}
