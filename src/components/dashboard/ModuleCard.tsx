import Link from "next/link";
import type { ModuleDefinition } from "@/content/modules";
import type { ModuleProgress } from "@/lib/domain/progression";
import { Icon, type IconName } from "@/components/icons/Icon";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusLabel } from "./StatusLabel";

export const MODULE_ICONS: Record<ModuleDefinition["key"], IconName> = {
  "spot-the-trap": "phishing",
  "trust-under-pressure": "invoice",
  "outsmart-the-scam": "marketplace",
};

/**
 * Module summary card. Locked modules show why they are locked and render no action (no dead buttons).
 * Unlocked modules are a single link to the module overview.
 */
export function ModuleCard({ progress }: { progress: ModuleProgress }) {
  const { module: m, status, completedScenarios, scenarios } = progress;
  const locked = status === "locked";
  return (
    <Card
      as="article"
      interactive={!locked}
      tone={locked ? "mist" : "white"}
      className="relative flex flex-col gap-4 sm:flex-row sm:items-center"
    >
      <IconTile
        name={locked ? "lock" : MODULE_ICONS[m.key]}
        accent={false}
        tone={locked ? "mist" : "white"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-eyebrow text-teal/80">Module {m.order}</span>
          <Badge tone="mist">{m.difficulty}</Badge>
          <StatusLabel status={status} />
        </div>
        <h3 className="mt-1.5 text-subheading font-bold">
          {locked ? (
            m.title
          ) : (
            // Stretched link: the whole card is clickable, but only one link is announced.
            <Link href={`/modules/${m.key}`} className="after:absolute after:inset-0 after:rounded-card">
              {m.title}
            </Link>
          )}
        </h3>
        <p className="mt-1 text-small text-teal/90">{m.summary}</p>
        {locked ? (
          <p className="mt-3 flex items-center gap-2 text-caption font-medium">
            <Icon name="lock" className="size-4" />
            Unlocks when you finish both scenarios in Module {m.order - 1}.
          </p>
        ) : (
          <ProgressBar
            className="mt-3 max-w-sm"
            value={completedScenarios}
            max={scenarios.length}
            label="Scenarios completed"
            valueText={`${completedScenarios} of ${scenarios.length}`}
          />
        )}
      </div>
      {!locked && <Icon name="arrow-right" className="hidden size-6 sm:block" />}
    </Card>
  );
}
