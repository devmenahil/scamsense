import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { getModule } from "@/content/modules";
import { ApiError } from "@/lib/api/server";
import { getCurrentUser, requireOnboardedProfile } from "@/lib/auth/session";
import { getEvaluationStatus } from "@/lib/evaluation/server";
import type { ResultsView } from "@/lib/evaluation/results";
import { loadAttempt } from "@/lib/scenario/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EvidenceLabel, type EvidenceClass } from "@/components/feedback/EvidenceLabel";
import { ProgressUnavailable } from "@/components/dashboard/ProgressUnavailable";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { Icon } from "@/components/icons/Icon";
import { LogoSymbol } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { PostScenarioNav } from "@/components/review/PostScenarioNav";

export const metadata: Metadata = { title: "Scenario results" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ attemptId: string }> };

const KIND: Record<string, EvidenceClass> = {
  red_flag: "red_flag",
  worth_verifying: "verify",
  positive_verification_evidence: "positive",
};

/**
 * Results of a COMPLETED attempt (Step 8): decision outcome, deterministic score, Gemini feedback on the learner's own
 * reasoning, and the separate witty comment. Reads stored data only (never calls Gemini). Unfinished attempts go back
 * to the player; another user's attempt is a 404. Reveal the Red Flags and the Recovery Playbook arrive in Step 9.
 */
export default async function ResultsPage({ params }: Props) {
  const { attemptId } = await params;
  const profile = await requireOnboardedProfile(`/play/${attemptId}/results`);
  if (profile.status !== "ok") return <ProfileUnavailable reason={profile.status} />;
  const user = await getCurrentUser();
  if (!user) notFound();

  let results: ResultsView | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const loaded = await loadAttempt(supabase, user.id, attemptId);
    if (loaded.attempt.state !== "COMPLETED") redirect(`/play/${attemptId}`);
    const status = await getEvaluationStatus(supabase, user.id, loaded);
    if (status.status === "complete") results = status.results;
  } catch (e) {
    unstable_rethrow(e); // let redirect()/notFound() through
    if (e instanceof ApiError && e.status === 404) notFound();
    return (
      <div className="container-page py-8 sm:py-12">
        <ProgressUnavailable href={`/play/${attemptId}/results`} />
      </div>
    );
  }
  if (!results) {
    return (
      <div className="container-page py-8 sm:py-12">
        <ProgressUnavailable href={`/play/${attemptId}/results`} />
      </div>
    );
  }
  return <Results r={results} />;
}

