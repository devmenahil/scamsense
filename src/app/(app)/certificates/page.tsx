import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentProgress } from "@/lib/progress/current";
import { ProgressUnavailable } from "@/components/dashboard/ProgressUnavailable";
import { StatusLabel } from "@/components/dashboard/StatusLabel";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { Icon } from "@/components/icons/Icon";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Certificates and reports" };

export default async function CertificatesPage() {
  const result = await getCurrentProgress("/certificates");
  if (result.status === "missing" || result.status === "error")
    return <ProfileUnavailable reason={result.status} />;
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
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {result.snapshot.progression.modules.map(({ module: m, status }) => {
            const earned = status === "completed";
            return (
              <Card as="li" key={m.key} tone={earned ? "white" : "mist"} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <IconTile
                    name={earned ? "award" : "lock"}
                    accent={false}
                    tone={earned ? "white" : "mist"}
                  />
                  <StatusLabel status={status} />
                </div>
                <p className="mt-4 label-eyebrow text-teal/80">Module {m.order}</p>
                <h2 className="mt-1 text-subheading font-bold">{m.title}</h2>
                <p className="mt-2 flex-1 text-small text-teal/90">
                  {earned
                    ? `${m.badgeName} badge earned. Your certificate preview and analysis report live on the completion page.`
                    : `Finish both scenarios to earn the ${m.badgeName} badge, certificate, and report.`}
                </p>
                <Link
                  href={`/modules/${m.key}/complete`}
                  className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-heading font-extrabold underline decoration-2 underline-offset-4"
                >
                  {earned ? "Open the completion page" : "Preview the completion page"}
                  <Icon name="arrow-right" className="size-4" />
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
