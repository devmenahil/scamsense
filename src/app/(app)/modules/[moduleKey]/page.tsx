import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "@/content/modules";
import type { ScenarioProgress } from "@/lib/domain/progression";
import { calculateStartingFunds } from "@/lib/domain/trainingFunds";
import { getCurrentProgress } from "@/lib/progress/current";
import { ProgressUnavailable } from "@/components/dashboard/ProgressUnavailable";
import { StartModuleButton } from "@/components/dashboard/StartModuleButton";
import { StartScenarioButton } from "@/components/dashboard/StartScenarioButton";
import { StatusLabel } from "@/components/dashboard/StatusLabel";
import { LedgerHistory, money, TrainingFundsCard } from "@/components/dashboard/TrainingFunds";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { Icon } from "@/components/icons/Icon";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";

type Props = { params: Promise<{ moduleKey: string }> };

// Per-user page (progress + Training Funds): always rendered on request, never prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = getModule((await params).moduleKey);
  return { title: m ? m.title : "Module" };
}

export default async function ModuleOverviewPage({ params }: Props) {
  const m = getModule((await params).moduleKey);
  if (!m) notFound();
  const result = await getCurrentProgress(`/modules/${m.key}`);
  if (result.status === "missing" || result.status === "error")
    return <ProfileUnavailable reason={result.status} />;

  const header = (
    <>
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
    </>
  );

  if (result.status === "progress_unavailable") {
    return (
      <div className="container-page py-8 sm:py-12">
        {header}
        <ProgressUnavailable className="mt-8" href={`/modules/${m.key}`} />
      </div>
    );
  }

  const progress = result.snapshot.progression.modules.find((x) => x.module.key === m.key)!;
  const moduleResult = result.snapshot.modules[m.key];

  if (!progress.unlocked) {
    return (
      <div className="container-page py-8 sm:py-12">
        {header}
        <EmptyState
          className="mt-8"
          icon="lock"
          title="This module is locked"
          description={`Finish both scenarios in Module ${m.order - 1} to unlock ${m.title}. No minimum score is needed.`}
          action={
            <ButtonLink href="/dashboard" variant="secondary">
              Back to dashboard
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const preview = calculateStartingFunds(result.profile);

  return (
    <div className="container-page py-8 sm:py-12">
      {header}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {!progress.started ? (
            <Card tone="mist" as="section" aria-labelledby="begin-heading">
              <h2 id="begin-heading" className="text-subheading font-bold">
                Before you begin
              </h2>
              <p className="mt-2">
                Starting this module sets your Training Funds to{" "}
                <strong className="font-heading font-extrabold">
                  {money(preview.startingFundsMinor, preview.currency)}
                </strong>
                {preview.basis === "income_bracket"
                  ? ", based on the income range in your profile."
                  : ", the default training budget."}
              </p>
              <p className="mt-2 text-small text-teal/90">
                It&apos;s fictional practice money, separate from any PayPal balance. Funds reset at the start
                of each module, and the results of earlier modules are kept.
              </p>
              <div className="mt-5">
                <StartModuleButton moduleKey={m.key} label={`Start module ${m.order}`} />
              </div>
            </Card>
          ) : (
            <ProgressBar
              className="max-w-md"
              value={progress.completedScenarios}
              max={progress.scenarios.length}
              label="Module progress"
              valueText={`${progress.completedScenarios} of ${progress.scenarios.length} scenarios`}
            />
          )}

          <section aria-labelledby="scenarios-heading">
            <h2 id="scenarios-heading" className="text-subheading font-bold">
              Scenarios
            </h2>
            <p className="mt-1 text-small text-teal/85">
              {progress.routed
                ? "Ordered for you, based on the activities in your profile. Both scenarios are needed to finish the module, and you can play them in either order."
                : "Both scenarios are needed to finish the module. Play them in either order."}
            </p>
            <ul className="mt-4 grid gap-5 md:grid-cols-2">
              {progress.scenarios.map((s) => (
                <ScenarioSlotCard
                  key={s.key}
                  slot={s}
                  started={progress.started}
                  primary={s.key === progress.scenarios.find((x) => x.status !== "completed")?.key}
                />
              ))}
            </ul>
          </section>

          <Card tone="white" as="section" className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <IconTile name="award" accent={false} />
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-lg font-extrabold">Module completion</h2>
              <p className="text-small text-teal/90">
                {progress.status === "completed"
                  ? `You finished ${m.title} with ${moduleResult.points} of ${moduleResult.maxPoints} points.`
                  : `Finish both scenarios to earn the ${m.badgeName} badge, preview your certificate, and download your analysis report.`}
              </p>
            </div>
            {progress.status === "completed" && (
              <Link
                href={`/modules/${m.key}/complete`}
                className="inline-flex min-h-11 items-center gap-1.5 font-heading font-extrabold underline decoration-2 underline-offset-4"
              >
                Certificate and report
                <Icon name="arrow-right" className="size-4" />
              </Link>
            )}
          </Card>
        </div>

        {moduleResult.wallet && (
          <aside className="flex min-w-0 flex-col gap-5" aria-label="Training Funds for this module">
            <TrainingFundsCard
              wallet={{
                kind: progress.status === "completed" ? "closed" : "active",
                moduleKey: m.key,
                summary: moduleResult.wallet,
              }}
            />
            <Card as="section" aria-labelledby="ledger-heading">
              <h2 id="ledger-heading" className="font-heading text-lg font-extrabold">
                Training Funds history
              </h2>
              <p className="mt-1 text-caption text-teal/85">
                Every change is its own entry. Nothing is overwritten.
              </p>
              <div className="mt-2">
                <LedgerHistory entries={moduleResult.ledger} moduleKey={m.key} />
              </div>
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}

function ScenarioSlotCard({
  slot,
  started,
  primary,
}: {
  slot: ScenarioProgress;
  started: boolean;
  primary: boolean;
}) {
  const note =
    slot.status === "completed"
      ? "Replays are practice: they don't change your score, progress, badges, or Training Funds."
      : slot.status === "in_progress"
        ? "Your progress is saved. Pick up exactly where you left off."
        : started
          ? "A short, neutral introduction, then the scenario is yours to explore."
          : "Start the module to set up your Training Funds first.";
  return (
    <Card as="li" className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <IconTile name={slot.status === "completed" ? "check" : "play"} accent={false} tone="mist" />
        <StatusLabel status={slot.status} />
      </div>
      <p className="mt-4 label-eyebrow text-teal/80">Scenario {slot.position}</p>
      <h3 className="mt-1 text-subheading font-bold">{slot.title}</h3>
      {slot.completedAttempts > 1 && (
        <p className="mt-1 text-caption text-teal/85">Played {slot.completedAttempts} times</p>
      )}
      <p className="mt-3 flex flex-1 items-start gap-2 text-small text-teal/90">
        <Icon name="info" className="mt-0.5 size-4" />
        {note}
      </p>
      {started && slot.action !== "locked" && (
        <div className="mt-4">
          <StartScenarioButton
            scenarioKey={slot.key}
            action={slot.action}
            variant={primary ? "primary" : "secondary"}
          />
        </div>
      )}
    </Card>
  );
}
