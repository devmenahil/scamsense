import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule, MODULES } from "@/content/modules";
import { DEMO_ATTEMPT_ID, DEMO_MODULE_STATUS, DEMO_SCENARIOS } from "@/lib/demo/demoData";
import { StatusLabel } from "@/components/dashboard/StatusLabel";
import { Icon } from "@/components/icons/Icon";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";

type Props = { params: Promise<{ moduleKey: string }> };

export function generateStaticParams() {
  return MODULES.map((m) => ({ moduleKey: m.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = getModule((await params).moduleKey);
  return { title: m ? m.title : "Module" };
}

export default async function ModuleOverviewPage({ params }: Props) {
  const m = getModule((await params).moduleKey);
  if (!m) notFound();

  const status = DEMO_MODULE_STATUS[m.key];
  const scenarios = DEMO_SCENARIOS[m.key];
  const completed = scenarios.filter((s) => s.status === "completed").length;
  // One primary action per screen: the first scenario that still needs playing.
  const nextScenario = scenarios.find((s) => s.status !== "completed");

  return (
    <div className="container-page py-8 sm:py-12">
      <DemoNotice className="mb-6" />
      <Link
        href="/modules"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 font-heading font-extrabold hover:underline"
      >
        <Icon name="arrow-right" className="size-4 rotate-180" />
        All modules
      </Link>
      <PageHeader
        eyebrow={`Module ${m.order} · ${m.difficulty} · ${m.focus}`}
        title={m.title}
        description={m.summary}
      />

      {status === "locked" ? (
        <EmptyState
          className="mt-8"
          icon="lock"
          title="This module is locked"
          description={`Finish both scenarios in Module ${m.order - 1} to unlock ${m.title}.`}
          action={
            <ButtonLink href="/dashboard" variant="secondary">
              Back to dashboard
            </ButtonLink>
          }
        />
      ) : (
        <>
          <ProgressBar
            className="mt-8 max-w-md"
            value={completed}
            max={scenarios.length}
            label="Module progress"
            valueText={`${completed} of ${scenarios.length} scenarios`}
          />

          <ul className="mt-8 grid gap-5 md:grid-cols-2">
            {scenarios.map((s) => (
              <Card as="li" key={s.key} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <IconTile name={s.status === "completed" ? "check" : "play"} accent={false} tone="mist" />
                  <StatusLabel status={s.status} />
                </div>
                <h2 className="mt-4 text-subheading font-bold">{s.label}</h2>
                <p className="mt-1 flex items-center gap-2 text-small">
                  <Badge tone="outline">{s.environment}</Badge>
                </p>
                {/* Only the neutral one-line intro is shown before play (R9). */}
                <p className="mt-3 flex-1 text-teal/90">{s.introLine}</p>
                <div className="mt-5">
                  {s.status === "completed" ? (
                    <ButtonLink href={`/play/${DEMO_ATTEMPT_ID}/results`} variant="secondary" fullWidth>
                      View results
                    </ButtonLink>
                  ) : (
                    <ButtonLink
                      href={`/play/${DEMO_ATTEMPT_ID}`}
                      variant={s === nextScenario ? "primary" : "secondary"}
                      fullWidth
                    >
                      {s.status === "in_progress" ? "Resume scenario" : "Start scenario"}
                    </ButtonLink>
                  )}
                </div>
              </Card>
            ))}
          </ul>

          <Card tone="mist" className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <IconTile name="award" />
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-lg font-extrabold">Module completion</h2>
              <p className="text-small text-teal/90">
                Finish both scenarios to earn the {m.title} badge, preview your certificate, and download your
                analysis report.
              </p>
            </div>
            <Link
              href={`/modules/${m.key}/complete`}
              className="inline-flex min-h-11 items-center gap-1.5 font-heading font-extrabold underline decoration-2 underline-offset-4"
            >
              Preview completion page
            </Link>
          </Card>
        </>
      )}
    </div>
  );
}
