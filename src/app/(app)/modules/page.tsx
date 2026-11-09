import type { Metadata } from "next";
import { getCurrentProgress } from "@/lib/progress/current";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { ProgressUnavailable } from "@/components/dashboard/ProgressUnavailable";
import { ProfileUnavailable } from "@/components/profile/ProfileUnavailable";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Modules" };

export default async function ModulesPage() {
  const result = await getCurrentProgress("/modules");
  if (result.status === "missing" || result.status === "error")
    return <ProfileUnavailable reason={result.status} />;
  return (
    <div className="container-page py-8 sm:py-12">
      <PageHeader
        eyebrow="Modules"
        title="Three modules, one step at a time"
        description="Each module has two immersive scenarios. Finish both to earn the module badge and unlock the next one. You can replay finished scenarios any time."
      />
      {result.status === "progress_unavailable" ? (
        <ProgressUnavailable className="mt-8" href="/modules" />
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {result.snapshot.progression.modules.map((m) => (
            <ModuleCard key={m.module.key} progress={m} />
          ))}
        </div>
      )}
    </div>
  );
}
