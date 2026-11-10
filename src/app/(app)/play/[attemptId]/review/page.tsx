import type { Metadata } from "next";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { ApiError } from "@/lib/api/server";
import { getCurrentUser, requireOnboardedProfile } from "@/lib/auth/session";
import { loadReview, NotCompletedError } from "@/lib/review/server";
import type { ReviewView } from "@/lib/review/view";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProgressUnavailable } from "@/components/dashboard/ProgressUnavailable";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { Icon } from "@/components/icons/Icon";
import { PostScenarioNav } from "@/components/review/PostScenarioNav";
import { RevealExperience } from "@/components/review/RevealExperience";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Reveal the Red Flags" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ attemptId: string }> };

/**
 * Reveal the Red Flags (Step 9, R15–R16). Only for the owner's COMPLETED attempt (unfinished → back to the player,
 * foreign → 404). Renders stored data only: no Gemini call, no PayPal call, no writes. Originals and replays each
 * review their own attempt.
 */
export default async function ReviewPage({ params }: Props) {
  const { attemptId } = await params;
  const profile = await requireOnboardedProfile(`/play/${attemptId}/review`);
  if (profile.status !== "ok") return <ProfileUnavailable reason={profile.status} />;
  const user = await getCurrentUser();
  if (!user) notFound();

  let review: ReviewView;
  try {
    const supabase = await createSupabaseServerClient();
    review = await loadReview(supabase, user.id, attemptId, profile.profile.displayName);
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof NotCompletedError) redirect(`/play/${attemptId}`);
    if (e instanceof ApiError && e.status === 404) notFound();
    return (
      <div className="container-page py-8 sm:py-12">
        <ProgressUnavailable href={`/play/${attemptId}/review`} />
      </div>
    );
  }

  const legit = review.scamStatus === "legitimate";
  return (
    <div className="container-page py-8 sm:py-12">
      <PageHeader
        eyebrow={`Module ${review.module.order} · ${review.module.title} · Debrief`}
        title={`Reveal the Red Flags: ${review.title}`}
        actions={
          review.isPractice ? (
            <Badge tone="outline" icon={<Icon name="target" className="size-3.5" />}>
              Practice attempt {review.attemptNumber}
            </Badge>
          ) : undefined
        }
      />
      <PostScenarioNav
        attemptId={review.attemptId}
        moduleKey={review.module.key}
        current="review"
        scenarioTitle={review.title}
        isPractice={review.isPractice}
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card as="section" className="lg:col-span-2" aria-labelledby="truth-heading">
          <p className="label-eyebrow text-teal/80">What this scenario really was</p>
          <h2 id="truth-heading" className="mt-1 text-subheading font-bold">
            {legit ? "A genuine situation" : "A scam"}
          </h2>
          <p className="mt-2 text-teal/90">
            {legit
              ? "This was a legitimate sale. Some details were worth checking, and the positive evidence shows why going ahead through the marketplace checkout was reasonable. Unfamiliar doesn't mean fraudulent."
              : "This was a scam. The numbered markers show the warning signs, the details worth checking, and where you could have verified things yourself. Not every marked detail proves fraud on its own: the label on each one says how much it tells you."}
          </p>
          <p className="mt-3 flex items-start gap-2 text-small">
            <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-semibold">Your decision: </span>
              {review.decision.summary}
              {review.decision.correct ? " (the appropriate decision)." : " (not the safest decision here)."}
            </span>
          </p>
        </Card>
        <FeedbackBanner tone="info" title="Review mode">
          You&apos;re looking back at your completed scenario. Your decision, explanation, payments, score,
          and progress can&apos;t change here.
        </FeedbackBanner>
      </div>

      {review.unsupportedAssumptions.length > 0 && (
        <Card tone="mist" as="section" className="mt-5" aria-labelledby="assumptions-heading">
          <h2 id="assumptions-heading" className="font-heading text-lg font-extrabold">
            Assumptions in your reasoning
          </h2>
          <p className="mt-1 text-caption">From your feedback. They don&apos;t change the evidence below.</p>
          <ul className="mt-2 list-disc pl-5 text-small">
            {review.unsupportedAssumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6">
        <RevealExperience review={review} />
      </div>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <ButtonLink
          href={`/play/${review.attemptId}/playbook`}
          size="lg"
          iconRight={<Icon name="arrow-right" className="size-5" />}
        >
          Your Recovery Playbook
        </ButtonLink>
        <ButtonLink href={`/play/${review.attemptId}/results`} variant="secondary">
          Back to results
        </ButtonLink>
      </div>
    </div>
  );
}
