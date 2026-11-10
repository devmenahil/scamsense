import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentProgress } from "@/lib/progress/current";
import { reportFileName } from "@/lib/rewards/certificate";
import { getCurrentRewards } from "@/lib/rewards/current";
import { earnedBadges } from "@/lib/rewards/earned";
import { ProgressUnavailable } from "@/components/dashboard/ProgressUnavailable";
import { StatusLabel } from "@/components/dashboard/StatusLabel";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { ReportDownloadButton } from "@/components/report/ReportDownloadButton";
import { BadgeShelf } from "@/components/rewards/BadgeShelf";
import { ModuleBadge } from "@/components/rewards/ModuleBadge";
import { Icon } from "@/components/icons/Icon";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Certificates and reports" };
export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const result = await getCurrentProgress("/certificates");
  if (result.status === "missing" || result.status === "error")
    return <ProfileUnavailable reason={result.status} />;
  const rewards = await getCurrentRewards();
  const snapshot = result.status === "ok" ? result.snapshot : null;
  const earned = earnedBadges(rewards, snapshot);

  return (
    <div className="container-page py-8 sm:py-12">
      <PageHeader
        eyebrow="Certificates"
        title="Badges, certificates, and reports"
        description="Finish both scenarios in a module to earn its badge, see your certificate on screen, and download your analysis report."
      />

      {result.status === "progress_unavailable" ? (
        <ProgressUnavailable className="mt-8" href="/certificates" />
      ) : (
        <>
          <Card as="section" aria-labelledby="shelf-heading" className="mt-8">
            <h2 id="shelf-heading" className="font-heading text-lg font-extrabold">
              Your badges
            </h2>
            <BadgeShelf earned={earned} className="mt-4" />
          </Card>

          <ul className="mt-6 grid gap-5 md:grid-cols-3">
            {result.snapshot.progression.modules.map(({ module: m, status }) => {
              const badge = earned[m.key];
              const cert = rewards.available ? rewards.certificates[m.key] : undefined;
              return (
                <Card as="li" key={m.key} tone={badge ? "white" : "mist"} className="flex min-w-0 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <ModuleBadge badgeKey={m.badgeKey} earned={!!badge} size="sm" />
                    <StatusLabel status={status} />
                  </div>
                  <p className="mt-4 label-eyebrow text-teal/80">Module {m.order}</p>
                  <h2 className="mt-1 text-subheading font-bold">{m.title}</h2>
                  {badge ? (
                    <dl className="mt-2 flex-1 text-small">
                      <div>
                        <dt className="inline font-semibold">Badge: </dt>
                        <dd className="inline">{m.badgeName}</dd>
                      </div>
                      {badge.moduleScore !== undefined && (
                        <div>
                          <dt className="inline font-semibold">Module score: </dt>
                          <dd className="inline">
                            {badge.moduleScore} of {badge.maxScore}
                          </dd>
                        </div>
                      )}
                      {cert && (
                        <>
                          <div>
                            <dt className="inline font-semibold">Completed: </dt>
                            <dd className="inline">{cert.completedOn}</dd>
                          </div>
                          <div>
                            <dt className="inline font-semibold">Certificate ID: </dt>
                            <dd className="inline break-all">{cert.certificateId}</dd>
                          </div>
                        </>
                      )}
                    </dl>
                  ) : (
                    <p className="mt-2 flex-1 text-small text-teal/90">
                      Finish both scenarios to earn the {m.badgeName} badge, certificate, and report.
                    </p>
                  )}
                  {badge ? (
                    <div className="mt-4 flex flex-col gap-3">
                      <Link
                        href={`/modules/${m.key}/complete`}
                        className="inline-flex min-h-11 items-center gap-1.5 font-heading font-extrabold underline decoration-2 underline-offset-4"
                      >
                        View certificate
                        <span className="sr-only"> for {m.title}</span>
                        <Icon name="arrow-right" className="size-4" />
                      </Link>
                      <ReportDownloadButton
                        moduleKey={m.key}
                        variant="secondary"
                        fallbackFileName={reportFileName(m.order, m.title, badge.awardedAt)}
                      />
                    </div>
                  ) : (
                    <Link
                      href={`/modules/${m.key}`}
                      className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-heading font-extrabold underline decoration-2 underline-offset-4"
                    >
                      Go to the module
                      <span className="sr-only"> {m.title}</span>
                      <Icon name="arrow-right" className="size-4" />
                    </Link>
                  )}
                </Card>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
