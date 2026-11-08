import { cn } from "@/lib/cn";

/**
 * ScamSense logo (Brand guide p.2): speech-bubble symbol with the yellow "nudge" dot + the ScamSense wordmark.
 * - light: teal bubble, yellow dot, teal wordmark (for white/mist backgrounds)
 * - dark:  yellow bubble, teal dot, white wordmark (for teal backgrounds)
 * Never stretched, recoloured, rotated or given effects. Full logo is ≥130px wide at every size used here;
 * below that use the symbol only.
 */
const BUBBLE_PATH =
  "M11 2H37A9 9 0 0 1 46 11V23A9 9 0 0 1 37 32H20L11.5 39.5V32H11A9 9 0 0 1 2 23V11A9 9 0 0 1 11 2Z";

type LogoVariant = "light" | "dark";

export function LogoSymbol({
  variant = "light",
  className,
  title,
}: {
  variant?: LogoVariant;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 42"
      className={cn("h-auto shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={BUBBLE_PATH} className={variant === "light" ? "fill-teal" : "fill-yellow"} />
      <circle cx="21" cy="16" r="6" className={variant === "light" ? "fill-yellow" : "fill-teal"} />
    </svg>
  );
}

const SIZES = {
  sm: { symbol: "w-8", text: "text-[1.375rem] leading-none", gap: "gap-2" }, // ≈ 145px wide
  md: { symbol: "w-10", text: "text-[1.75rem] leading-none", gap: "gap-2.5" },
  lg: { symbol: "w-14", text: "text-[2.5rem] leading-none", gap: "gap-3" },
} as const;

export function Logo({
  variant = "light",
  size = "sm",
  className,
}: {
  variant?: LogoVariant;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <LogoSymbol variant={variant} className={s.symbol} />
      <span
        className={cn(
          "font-heading font-extrabold tracking-[-0.01em]",
          s.text,
          variant === "light" ? "text-teal" : "text-white",
        )}
      >
        ScamSense
      </span>
    </span>
  );
}
