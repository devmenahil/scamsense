import { cn } from "@/lib/cn";
import type { ModuleDefinition } from "@/content/modules";

/**
 * ScamSense module badge (Step 11): a rosette in the brand style (circles, 2px teal outline, ONE yellow fill) with a
 * distinct emblem per module. Earned: white disc, yellow inner ring, teal ribbons. Not earned: flat mist disc, dashed
 * outline, lock emblem. The accessible name always says the badge name and whether it is earned (never colour alone).
 * These are ScamSense learning badges, not PayPal awards.
 */
type BadgeKey = ModuleDefinition["badgeKey"];

const SIZES = { sm: "w-14", md: "w-20", lg: "w-28" } as const;

function Emblem({ badgeKey }: { badgeKey: BadgeKey }) {
  const stroke = {
    className: "stroke-teal",
    strokeWidth: 3,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (badgeKey) {
    case "scam-spotter": // an eye: noticing the warning signs
      return (
        <g>
          <path d="M28 48c6-9 13-13 20-13s14 4 20 13c-6 9-13 13-20 13s-14-4-20-13Z" {...stroke} />
          <circle cx="48" cy="48" r="5.5" className="fill-teal" />
        </g>
      );
    case "fraud-detective": // a magnifying glass: investigating
      return (
        <g>
          <circle cx="44" cy="44" r="11" {...stroke} />
          <path d="m52 52 11 11" {...stroke} strokeWidth={4} />
        </g>
      );
    case "scamsense-guardian": // a shield with a tick: protecting
      return (
        <g>
          <path d="M48 29 64 35v11c0 10-7 18-16 21-9-3-16-11-16-21V35l16-6Z" {...stroke} />
          <path d="m41 47 5 5 9-10" {...stroke} />
        </g>
      );
  }
}

export function ModuleBadge({
  badgeKey,
  earned,
  size = "md",
  label,
  className,
}: {
  badgeKey: BadgeKey;
  earned: boolean;
  size?: keyof typeof SIZES;
  /** Accessible name, e.g. "Scam Spotter badge: earned". Omit when the visible text already says it. */
  label?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 112"
      className={cn("h-auto shrink-0", SIZES[size], className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {earned && (
        <g className="fill-teal">
          <path d="M30 80 22 108l12-6 8 10 8-26Z" />
          <path d="M66 80l8 28-12-6-8 10-8-26Z" />
        </g>
      )}
      {earned ? (
        <>
          <circle cx="48" cy="48" r="44" className="fill-white stroke-teal" strokeWidth={3} />
          <circle cx="48" cy="48" r="35" className="fill-yellow stroke-teal" strokeWidth={2} />
          <circle cx="48" cy="48" r="26" className="fill-white stroke-teal" strokeWidth={2} />
          <Emblem badgeKey={badgeKey} />
        </>
      ) : (
        <>
          <circle
            cx="48"
            cy="48"
            r="44"
            className="fill-mist stroke-teal/45"
            strokeWidth={2.5}
            strokeDasharray="6 6"
          />
          {/* lock */}
          <rect
            x="37"
            y="46"
            width="22"
            height="17"
            rx="4"
            className="fill-none stroke-teal"
            strokeWidth={3}
          />
          <path d="M41 46v-5a7 7 0 0 1 14 0v5" className="fill-none stroke-teal" strokeWidth={3} />
        </>
      )}
    </svg>
  );
}
