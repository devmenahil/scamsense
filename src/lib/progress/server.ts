import "server-only";
import { ApiError, dbError } from "@/lib/api/server";
import { buildProgressSnapshot, type ProgressSnapshot } from "@/lib/domain/progress";
import { assertModuleUnlocked, ProgressionError } from "@/lib/domain/progression";
import { calculateStartingFunds } from "@/lib/domain/trainingFunds";
import type { Profile } from "@/lib/profile/schema";
import { getTrustedWriter, TrustedWriterNotConfiguredError } from "@/lib/supabase/admin";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import {
  ATTEMPT_COLUMNS,
  LEDGER_COLUMNS,
  RUN_COLUMNS,
  rowToAttempt,
  rowToLedgerEntry,
  rowToRun,
  SCORE_COLUMNS,
  scoredOnly,
  type AttemptRow,
  type LedgerRow,
  type RunRow,
  type ScoreRow,
} from "./mapping";

/**
 * Progress data access. READS use the signed-in user's session client, so Row Level Security scopes every row to the
 * user. WRITES use the trusted writer (service_role) with the user id from the verified session only.
 */

export async function loadProgressSnapshot(
  supabase: SupabaseServerClient,
  userId: string,
  profile: Pick<Profile, "incomeBracket" | "preferredCurrency">,
): Promise<ProgressSnapshot> {
  const [runs, attempts, ledger, scores] = await Promise.all([
    supabase.from("module_runs").select(RUN_COLUMNS).eq("user_id", userId).returns<RunRow[]>(),
    supabase.from("scenario_attempts").select(ATTEMPT_COLUMNS).eq("user_id", userId).returns<AttemptRow[]>(),
    supabase
      .from("wallet_ledger_entries")
      .select(LEDGER_COLUMNS)
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .returns<LedgerRow[]>(),
    supabase.from("scenario_scores").select(SCORE_COLUMNS).eq("user_id", userId).returns<ScoreRow[]>(),
  ]);
  for (const r of [runs, attempts, ledger, scores]) if (r.error) throw dbError(r.error, "Your progress");
  return buildProgressSnapshot({
    runs: (runs.data ?? []).map(rowToRun),
    attempts: (attempts.data ?? []).map(rowToAttempt),
    ledger: (ledger.data ?? []).map(rowToLedgerEntry),
    scores: scoredOnly(scores.data ?? []),
    profile: { incomeBracket: profile.incomeBracket, preferredCurrency: profile.preferredCurrency },
  });
}

/** Maps the migration's stable P0001 messages to calm API errors. */
function functionError(error: { code?: string; message?: string }): ApiError {
  if (error.code === "P0001") {
    switch (error.message) {
      case "module_locked":
        return new ApiError(
          409,
          "module_locked",
          "Finish both scenarios in the previous module to unlock this one.",
        );
      default:
        console.error("[progress] rejected by database", { reason: error.message });
        return new ApiError(
          409,
          "conflict",
          "That action isn't available right now. Please refresh and try again.",
        );
    }
  }
  return dbError(error, "Training Funds");
}

/**
 * Starts a module's training-funds period (R20): snapshots the currency and starting funds from the profile and
 * writes the MODULE_START ledger entry. Idempotent: an already started module is returned unchanged.
 */
export async function startModule(
  supabase: SupabaseServerClient,
  userId: string,
  profile: Pick<Profile, "incomeBracket" | "preferredCurrency">,
  moduleKey: string,
): Promise<{ moduleKey: string; alreadyStarted: boolean }> {
  const snapshot = await loadProgressSnapshot(supabase, userId, profile);
  let moduleProgress;
  try {
    moduleProgress = assertModuleUnlocked(snapshot.progression, moduleKey);
  } catch (e) {
    if (e instanceof ProgressionError) {
      throw new ApiError(e.code === "unknown_module" ? 404 : 409, e.code, e.message);
    }
    throw e;
  }
  if (moduleProgress.started) return { moduleKey, alreadyStarted: true };

  const funds = calculateStartingFunds(profile);
  let writer;
  try {
    writer = getTrustedWriter();
  } catch (e) {
    if (e instanceof TrustedWriterNotConfiguredError) {
      console.error("[progress] trusted writer not configured");
      throw new ApiError(
        503,
        "service_unavailable",
        "Training funds can't be set up right now. Please try again later.",
      );
    }
    throw e;
  }
  const { error } = await writer.rpc("start_module_run", {
    p_user_id: userId,
    p_module_key: moduleKey,
    p_currency: funds.currency,
    p_starting_funds_minor: funds.startingFundsMinor,
  });
  if (error) throw functionError(error);
  return { moduleKey, alreadyStarted: false };
}
