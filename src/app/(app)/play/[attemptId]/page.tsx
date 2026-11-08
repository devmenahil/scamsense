import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEMO_ATTEMPT_ID, DEMO_SCENARIOS } from "@/lib/demo/demoData";
import { ScenarioPlayerShell } from "@/components/scenario/ScenarioPlayerShell";

export const metadata: Metadata = { title: "Scenario" };

type Props = { params: Promise<{ attemptId: string }> };

/** Phase 1: only the demonstration attempt exists. Real attempts are loaded via GET /api/attempts/[id] in Phase 4. */
export default async function PlayPage({ params }: Props) {
  const { attemptId } = await params;
  if (attemptId !== DEMO_ATTEMPT_ID) notFound();
  const scenario = DEMO_SCENARIOS["spot-the-trap"][1]!;
  return (
    <ScenarioPlayerShell
      attemptId={attemptId}
      introLine={scenario.introLine}
      moduleHref="/modules/spot-the-trap"
      context={`Spot the Trap · ${scenario.label} (demo)`}
    />
  );
}
