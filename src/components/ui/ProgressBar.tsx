import { cn } from "@/lib/cn";

/**
 * Accessible progress bar on a pill track. The value is always shown as text as well as visually.
 * tone="yellow" is the brand "progress & reward" style and counts as the screen's yellow highlight.
 */
export function ProgressBar({
  value,
  max,
  label,
  valueText,
  tone = "teal",
  showValue = true,
  className,
}: {
  value: number;
  max: number;
  label: string;
  /** Human-readable value, e.g. "1 of 2 scenarios". Defaults to "value / max". */
  valueText?: string;
  tone?: "teal" | "yellow";
  showValue?: boolean;
  className?: string;
}) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = Math.round((clamped / safeMax) * 100);
  const text = valueText ?? `${clamped} / ${safeMax}`;
  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-caption font-medium">{label}</span>
        {showValue && <span className="font-heading text-caption font-extrabold">{text}</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={text}
        className="h-3.5 w-full overflow-hidden rounded-pill border-2 border-teal bg-mist"
      >
        <div
          className={cn(
            "h-full rounded-pill transition-[width] duration-500 ease-out",
            tone === "yellow" ? "bg-yellow" : "bg-teal",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
