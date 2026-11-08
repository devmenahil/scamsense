import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons/Icon";

/**
 * Reveal-mode evidence classifications (R16). Each one has its own icon AND words, so the meaning never depends
 * on colour. Yellow marks red flags, matching the brand rule that yellow carries "red flag" markers.
 */
export type EvidenceClass = "red_flag" | "verify" | "positive";

export const EVIDENCE_META: Record<
  EvidenceClass,
  { label: string; icon: IconName; description: string; marker: string }
> = {
  red_flag: {
    label: "Red flag",
    icon: "flag",
    description: "A warning sign.",
    marker: "bg-yellow border-yellow-shade text-teal-shade",
  },
  verify: {
    label: "Worth verifying",
    icon: "search",
    description: "Not proof of fraud on its own, but worth checking through a channel you trust.",
    marker: "bg-white border-teal text-teal",
  },
  positive: {
    label: "Positive verification",
    icon: "check",
    description: "Evidence that supports legitimacy.",
    marker: "bg-teal border-teal text-white",
  },
};

export function EvidenceLabel({ kind, className }: { kind: EvidenceClass; className?: string }) {
  const meta = EVIDENCE_META[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border-2 px-2.5 py-0.5 font-heading text-caption font-extrabold whitespace-nowrap",
        meta.marker,
        className,
      )}
    >
      <Icon name={meta.icon} className="size-3.5" />
      {meta.label}
    </span>
  );
}

/** Numbered marker placed next to evidence inside the re-rendered environment. */
export function EvidenceMarker({ n, kind }: { n: number; kind: EvidenceClass }) {
  const meta = EVIDENCE_META[kind];
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-pill border-2 font-heading text-caption font-black",
        meta.marker,
      )}
    >
      <span className="sr-only">Evidence </span>
      {n}
      <span className="sr-only">: {meta.label}</span>
    </span>
  );
}
