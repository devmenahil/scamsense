import type { ModuleStatus, ScenarioStatus } from "@/lib/domain/progression";
import { Icon, type IconName } from "@/components/icons/Icon";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

/** Status pills always pair an icon with words, so the state never depends on colour alone. */
const MAP: Record<ModuleStatus | ScenarioStatus, { label: string; icon: IconName; tone: BadgeTone }> = {
  locked: { label: "Locked", icon: "lock", tone: "mist" },
  available: { label: "Ready to start", icon: "play", tone: "outline" },
  not_started: { label: "Not started", icon: "play", tone: "outline" },
  in_progress: { label: "In progress", icon: "clock", tone: "outline" },
  completed: { label: "Completed", icon: "check", tone: "teal" },
};

export function StatusLabel({ status }: { status: ModuleStatus | ScenarioStatus }) {
  const s = MAP[status];
  return (
    <Badge tone={s.tone} icon={<Icon name={s.icon} className="size-3.5" />}>
      {s.label}
    </Badge>
  );
}
