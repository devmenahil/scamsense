import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModule, MODULES } from "@/content/modules";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { reportFileName } from "@/lib/rewards/certificate";
import { getCurrentModuleRewards } from "@/lib/rewards/current";
import { CertificateEmailForm } from "@/components/certificate/CertificateEmailForm";
import { CertificatePreview } from "@/components/certificate/CertificatePreview";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { ReportDownloadButton } from "@/components/report/ReportDownloadButton";
import { ModuleBadge } from "@/components/rewards/ModuleBadge";
import { Icon } from "@/components/icons/Icon";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { PageHeader } from "@/components/ui/PageHeader";

type Props = { params: Promise<{ moduleKey: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = getModule((await params).moduleKey);
  return { title: m ? `${m.title} complete` : "Module complete" };
}

/**
 * Module completion (R24–R26, Step 11): badge, on-screen certificate (never a download), optional email through the
 * existing Zapier → Gmail workflow, and the analysis-report download. Everything shown comes from stored records:
 * revisiting or refreshing this page never awards, scores, or changes anything.
 */
export default async function ModuleCompletePage({ params }: Props) {
  const m = getModule((await params).moduleKey);
  if (!m) notFound();
  const profile = await requireOnboardedProfile(`/modules/${m.key}/complete`);
  if (profile.status !== "ok") return <ProfileUnavailable reason={profile.status} />;

  const state = await getCurrentModuleRewards(m.key);
  const next = MODULES.find((x) => x.order === m.order + 1);

  if (state.status === "not_completed") {
    return (
      <div className="container-page py-8 sm:py-12">
        <PageHeader eyebrow={`Module ${m.order} · ${m.difficulty}`} title={m.title} />
        <EmptyState
          className="mt-8"
          icon="lock"
          title="Your badge and certificate are waiting"
          description={`Finish both scenarios in ${m.title} to earn the ${m.badgeName} badge, your certificate, and your analysis report.`}
          action={
            <ButtonLink href={`/modules/${m.key}`} iconRight={<Icon name="arrow-right" className="size-5" />}>
              Go to {m.title}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className="container-page py-8 sm:py-12">
        <PageHeader eyebrow={`Module ${m.order} · ${m.difficulty}`} title={`You finished ${m.title}`} />
        <FeedbackBanner tone="info" title="Your certificate can't be shown right now." className="mt-6">
          Your progress is safe. Please refresh in a moment. You can still download your analysis report.
        </FeedbackBanner>
        <div className="mt-6 max-w-sm">
          <ReportDownloadButton
            moduleKey={m.key}
            fallbackFileName={reportFileName(m.order, m.title, new Date().toISOString())}
          />
        </div>
      </div>
    );
  }

  const { certificate, badge, email } = state;
  const { id: _id, ...preview } = certificate;
  void _id;

  return (
    <div className="container-page py-8 sm:py-12">
      <PageHeader eyebrow={`Module ${m.order} · ${m.difficulty}`} title={`You finished ${m.title}`} />

      <FeedbackBanner tone="success" title="Module complete!" className="mt-6">
        You earned the {m.badgeName} badge on {certificate.completedOn}.
        {next ? ` ${next.title} is now unlocked.` : " You've completed every ScamSense module."}
      </FeedbackBanner>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <section aria-labelledby="certificate-heading" className="min-w-0">
          <h2 id="certificate-heading" className="sr-only">
            Your certificate
          </h2>
          <CertificatePreview certificate={preview} />
          <p className="mt-3 text-caption text-teal/85">
            Your certificate lives here and on the Certificates page. It isn&apos;t downloadable, but you can
            email yourself a PDF copy.
          </p>
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <Card as="section" aria-labelledby="badge-heading" className="flex items-center gap-4">
            <ModuleBadge badgeKey={m.badgeKey} earned size="md" />
            <div className="min-w-0">
              <p className="label-eyebrow text-teal/80">Badge earned</p>
              <h2 id="badge-heading" className="font-heading text-lg font-extrabold">
                {m.badgeName}
              </h2>
              {badge && (
                <p className="text-small">
                  Module score <strong className="font-semibold">{badge.moduleScore}</strong> of{" "}
                  {badge.maxScore}
                </p>
              )}
              <p className="text-caption text-teal/85">A ScamSense learning badge, not a PayPal award.</p>
            </div>
          </Card>

          <Card as="section" tone="mist" aria-labelledby="report-heading">
            <h2 id="report-heading" className="flex items-center gap-2 font-heading text-lg font-extrabold">
              <Icon name="report" className="size-5" />
              Your analysis report
            </h2>
            <p className="mt-2 text-small">
              A PDF of your decisions, explanations, the evidence you spotted and missed, your verification
              steps, your fictional Training Funds, and key lessons. Download it as often as you like.
            </p>
            <div className="mt-4">
              <ReportDownloadButton
                moduleKey={m.key}
                fallbackFileName={reportFileName(m.order, m.title, certificate.completedAtIso)}
              />
            </div>
          </Card>

          <Card as="section" aria-labelledby="email-heading">
            <h2 id="email-heading" className="flex items-center gap-2 font-heading text-lg font-extrabold">
              <Icon name="mail" className="size-5" />
              Email your certificate
            </h2>
            <div className="mt-4">
              <CertificateEmailForm moduleKey={m.key} initialStatus={email} />
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {next ? (
          <ButtonLink href={`/modules/${next.key}`} variant="secondary" size="lg">
            Go to Module {next.order}: {next.title}
          </ButtonLink>
        ) : null}
        <ButtonLink
          href="/dashboard"
          variant="ghost"
          size="lg"
          iconRight={<Icon name="arrow-right" className="size-5" />}
        >
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
