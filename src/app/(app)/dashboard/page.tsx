import type { Metadata } from "next";
import Link from "next/link";
import { getModule, MODULES } from "@/content/modules";
import { FINANCIAL_GOALS, labelFor } from "@/content/profileOptions";
import type { ProgressSnapshot } from "@/lib/domain/progress";
import type { Profile } from "@/lib/profile/schema";
import { getCurrentProgress } from "@/lib/progress/current";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { ProgressUnavailable } from "@/components/dashboard/ProgressUnavailable";
import { StatusLabel } from "@/components/dashboard/StatusLabel";
import {
  money,
  TrainingFundsCard,
  TrainingFundsStrip,
  WalletBreakdown,
} from "@/components/dashboard/TrainingFunds";
import { Icon, type IconName } from "@/components/icons/Icon";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";

export const metadata: Metadata = { title: "Dashboard" };

const QUICK_LINKS: { href: string; label: string; body: string; icon: IconName }[] = [
  {
    href: "/sensei",
    label: "Ask Sensei Kenshi",
    body: "Questions about scams, finished scenarios, or PayPal.",
    icon: "chat",
  },
  {
    href: "/playbook",
    label: "Your Recovery Playbook",
    body: "What to do if something goes wrong.",
    icon: "book",
  },
];

export default async function DashboardPage() {
  const result = await getCurrentProgress("/dashboard");
  if (result.status === "missing" || result.status === "error")
    return <ProfileUnavailable reason={result.status} />;
  const firstName = result.profile.displayName.split(" ")[0];

  if (result.status === "progress_unavailable") {
    return (
      <div className="container-page py-8 sm:py-12">
        <PageHeader eyebrow="Dashboard" title={`Welcome back, ${firstName}`} />
        <ProgressUnavailable className="mt-8" />
      </div>
    );
  }

  const { snapshot, profile } = result;
  const { progression } = snapshot;
  const current = progression.modules.find((m) => m.module.key === progression.currentModuleKey) ?? null;

  return (
    <div className="container-page py-8 sm:py-12">
      {snapshot.currentWallet && (
        <TrainingFundsStrip wallet={snapshot.currentWallet} className="mb-6 lg:hidden" />
      )}
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${firstName}`}
        description={
          progression.allComplete
            ? "You've finished every module. Replay any scenario whenever you want more practice."
            : "Pick up your training where you left off. Take your time: accuracy matters more than speed."
        }
        actions={
          current && (
            <ButtonLink
              href={`/modules/${current.module.key}`}
              iconRight={<Icon name="arrow-right" className="size-5" />}
            >
              {current.status === "available" ? "Start" : "Continue"} module {current.module.order}
            </ButtonLink>
          )
        }
      />

      <StatsRow snapshot={snapshot} />

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-10">
          {current ? (
            <section aria-labelledby="current-heading">
              <h2 id="current-heading" className="text-subheading font-bold">
                Current module
              </h2>
              <Card tone="mist" className="mt-4">
                <p className="label-eyebrow text-teal/80">
                  Module {current.module.order} · {current.module.difficulty}
                </p>
                <h3 className="mt-1 text-subheading font-bold">{current.module.title}</h3>
                <p className="mt-1 text-small text-teal/90">{current.module.summary}</p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {current.scenarios.map((s) => (
                    <li
                      key={s.key}
                      className="flex items-center justify-between gap-3 rounded-tile border-2 border-teal/15 bg-white px-4 py-3"
                    >
                      <span className="font-heading font-extrabold">{s.title}</span>
                      <StatusLabel status={s.status} />
                    </li>
                  ))}
                </ul>
                {!current.started && (
                  <p className="mt-4 text-small">
                    Your training funds for this module are set when you start it from the module page.
                  </p>
                )}
              </Card>
            </section>
          ) : (
            <FeedbackBanner tone="success" title="All three modules complete">
              Every badge is yours. Your certificates and reports are on the Certificates page.
            </FeedbackBanner>
          )}

          <section aria-labelledby="modules-heading">
            <h2 id="modules-heading" className="text-subheading font-bold">
              Your modules
            </h2>
            <p className="mt-1 text-small text-teal/85">
              {progression.modules.filter((m) => m.unlocked).length} of {progression.modules.length} unlocked.
              Finish both scenarios in a module to unlock the next one.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              {progression.modules.map((m) => (
                <ModuleCard key={m.module.key} progress={m} />
              ))}
            </div>
          </section>

          <PastResults snapshot={snapshot} />
        </div>

        <aside className="flex min-w-0 flex-col gap-5" aria-label="Your training summary">
          {snapshot.currentWallet && (
            <TrainingFundsCard wallet={snapshot.currentWallet} className="hidden lg:block" />
          )}
          <GoalCard profile={profile} />
          <BadgesCard snapshot={snapshot} />
          <CertificatesCard snapshot={snapshot} />
          <nav aria-label="Learning tools" className="flex flex-col gap-3">
            {QUICK_LINKS.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="group flex items-center gap-3 rounded-card border-2 border-teal bg-white p-4 shadow-edge-sm transition-transform hover:-translate-y-0.5"
              >
                <IconTile name={q.icon} size="sm" accent={false} tone="mist" />
                <span className="min-w-0 flex-1">
                  <span className="block font-heading font-extrabold">{q.label}</span>
                  <span className="block text-caption text-teal/85">{q.body}</span>
                </span>
                <Icon
                  name="arrow-right"
                  className="size-5 transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}

function StatsRow({ snapshot }: { snapshot: ProgressSnapshot }) {
  const p = snapshot.progression;
  const badges = MODULES.filter((m) => snapshot.modules[m.key].badgeEarnedAt).length;
  const stats: { label: string; value: string; detail: string; icon: IconName }[] = [
    {
      label: "Total score",
      value: `${snapshot.totalPoints} pts`,
      detail: `of ${snapshot.maxPoints} possible`,
      icon: "award",
    },
    {
      label: "Modules complete",
      value: `${p.completedModules} of ${p.modules.length}`,
      detail: p.allComplete ? "Everything finished" : "Unlock them in order",
      icon: "modules",
    },
    {
      label: "Badges",
      value: `${badges} of ${MODULES.length}`,
      detail: "One per finished module",
      icon: "shield",
    },
  ];
  return (
    <section aria-label="Your progress at a glance" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card padding="sm" className="sm:col-span-2 xl:col-span-1">
        <h2 className="text-caption font-medium">Overall progress</h2>
        <p className="mt-1 font-heading text-2xl font-black">
          {Math.round((p.completedScenarios / p.totalScenarios) * 100)}%
        </p>
        <ProgressBar
          tone="yellow"
          className="mt-2"
          value={p.completedScenarios}
          max={p.totalScenarios}
          label="Scenarios completed"
          valueText={`${p.completedScenarios} of ${p.totalScenarios}`}
        />
      </Card>
      {stats.map((s) => (
        <Card key={s.label} padding="sm" className="flex items-start gap-3">
          <IconTile name={s.icon} tone="mist" accent={false} size="sm" />
          <div className="min-w-0">
            <h2 className="text-caption font-medium">{s.label}</h2>
            <p className="mt-0.5 font-heading text-2xl font-black tabular-nums">{s.value}</p>
            <p className="text-caption text-teal/85">{s.detail}</p>
          </div>
        </Card>
      ))}
    </section>
  );
}

function PastResults({ snapshot }: { snapshot: ProgressSnapshot }) {
  const finished = snapshot.progression.modules.filter((m) => m.status === "completed");
  return (
    <section aria-labelledby="results-heading">
      <h2 id="results-heading" className="text-subheading font-bold">
        Past module results
      </h2>
      {finished.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon="report"
          title="No finished modules yet"
          description="When you finish a module, its score and Training Funds history stay here, even after the next module resets your funds."
        />
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {finished.map(({ module: m }) => {
            const r = snapshot.modules[m.key];
            return (
              <Card as="li" key={m.key} className="flex flex-col">
                <p className="label-eyebrow text-teal/80">Module {m.order}</p>
                <h3 className="mt-1 font-heading text-lg font-extrabold">{m.title}</h3>
                <p className="mt-2 text-small">
                  Score <strong className="font-heading font-extrabold">{r.points}</strong> of {r.maxPoints}{" "}
                  pts
                </p>
                {r.wallet && (
                  <div className="mt-3 flex-1">
                    <p className="text-small">
                      Closing balance{" "}
                      <strong className="font-heading font-extrabold">
                        {money(r.wallet.balanceMinor, r.wallet.currency)}
                      </strong>{" "}
                      of {money(r.wallet.startingMinor, r.wallet.currency)}
                    </p>
                    <div className="mt-3">
                      <WalletBreakdown summary={r.wallet} />
                    </div>
                  </div>
                )}
                <Link
                  href={`/modules/${m.key}`}
                  className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-heading font-extrabold underline decoration-2 underline-offset-4"
                >
                  Module details and history
                  <Icon name="arrow-right" className="size-4" />
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function GoalCard({ profile }: { profile: Profile }) {
  const label =
    profile.financialGoal === "other" && profile.customGoal
      ? profile.customGoal
      : (labelFor(FINANCIAL_GOALS, profile.financialGoal) ?? "Not set");
  return (
    <Card as="section" aria-labelledby="goal-heading">
      <div className="flex items-center gap-3">
        <IconTile name="target" tone="mist" accent={false} size="sm" />
        <h2 id="goal-heading" className="font-heading text-lg font-extrabold">
          Your financial goal
        </h2>
      </div>
      <p className="mt-3 font-heading font-extrabold">{label}</p>
      {profile.goalAmountMinor !== null && (
        <p className="text-small">Target {money(profile.goalAmountMinor, profile.preferredCurrency)}</p>
      )}
      <p className="mt-2 text-caption text-teal/85">
        Practising here is about protecting real progress like this. Training Funds are always fictional.
      </p>
      <Link
        href="/profile"
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-small font-semibold underline decoration-2 underline-offset-4"
      >
        Edit in My Profile
      </Link>
    </Card>
  );
}

function BadgesCard({ snapshot }: { snapshot: ProgressSnapshot }) {
  return (
    <Card as="section" aria-labelledby="badges-heading">
      <h2 id="badges-heading" className="font-heading text-lg font-extrabold">
        Badges
      </h2>
      <p className="mt-1 text-small text-teal/85">Earn one for every module you finish.</p>
      <ul className="mt-4 grid grid-cols-3 gap-3" aria-label="Module badges">
        {MODULES.map((m) => {
          const earned = Boolean(snapshot.modules[m.key].badgeEarnedAt);
          return (
            <li key={m.key} className="flex flex-col items-center gap-1.5 text-center">
              <IconTile
                name={earned ? "award" : "lock"}
                tone={earned ? "white" : "mist"}
                accent={false}
                label={`${m.badgeName} badge (${m.title}): ${earned ? "earned" : "not earned yet"}`}
              />
              <span className="text-caption font-medium">{m.badgeName}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function CertificatesCard({ snapshot }: { snapshot: ProgressSnapshot }) {
  return (
    <Card as="section" aria-labelledby="certificates-heading">
      <h2 id="certificates-heading" className="font-heading text-lg font-extrabold">
        Certificates and reports
      </h2>
      <ul className="mt-3 flex flex-col divide-y-2 divide-mist">
        {MODULES.map((m) => {
          const earned = Boolean(snapshot.modules[m.key].badgeEarnedAt);
          return (
            <li key={m.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-small font-semibold">{getModule(m.key)!.title}</span>
                <span className="block text-caption text-teal/85">
                  {earned
                    ? "Module finished: open its completion page"
                    : `Available after you finish Module ${m.order}`}
                </span>
              </span>
              {earned ? (
                <Link
                  href={`/modules/${m.key}/complete`}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 font-heading text-small font-extrabold underline decoration-2 underline-offset-4"
                >
                  Open
                  <span className="sr-only"> the {m.title} certificate and report</span>
                </Link>
              ) : (
                <Icon name="lock" className="size-5" label="Locked" />
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
