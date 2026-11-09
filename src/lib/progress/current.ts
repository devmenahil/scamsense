import "server-only";
import { cache } from "react";
import { getCurrentUser, requireOnboardedProfile } from "@/lib/auth/session";
import type { ProgressSnapshot } from "@/lib/domain/progress";
import type { Profile } from "@/lib/profile/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadProgressSnapshot } from "./server";

export type ProgressPageResult =
  | { status: "ok"; profile: Profile; snapshot: ProgressSnapshot }
  /** Profile loaded but progress couldn't be read (e.g. the Phase 3 migration isn't applied yet). */
  | { status: "progress_unavailable"; profile: Profile }
  | { status: "missing" }
  | { status: "error" };

/** For app pages: session + onboarded profile + progress snapshot, deduplicated per request. */
export const getCurrentProgress = cache(async (next: string): Promise<ProgressPageResult> => {
  const profileResult = await requireOnboardedProfile(next);
  if (profileResult.status !== "ok") return profileResult;
  const user = await getCurrentUser();
  if (!user) return { status: "missing" };
  try {
    const supabase = await createSupabaseServerClient();
    const snapshot = await loadProgressSnapshot(supabase, user.id, profileResult.profile);
    return { status: "ok", profile: profileResult.profile, snapshot };
  } catch {
    // dbError() has already logged the code (no personal data).
    return { status: "progress_unavailable", profile: profileResult.profile };
  }
});