function Results({ r }: { r: ResultsView }) {
  const mod = getModule(r.moduleKey)!;
  const moduleHref = `/modules/${r.moduleKey}`;
  const ai = r.source === "gemini";
  const praiseTitle = r.decision.correct ? "Nice thinking!" : "Good effort. Let's look again together.";
  const spotted = r.recognized.length;
  return (
    <div className="container-page py-8 sm:py-12">
      <PageHeader
        eyebrow={`Module ${mod.order} · ${mod.title}`}
        title={`Your results: ${r.title}`}
        actions={
          r.isPractice ? (
            <Badge tone="outline" icon={<Icon name="target" className="size-3.5" />}>
              Practice attempt
            </Badge>
          ) : undefined
        }
      />
      <PostScenarioNav
        attemptId={r.attemptId}
        moduleKey={r.moduleKey}
        current="results"
        scenarioTitle={r.title}
        isPractice={r.isPractice}
      />

      {/* Praise first (R37). Meaning carried by words and icon, not colour. */}
      <FeedbackBanner
        tone={r.decision.correct ? "success" : "look-again"}
        title={praiseTitle}
        className="mt-6"
      >
        {spotted > 0
          ? `Your explanation pointed to ${spotted} piece${spotted === 1 ? "" : "s"} of evidence from this scenario.`
          : "Your decision is saved. Below is what the evidence showed and what to look for next time."}
      </FeedbackBanner>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" as="section" aria-labelledby="decision-heading">
          <p id="decision-heading" className="label-eyebrow text-teal/80">
            Your decision
          </p>
          <p className="mt-1 flex items-start gap-2 font-heading text-subheading font-bold">
            <Icon name={r.decision.correct ? "check" : "flag"} className="mt-1 size-5 shrink-0" />
            {r.decision.summary}
          </p>
          <p className="mt-2 font-heading font-extrabold">
            {r.decision.correct
              ? "This was the appropriate decision."
              : "This wasn't the safest decision here."}
          </p>
          <p className="mt-3 text-teal/90">{r.decision.outcome}</p>
        </Card>
        <Card tone="mist" as="section" aria-labelledby="score-heading">
          <p id="score-heading" className="label-eyebrow text-teal/80">
            {r.isPractice ? "Practice score" : "Score"}
          </p>
          {r.score ? (
            <>
              <p className="mt-1 font-heading text-[1.75rem] leading-9 font-black">
                {r.score.total} <span className="text-lg font-extrabold">/ {r.score.max}</span>
              </p>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-small">
                <dt>Decision</dt>
                <dd className="font-semibold">{r.score.decision} / 40</dd>
                <dt>Reasoning and evidence</dt>
                <dd className="font-semibold">{r.score.reasoning} / 30</dd>
                <dt>Verification</dt>
                <dd className="font-semibold">{r.score.verification} / 20</dd>
                <dt>Payment safety</dt>
                <dd className="font-semibold">{r.score.paymentSafety} / 10</dd>
              </dl>
              {r.isPractice && (
                <p className="mt-3 text-caption">
                  Practice scores never change your official score or progress.
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-small">Score unavailable.</p>
          )}
        </Card>
      </div>

      {r.payment && (
        <Card as="section" className="mt-5 flex items-start gap-3" aria-label="Training Funds impact">
          <Icon name="wallet" className="mt-0.5 size-6 shrink-0" />
          <p className="text-small">
            {r.payment.meaning === "fraud_loss"
              ? `In the story, the ${r.payment.amountText} you paid went to the scammer.`
              : `In the story, you spent ${r.payment.amountText} on the purchase.`}{" "}
            {r.payment.practice
              ? "This was a practice attempt, so your official Training Funds didn't change."
              : `It is recorded as ${r.payment.meaning === "fraud_loss" ? "lost to a scam" : "ordinary spending"} in your fictional Training Funds.`}{" "}
            The PayPal checkout used Sandbox test money only: no real money moved.
          </p>
        </Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" as="section" aria-labelledby="feedback-heading">
          <h2 id="feedback-heading" className="text-subheading font-bold">
            Feedback on your reasoning
          </h2>
          {!ai && (
            <p className="mt-2 flex items-start gap-2 text-caption">
              <Icon name="info" className="mt-0.5 size-4 shrink-0" />
              Basic feedback: written for this scenario in advance, with a simple keyword check of your
              explanation.
            </p>
          )}
          <p className="mt-3 whitespace-pre-line text-teal/90">{r.feedback.reasoning}</p>
          {r.feedback.unsupportedAssumptions.length > 0 && (
            <div className="mt-4">
              <h3 className="font-heading font-extrabold">Assumptions to double-check</h3>
              <ul className="mt-1 list-disc pl-5 text-small">
                {r.feedback.unsupportedAssumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          <h3 className="mt-5 font-heading font-extrabold">Your checking</h3>
          <p className="mt-1 text-small text-teal/90">{r.feedback.verification}</p>
          <h3 className="mt-4 font-heading font-extrabold">Payment behaviour</h3>
          <p className="mt-1 text-small text-teal/90">{r.feedback.payment}</p>
          <h3 className="mt-4 font-heading font-extrabold">Next time</h3>
          <p className="mt-1 text-small text-teal/90">{r.feedback.improvement}</p>
        </Card>

        {/* The humorous comment is a separate field, shown separately (R14). */}
        <Card tone="teal" as="aside" className="flex items-start gap-3 self-start">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-tile bg-white">
            <LogoSymbol className="w-7" />
          </span>
          <div>
            <p className="font-heading font-extrabold">{ai ? "Just for fun" : "A note from ScamSense"}</p>
            <p className="mt-1 text-small text-white/90">{r.humorousComment}</p>
          </div>
        </Card>
      </div>

      <section aria-labelledby="evidence-heading" className="mt-5 grid gap-5 lg:grid-cols-2">
        <h2 id="evidence-heading" className="sr-only">
          Evidence
        </h2>
        <Card as="div">
          <h3 className="font-heading text-lg font-extrabold">What you noticed</h3>
          <EvidenceList
            items={r.recognized}
            empty="Your explanation didn't point to specific evidence this time."
          />
        </Card>
        <Card as="div">
          <h3 className="font-heading text-lg font-extrabold">Worth a second look</h3>
          <EvidenceList items={r.missed} empty="You covered every key piece of evidence." />
        </Card>
      </section>

      <Card tone="mist" className="mt-5 flex items-start gap-3">
        <Icon name="shield" className="mt-0.5 size-6" />
        <div>
          <h2 className="font-heading text-lg font-extrabold">Remember</h2>
          <p className="mt-1 text-small">{r.feedback.takeaway}</p>
          <p className="mt-2 text-small">
            <span className="font-semibold">Safest next step: </span>
            {r.safestNextStep}
          </p>
        </div>
      </Card>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <Card tone="mist" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <IconTile name="flag" />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-extrabold">Reveal the Red Flags</h2>
            <p className="text-small text-teal/90">
              Revisit your scenario with every piece of evidence marked and explained.
            </p>
          </div>
        </Card>
        <Card tone="mist" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <IconTile name="book" />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-extrabold">Your Recovery Playbook</h2>
            <Link
              href={`/play/${r.attemptId}/playbook`}
              className="inline-flex min-h-11 items-center gap-1.5 font-heading font-extrabold underline decoration-2 underline-offset-4"
            >
              What you could do in real life
              <Icon name="arrow-right" className="size-4" />
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <ButtonLink
          href={`/play/${r.attemptId}/review`}
          size="lg"
          iconRight={<Icon name="arrow-right" className="size-5" />}
        >
          Reveal the Red Flags
        </ButtonLink>
        <ButtonLink href={moduleHref} variant="secondary">
          Back to module
        </ButtonLink>
      </div>
    </div>
  );
}

function EvidenceList({ items, empty }: { items: ResultsView["recognized"]; empty: string }) {
  if (items.length === 0) return <p className="mt-2 text-small text-teal/90">{empty}</p>;
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {items.map((e) => (
        <li
          key={e.id}
          className="flex flex-col gap-1 rounded-card border-2 border-teal/25 p-3 sm:flex-row sm:items-center sm:gap-3"
        >
          <EvidenceLabel kind={KIND[e.kind] ?? "verify"} />
          <span className="text-small font-semibold">{e.title}</span>
        </li>
      ))}
    </ul>
  );
}
