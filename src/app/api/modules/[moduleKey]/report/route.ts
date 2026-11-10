import { errorResponse, requireApiUser } from "@/lib/api/server";
import { renderReportPdf } from "@/lib/pdf/render";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { loadModuleReport } from "@/lib/report/server";

type Context = { params: Promise<{ moduleKey: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/modules/[moduleKey]/report — (Step 11) the caller's own module analysis report as a PDF download (R26).
 * Session user only; the module must be COMPLETED (409 otherwise); rows are read through RLS with an explicit user
 * filter, so another user's report can't be produced. Generated on demand from stored results (no Gemini, no writes,
 * independent of Zapier) and never cached by browsers or proxies.
 */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { moduleKey } = await params;
    const { supabase, user } = await requireApiUser();
    await requireOnboardedProgressProfile(supabase, user.id);
    const { report, fileName } = await loadModuleReport(supabase, user.id, moduleKey);
    const pdf = await renderReportPdf(report);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
