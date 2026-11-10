import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import type { ModuleKey } from "@/content/modules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getModuleRewards, loadRewards, type ModuleRewardState, type RewardsSummary } from "./server";

/** For app pages (after the page's own auth/onboarding check): the signed-in user's badges and certificates. */
export const getCurrentRewards = cache(async (): Promise<RewardsSummary> => {
  const user = await getCurrentUser();
  if (!user) return { available: false };
  try {
    return await loadRewards(await createSupabaseServerClient(), user.id);
  } catch {
    return { available: false };
  }
});

/** For the completion page: one module's certificate, badge, and email status. */
export const getCurrentModuleRewards = cache(async (moduleKey: ModuleKey): Promise<ModuleRewardState> => {
  const user = await getCurrentUser();
  if (!user) return { status: "unavailable" };
  try {
    return await getModuleRewards(await createSupabaseServerClient(), user.id, moduleKey);
  } catch {
    return { status: "unavailable" };
  }
});
