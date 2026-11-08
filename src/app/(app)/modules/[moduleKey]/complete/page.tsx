import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getModule, MODULES } from "@/content/modules";
import { DEMO_USER } from "@/lib/demo/demoData";
import { Logo, LogoSymbol } from "@/components/brand/Logo";
import { CertificateEmailForm } from "@/components/certificate/CertificateEmailForm";
import { Icon } from "@/components/icons/Icon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";

type Props = { params: Promise<{ moduleKey: string }> };

export function generateStaticParams() {
  return MODULES.map((m) => ({ moduleKey: m.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = getModule((await params).moduleKey);
  return { title: m ? `${m.title} complete` : "Module complete" };
}

/**
 * Module completion shell (R24–R26): badge, on-screen certificate preview (never a download), optional email via
 * Zapier, and the analysis-report download. Phase 1 shows a clearly labelled preview with example data.
 */
export default async function ModuleCompletePage({ params }: Props) {
  const m = getModule((await params).moduleKey);
  if (!m) notFound();

  return (
    <div className="container-page py-8 sm:py-12">
      <DemoNotice className="mb-6">
        This is a preview of the completion page with example data. Real certificates are issued only after
        you finish both scenarios in a module.
      </DemoNotice>
      <PageHeader eyebrow={`Module ${m.order} · ${m.difficulty}`} title={`You finished ${m.title}`} />

      <FeedbackBanner tone="success" title="Module complete!" className="mt-6">
        You earned the {m.title} badge.
      </FeedbackBanner>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* On-screen certificate preview (not downloadable, R25) */}
        <section aria-labelledby="certificate-heading">
          <h2 id="certificate-heading" className="sr-only">
            Certificate preview
          </h2>
          <div className="relative overflow-hidden rounded-panel border-2 border-teal bg-white p-6 shadow-edge sm:p-10">
            <div
              className="absolute inset-3 rounded-card border-2 border-dashed border-teal/30"
              aria-hidden="true"
            />
            <div className="relative flex flex-col items-center text-center">
              <Logo size="md" />
              <p className="mt-6 label-eyebrow text-teal/80">Certificate of completion</p>
              <p className="mt-3 text-small">This certifies that</p>
              <p className="mt-1 font-heading text-[1.75rem] leading-9 font-black sm:text-[2.25rem] sm:leading-[2.75rem]">
                {DEMO_USER.displayName}
              </p>
              <p className="mt-2 max-w-sm text-small">
                completed the ScamSense module{" "}
                <strong className="font-heading font-extrabold">{m.title}</strong> ({m.difficulty}).
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-2 text-caption">
                <span>
                  <span className="font-semibold">Completed:</span> November 8, 2026 (example)
                </span>
                <span>
                  <span className="font-semibold">Certificate ID:</span> DEMO-0000-0000
                </span>
              </div>
              <LogoSymbol className="mt-6 w-10" />
            </div>
          </div>
          <p className="mt-3 text-caption text-teal/85">
            Certificates are shown on screen only. You can email yourself a copy.
          </p>
        </section>

        <div className="flex flex-col gap-5">
          <Card className="flex items-center gap-4">
            <IconTile name="award" size="lg" />
            <div>
              <p className="label-eyebrow text-teal/80">Badge earned</p>
              <p className="font-heading text-lg font-extrabold">{m.title}</p>
            </div>
          </Card>

          <Card as="section" aria-labelledby="email-heading">
            <h2 id="email-heading" className="flex items-center gap-2 font-heading text-lg font-extrabold">
              <Icon name="mail" className="size-5" />
              Email your certificate
            </h2>
            <div className="mt-4">
              <CertificateEmailForm />
            </div>
          </Card>

          <Card as="section" tone="mist" aria-labelledby="report-heading">
            <h2 id="report-heading" className="flex items-center gap-2 font-heading text-lg font-extrabold">
              <Icon name="report" className="size-5" />
              Your analysis report
            </h2>
            <p className="mt-2 text-small">
              A PDF covering your decisions, the evidence you spotted and missed, your training-funds history,
              and key lessons.
            </p>
            <Button
              className="mt-4"
              variant="secondary"
              fullWidth
              disabled
              aria-describedby="report-unavailable"
            >
              Download report (PDF)
            </Button>
            <p id="report-unavailable" className="mt-2 text-caption">
              Available once report generation is connected in a later phase.
            </p>
          </Card>
        </div>
      </div>

      <div className="mt-10 flex justify-center">
        <ButtonLink href="/dashboard" size="lg" iconRight={<Icon name="arrow-right" className="size-5" />}>
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
