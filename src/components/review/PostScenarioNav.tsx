import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons/Icon";
import { KenshiLauncher } from "@/components/kenshi/KenshiLauncher";

type Step = "results" | "review" | "playbook";

const STEPS: { id: Step; label: string; icon: IconName; path: string }[] = [
  { id: "results", label: "Results", icon: "target", path: "results" },
  { id: "review", label: "Reveal the Red Flags", icon: "flag", path: "review" },
  { id: "playbook", label: "Your Recovery Playbook", icon: "book", path: "playbook" },
];

/**
 * Post-scenario debrief navigation (Step 9): Results → Reveal the Red Flags → Your Recovery Playbook → module.
 * Only rendered on pages of a COMPLETED attempt, so it never appears during play. It also carries the Sensei Kenshi
 * entry point for this attempt (Step 10); the server re-checks ownership and completion on every question.
 */
export function PostScenarioNav({
  attemptId,
  moduleKey,
  current,
  scenarioTitle,
  isPractice,
}: {
  attemptId: string;
  moduleKey: string;
  current: Step;
  scenarioTitle: string;
  isPractice: boolean;
}) {
  return (
    <nav aria-label="Scenario debrief" className="mt-5 flex flex-wrap items-center gap-2">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <Link
              href={`/play/${attemptId}/${s.path}`}
              aria-current={current === s.id ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-pill border-2 px-3.5 font-heading text-small font-extrabold",
                current === s.id
                  ? "border-teal bg-teal text-white"
                  : "border-teal/30 hover:border-teal hover:bg-mist",
              )}
            >
              <span className="sr-only">Step {i + 1}: </span>
              <Icon name={s.icon} className="size-4" />
              {s.label}
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href={`/modules/${moduleKey}`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 font-heading text-small font-extrabold underline underline-offset-4"
      >
        Module dashboard
        <Icon name="arrow-right" className="size-4" />
      </Link>
      <KenshiLauncher
        className="sm:ml-auto"
        focus={{ attemptId, title: scenarioTitle, isPractice }}
        label="Ask Sensei Kenshi"
      />
    </nav>
  );
}
