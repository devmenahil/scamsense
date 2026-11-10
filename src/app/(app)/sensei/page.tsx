import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { listDiscussableAttempts } from "@/lib/kenshi/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KenshiAvatar } from "@/components/kenshi/KenshiAvatar";
import { KenshiChat } from "@/components/kenshi/KenshiChat";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Sensei Kenshi" };
export const dynamic = "force-dynamic";

/**
 * Sensei Kenshi full-page chat (Step 10). The same chat and the same server-side answer protection as the panel: only
 * COMPLETED attempts can be discussed; unfinished scenarios are never revealed.
 */
export default async function SenseiPage() {
  const user = await getCurrentUser();
  let discussable: Awaited<ReturnType<typeof listDiscussableAttempts>> = [];
  if (user) {
    try {
      discussable = await listDiscussableAttempts(await createSupabaseServerClient(), user.id);
    } catch {
      discussable = [];
    }
  }
  return (
    <div className="container-page py-8 sm:py-12">
      <PageHeader
        eyebrow="Sensei Kenshi"
        title="Ask your learning companion"
        description="Questions about scams, safe payments, PayPal's protections and reporting, or the scenarios you've finished. For PayPal policy, Kenshi only uses ScamSense's verified U.S. sources and links to the official pages."
        className="mb-6"
        actions={<KenshiAvatar size="lg" title="Sensei Kenshi" />}
      />
      <div className="flex h-[min(78dvh,46rem)] min-h-[30rem] flex-col overflow-hidden rounded-panel border-2 border-teal shadow-edge">
        <KenshiChat className="flex-1" discussable={discussable} hasCompleted={discussable.length > 0} />
      </div>
    </div>
  );
}
