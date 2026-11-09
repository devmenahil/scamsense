import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/server";
import { getCurrentUser, requireOnboardedProfile } from "@/lib/auth/session";
import { loadAttempt, viewFor } from "@/lib/scenario/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ScenarioPlayer } from "@/components/scenario/player/ScenarioPlayer";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { ProgressUnavailable } from "@/components/dashboard/ProgressUnavailable";

export const metadata: Metadata = { title: "Scenario" };
// Per-user, per-attempt page: always rendered on request.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ attemptId: string }> };

/**
 * The immersive scenario player for one of the user's own attempts. The page renders the client-safe view only
 * (no answer key, R10); everything after this goes through /api/attempts/[id]/*. Another user's attempt is a 404.
 */
export default async function PlayPage({ params }: Props) {
  const { attemptId } = await params;
  const profile = await requireOnboardedProfile(`/play/${attemptId}`);
  if (profile.status !== "ok") return <ProfileUnavailable reason={profile.status} />;
  const user = await getCurrentUser();
  if (!user) notFound();

  let view;
  try {
    const supabase = await createSupabaseServerClient();
    view = viewFor(await loadAttempt(supabase, user.id, attemptId), profile.profile.displayName);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    return (
      <div className="container-page py-8 sm:py-12">
        <ProgressUnavailable href={`/play/${attemptId}`} />
      </div>
    );
  }
  return <ScenarioPlayer initialView={view} />;
}
