import type { ModuleKey } from "@/content/modules";
import type { ProgressSnapshot } from "@/lib/domain/progress";
import type { RewardsSummary } from "./server";

export interface ShelfBadge {
  awardedAt: string;
  moduleScore?: number;
  maxScore?: number;
}

/**
 * Earned badges for display: the stored `badges` rows when readable; otherwise the completed module runs from the
 * progress snapshot (the badge is awarded at exactly that moment by the database trigger, so both agree).
 */
export function earnedBadges(
  rewards: RewardsSummary,
  snapshot: ProgressSnapshot | null,
): Partial<Record<ModuleKey, ShelfBadge>> {
  if (rewards.available) return rewards.badges;
  const out: Partial<Record<ModuleKey, ShelfBadge>> = {};
  if (!snapshot) return out;
  for (const [key, r] of Object.entries(snapshot.modules) as [
    ModuleKey,
    ProgressSnapshot["modules"][ModuleKey],
  ][]) {
    if (r.badgeEarnedAt)
      out[key] = { awardedAt: r.badgeEarnedAt, moduleScore: r.points, maxScore: r.maxPoints };
  }
  return out;
}
