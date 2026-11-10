import "server-only";
/**
 * Module analysis report loader (Step 11). Reads only the caller's own rows through their session client (RLS + an
 * explicit user filter), requires the module run to be COMPLETED, and never writes or calls Gemini. Downloading again
 * produces the same content (apart from the "generated on" date) and changes nothing stored.
 */
import { getModule } from "@/content/modules";
import { getScenarioTemplate } from "@/content/scenarios/templates.server";
import { ApiError, dbError } from "@/lib/api/server";
import { summarizeWallet } from "@/lib/domain/wallet";
import { getEvaluationStatus } from "@/lib/evaluation/server";
import { LEDGER_COLUMNS, rowToLedgerEntry, type LedgerRow } from "@/lib/progress/mapping";
import { loadAttempt } from "@/lib/scenario/server";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { reportFileName } from "@/lib/rewards/certificate";
import { buildModuleReport, type ModuleReport, type ReportScenarioInput } from "./build";

export async function loadModuleReport(
  supabase: SupabaseServerClient,
  userId: string,
  moduleKey: string,
): Promise<{ report: ModuleReport; fileName: string }> {
  const m = getModule(moduleKey);
  if (!m) throw new ApiError(404, "not_found", "We couldn't find that module.");

  const run = await supabase
    .from("module_runs")
    .select("id, completed_at")
    .eq("user_id", userId)
    .eq("module_key", m.key)
    .maybeSingle<{ id: string; completed_at: string | null }>();
  if (run.error) throw dbError(run.error, "Reports");
  if (!run.data?.completed_at)
    throw new ApiError(
      409,
      "module_not_completed",
      "Your report is ready once you finish both scenarios in this module.",
    );
  const runId = run.data.id;
  const completedAt = run.data.completed_at;

  const [ledger, originals, scores, certificate, profile] = await Promise.all([
    supabase
      .from("wallet_ledger_entries")
      .select(LEDGER_COLUMNS)
      .eq("user_id", userId)
      .eq("module_run_id", runId)
      .order("id", { ascending: true })
      .returns<LedgerRow[]>(),
    supabase
      .from("scenario_attempts")
      .select("id, scenario_key, completed_at")
      .eq("user_id", userId)
      .eq("module_run_id", runId)
      .eq("attempt_number", 1)
      .eq("state", "COMPLETED")
      .returns<{ id: string; scenario_key: string; completed_at: string | null }[]>(),
    supabase
      .from("scenario_scores")
      .select("attempt_id, verification_action_ids")
      .eq("user_id", userId)
      .eq("module_run_id", runId)
      .eq("is_replay", false)
      .returns<{ attempt_id: string; verification_action_ids: string[] }[]>(),
    // Optional: the report works even if certificates are unavailable.
    supabase
      .from("certificates")
      .select("certificate_code, recipient_name")
      .eq("user_id", userId)
      .eq("module_key", m.key)
      .maybeSingle<{ certificate_code: string; recipient_name: string }>(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle<{ display_name: string }>(),
  ]);
  if (originals.error) throw dbError(originals.error, "Reports");

  const wallet = ledger.error ? null : summarizeWallet((ledger.data ?? []).map(rowToLedgerEntry));
  const verificationByAttempt = new Map(
    (scores.error ? [] : (scores.data ?? [])).map((s) => [s.attempt_id, s.verification_action_ids ?? []]),
  );

  const scenarios: ReportScenarioInput[] = await Promise.all(
    m.scenarios.map(async (slot) => {
      const attempt = (originals.data ?? []).find((a) => a.scenario_key === slot.key);
      const base: ReportScenarioInput = {
        position: slot.position,
        template: getScenarioTemplate(slot.key),
        fallbackTitle: slot.title,
        scenarioKey: slot.key,
        completedAt: attempt?.completed_at ?? null,
        justification: null,
        verificationActionIds: attempt ? (verificationByAttempt.get(attempt.id) ?? []) : [],
        results: null,
      };
      if (!attempt) return base;
      try {
        const loaded = await loadAttempt(supabase, userId, attempt.id);
        const status = await getEvaluationStatus(supabase, userId, loaded); // stored data only, never Gemini
        return {
          ...base,
          justification: loaded.attempt.justification,
          results: status.status === "complete" ? status.results : null,
        };
      } catch (e) {
        console.error("[report] scenario data unavailable", {
          name: e instanceof Error ? e.name : "unknown",
        });
        return base;
      }
    }),
  );

  const certData = certificate.error ? null : certificate.data;
  const report = buildModuleReport({
    module: m,
    learnerName: certData?.recipient_name ?? profile.data?.display_name ?? "ScamSense learner",
    completedAt,
    generatedAt: new Date().toISOString(),
    certificateId: certData?.certificate_code ?? null,
    wallet,
    scenarios,
  });
  return { report, fileName: reportFileName(m.order, m.title, completedAt) };
}
