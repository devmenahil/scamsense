import type { Metadata } from "next";
import Link from "next/link";
import { MODULES } from "@/content/modules";
import { DEMO_MODULE_STATUS, DEMO_SCENARIOS, DEMO_USER, DEMO_WALLET } from "@/lib/demo/demoData";
import { formatMinorUnits } from "@/lib/format";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { Icon, type IconName } from "@/components/icons/Icon";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";

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

export default function DashboardPage() {
  const current = MODULES.find((m) => DEMO_MODULE_STATUS[m.key] === "in_progress") ?? MODULES[0];
  return (
    <div className="container-page py-8 sm:py-12">
      <DemoNotice className="mb-6" />
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${DEMO_USER.displayName.split(" ")[0]}`}
        description="Pick up your training where you left off. Take your time: accuracy matters more than speed."
        actions={
          current && (
            <ButtonLink
              href={`/modules/${current.key}`}
              iconRight={<Icon name="arrow-right" className="size-5" />}
            >
              Continue module {current.order}
            </ButtonLink>
          )
        }
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="modules-heading">
          <h2 id="modules-heading" className="text-subheading font-bold">
            Your modules
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            {MODULES.map((m) => (
              <ModuleCard
                key={m.key}
                module={m}
                status={DEMO_MODULE_STATUS[m.key]}
                scenarios={DEMO_SCENARIOS[m.key]}
              />
            ))}
          </div>

          <h2 className="mt-10 text-subheading font-bold">Past module results</h2>
          <EmptyState
            className="mt-4"
            icon="report"
            title="No finished modules yet"
            description="When you finish a module, its decisions, training-funds history, and report appear here."
          />
        </section>

        <aside className="flex flex-col gap-5" aria-label="Your training summary">
          <Card tone="teal">
            <div className="flex items-center gap-3">
              <IconTile name="wallet" tone="teal" accent={false} size="sm" />
              <h2 className="font-heading text-lg font-extrabold">Training funds</h2>
            </div>
            <p className="mt-4 font-heading text-[2rem] leading-none font-black">
              {formatMinorUnits(DEMO_WALLET.balanceMinor, DEMO_WALLET.currency, DEMO_WALLET.minorUnitDigits)}
            </p>
            <p className="mt-2 text-caption text-white/90">
              Fictional money for Module {current?.order ?? 1}. It resets when each module starts and is
              separate from any PayPal balance.
            </p>
          </Card>

          <Card>
            <h2 className="font-heading text-lg font-extrabold">Badges</h2>
            <p className="mt-1 text-small text-teal/85">Earn one for every module you finish.</p>
            <ul className="mt-4 flex gap-3" aria-label="Module badges">
              {MODULES.map((m) => (
                <li key={m.key} className="flex flex-col items-center gap-1.5 text-center">
                  <IconTile
                    name="lock"
                    tone="mist"
                    accent={false}
                    label={`${m.title} badge: not earned yet`}
                  />
                  <span className="text-[0.75rem] leading-4 font-medium">M{m.order}</span>
                </li>
              ))}
            </ul>
          </Card>

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
