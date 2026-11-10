import type { Metadata } from "next";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { ApiError } from "@/lib/api/server";
import { getCurrentUser, requireOnboardedProfile } from "@/lib/auth/session";
import type { PlaybookView } from "@/lib/recovery/playbook";
import { loadPlaybook, type NoteState } from "@/lib/recovery/server";
import { NotCompletedError } from "@/lib/review/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProgressUnavailable } from "@/components/dashboard/ProgressUnavailable";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { Icon } from "@/components/icons/Icon";
import { PlaybookSteps } from "@/components/playbook/PlaybookSteps";
import { PolicyCard } from "@/components/playbook/PolicyCard";
import { PostScenarioNav } from "@/components/review/PostScenarioNav";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Your Recovery Playbook" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ attemptId: string }> };

/**
 * Your Recovery Playbook for one COMPLETED attempt (Step 9, R21, R30). The owner's attempt only (foreign → 404,
 * unfinished → back to the player). Policy facts, links, and verification dates come from the versioned knowledge
 * base; the optional AI note is fetched once by the client and never contains policy.
 */
export default async function AttemptPlaybookPage({ params }: Props) {
  const { attemptId } = await params;
  const profile = await requireOnboardedProfile(`/play/${attemptId}/playbook`);
  if (profile.status !== "ok") return <ProfileUnavailable reason={profile.status} />;
  const user = await getCurrentUser();
  if (!user) notFound();

  let data: { playbook: PlaybookView; note: NoteState };
  try {
    const supabase = await createSupabaseServerClient();
    data = await loadPlaybook(supabase, user.id, attemptId);
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof NotCompletedError) redirect(`/play/${attemptId}`);
    if (e instanceof ApiError && e.status === 404) notFound();
    return (
      <div className="container-page py-8 sm:py-12">
        <ProgressUnavailable href={`/play/${attemptId}/playbook`} />
      </div>
    );
  }
  const { playbook: p, note } = data;
  const w = p.whatHappened;

  return (
    <div className="container-page py-8 sm:py-12">
      <PageHeader
        eyebrow={`Module ${p.module.order} · ${p.module.title} · Debrief`}
        title={`Your Recovery Playbook: ${p.title}`}
        actions={
          p.isPractice ? (
            <Badge tone="outline" icon={<Icon name="target" className="size-3.5" />}>
              Practice attempt {p.attemptNumber}
            </Badge>
          ) : undefined
        }
      />
      <PostScenarioNav
        attemptId={p.attemptId}
        moduleKey={p.module.key}
        current="playbook"
        scenarioTitle={p.title}
        isPractice={p.isPractice}
      />

      <p className="mt-5 inline-flex items-center gap-2 rounded-pill bg-mist px-3 py-1.5 text-caption font-semibold">
        <Icon name="info" className="size-4" />
        Based on U.S. PayPal policies. Eligibility and terms apply.
      </p>

      {/* 1. What happened */}
      <Card as="section" className="mt-5" aria-labelledby="pb-what">
        <p className="label-eyebrow text-teal/80">1 · What happened</p>
        <h2 id="pb-what" className="mt-1 text-subheading font-bold">
          {w.lesson}
        </h2>
        <p className="mt-3 flex items-start gap-2 text-small">
          <Icon name={w.appropriate ? "check" : "flag"} className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">Your decision: </span>
            {w.decisionSummary}. {w.outcome}
          </span>
        </p>
        {w.payment && (
          <p className="mt-2 flex items-start gap-2 text-small">
            <Icon name="wallet" className="mt-0.5 size-4 shrink-0" />
            <span>
              You paid {w.payment.amountText} through a PayPal Sandbox checkout: test money only
              {w.payment.practice ? ", on a practice attempt" : ", recorded in your fictional Training Funds"}
              .
            </span>
          </p>
        )}
        <p className="mt-3 text-teal/90">{w.framing}</p>
      </Card>

      {/* 2. What you could do */}
      <section className="mt-8" aria-labelledby="pb-do">
        <p className="label-eyebrow text-teal/80">2 · What you could do</p>
        <h2 id="pb-do" className="mt-1 mb-4 text-subheading font-bold">
          If this happened for real
        </h2>
        <PlaybookSteps attemptId={p.attemptId} steps={p.steps} initialNote={note} />
      </section>

      {/* 3. How PayPal may help + 5. Official guidance (claims stay beside their sources) */}
      <section className="mt-8" aria-labelledby="pb-help">
        <p className="label-eyebrow text-teal/80">3 · How PayPal may help · 5 · Official guidance</p>
        <h2 id="pb-help" className="mt-1 text-subheading font-bold">
          Official PayPal pages for this situation
        </h2>
        <p className="mt-2 max-w-prose text-teal/90">{p.howPayPalMayHelp}</p>
        <p className="mt-2 max-w-prose text-caption">
          Unless a point is marked as a summary, it is PayPal&apos;s own wording. Eligibility is decided by
          PayPal case by case, and the official pages have the full, current terms.
          {p.policies.some((x) => !x.verified) &&
            " Pages marked “Not yet verified” couldn't be checked by ScamSense, so their rules aren't repeated here."}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {p.policies.map((policy) => (
            <PolicyCard key={policy.policyId} p={policy} />
          ))}
        </div>
      </section>

      {/* 4. Conditions and limitations */}
      <section className="mt-8" aria-labelledby="pb-limits">
        <p className="label-eyebrow text-teal/80">4 · Conditions and limitations</p>
        <h2 id="pb-limits" className="mt-1 text-subheading font-bold">
          Good to know
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          {p.limitations.map((l) => (
            <details key={l.id} className="group rounded-card border-2 border-teal/25 p-4">
              <summary className="flex min-h-6 cursor-pointer list-none items-center justify-between gap-3 font-heading font-extrabold">
                {l.title}
                <Icon name="arrow-right" className="size-4 shrink-0 rotate-90 group-open:-rotate-90" />
              </summary>
              <p className="mt-2 text-small">{l.text}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 6. Prevention */}
      <Card tone="mist" as="section" className="mt-8" aria-labelledby="pb-prevent">
        <p className="label-eyebrow text-teal/80">6 · Prevention</p>
        <h2 id="pb-prevent" className="mt-1 font-heading text-lg font-extrabold">
          Pause. Check. Verify. Then Pay.
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-small">
          {p.prevention.map((l) => (
            <li key={l} className="flex items-start gap-2">
              <Icon name="shield" className="mt-0.5 size-4 shrink-0" />
              {l}
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-6 text-caption text-teal/85">
        ScamSense is an educational simulator, not a PayPal support channel. It can&apos;t file reports or
        disputes for you and never promises a refund. Knowledge base version {p.kbVersion}.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <ButtonLink
          href={`/modules/${p.module.key}`}
          size="lg"
          iconRight={<Icon name="arrow-right" className="size-5" />}
        >
          Back to module
        </ButtonLink>
        <ButtonLink href={`/play/${p.attemptId}/review`} variant="secondary">
          Reveal the Red Flags
        </ButtonLink>
      </div>
    </div>
  );
}
