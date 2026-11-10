import { MODULES, type ModuleKey } from "@/content/modules";
import { cn } from "@/lib/cn";
import { formatCompletionDate } from "@/lib/rewards/certificate";
import type { ShelfBadge } from "@/lib/rewards/earned";
import { ModuleBadge } from "./ModuleBadge";

/**
 * The three module badges side by side (dashboard, profile, certificates page). `earned` comes from the stored
 * `badges` rows (or, if those can't be read, from completed module runs — the same moment by construction).
 */
export function BadgeShelf({
  earned,
  size = "md",
  showDetails = true,
  className,
}: {
  earned: Partial<Record<ModuleKey, ShelfBadge>>;
  size?: "sm" | "md";
  showDetails?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-3 gap-3 sm:gap-4", className)} aria-label="Module badges">
      {MODULES.map((m) => {
        const b = earned[m.key];
        return (
          <li key={m.key} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <ModuleBadge badgeKey={m.badgeKey} earned={!!b} size={size} />
            <span className="font-heading text-small leading-tight font-extrabold">{m.badgeName}</span>
            <span className="text-caption text-teal/85">
              {b ? (
                <>
                  Earned<span className="sr-only"> for finishing {m.title}</span>
                  {showDetails && <span className="block">{formatCompletionDate(b.awardedAt)}</span>}
                </>
              ) : (
                <>
                  Not earned yet
                  <span className="sr-only">
                    : finish Module {m.order}, {m.title}
                  </span>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
