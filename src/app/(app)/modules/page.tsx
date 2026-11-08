import type { Metadata } from "next";
import { MODULES } from "@/content/modules";
import { DEMO_MODULE_STATUS, DEMO_SCENARIOS } from "@/lib/demo/demoData";
import { ModuleCard } from "@/components/dashboard/ModuleCard";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Modules" };

export default function ModulesPage() {
  return (
    <div className="container-page py-8 sm:py-12">
      <DemoNotice className="mb-6" />
      <PageHeader
        eyebrow="Modules"
        title="Three modules, one step at a time"
        description="Each module has two immersive scenarios. Finish both to earn the module badge and unlock the next one."
      />
      <div className="mt-8 flex flex-col gap-4">
        {MODULES.map((m) => (
          <ModuleCard
            key={m.key}
            module={m}
            status={DEMO_MODULE_STATUS[m.key]}
            scenarios={DEMO_SCENARIOS[m.key]}
          />
        ))}
      </div>
    </div>
  );
}
