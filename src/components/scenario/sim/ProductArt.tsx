import type { PRODUCT_ART } from "@/content/scenarios/schema";
import { cn } from "@/lib/cn";

/** Safe, fictional product illustrations (inline SVG, brand tokens only — no photos, no real products). */
export function ProductArt({ art, className }: { art: (typeof PRODUCT_ART)[number]; className?: string }) {
  const common = "fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]";
  return (
    <div
      className={cn(
        "flex aspect-[4/3] items-center justify-center rounded-tile bg-mist text-teal",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 48" className={cn("w-3/5", common)}>
        {art.startsWith("laptop") && (
          <>
            <rect
              x={art === "laptop_wide" ? 8 : 12}
              y="8"
              width={art === "laptop_wide" ? 48 : 40}
              height="26"
              rx="3"
            />
            <rect
              x={art === "laptop_wide" ? 12 : 16}
              y="12"
              width={art === "laptop_wide" ? 40 : 32}
              height="18"
              rx="1.5"
              className={art === "laptop_slim" ? "fill-white" : "fill-yellow-tint"}
            />
            <path d={art === "laptop_wide" ? "M4 38h56l-3 4H7z" : "M8 38h48l-3 4H11z"} />
          </>
        )}
        {art === "camera" && (
          <>
            <rect x="8" y="14" width="48" height="28" rx="4" />
            <path d="M22 14l3-5h14l3 5" />
            <circle cx="32" cy="28" r="9" className="fill-yellow-tint" />
            <circle cx="32" cy="28" r="4" />
          </>
        )}
        {art === "headphones" && (
          <>
            <path d="M14 30v-6a18 18 0 0 1 36 0v6" />
            <rect x="10" y="28" width="9" height="14" rx="3" className="fill-yellow-tint" />
            <rect x="45" y="28" width="9" height="14" rx="3" className="fill-yellow-tint" />
          </>
        )}
        {art === "tablet" && (
          <>
            <rect x="16" y="6" width="32" height="38" rx="4" />
            <rect x="20" y="10" width="24" height="28" rx="1.5" className="fill-yellow-tint" />
            <circle cx="32" cy="41" r="1" />
          </>
        )}
      </svg>
    </div>
  );
}
