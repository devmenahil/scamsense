import "server-only";
/**
 * Reveal the Red Flags service (Step 9). READ-ONLY: it loads the learner's own attempt through the session client
 * (RLS + explicit user filter, so another user's attempt is a 404), refuses anything that isn't COMPLETED (hidden
 * evidence never leaves the server before completion), and reads the stored Step 8 evaluation. It never writes,
 * never records actions, never calls PayPal, and never calls Gemini.
 */
import { getScenarioTemplate } from "@/content/scenarios/templates.server";
import { ApiError } from "@/lib/api/server";
import { buildClientView } from "@/lib/scenario/view";
import { loadAttempt, type LoadedAttempt } from "@/lib/scenario/server";
import { recordedActions } from "@/lib/scenario/view";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { buildReviewView, type ReviewView } from "./view";

export class NotCompletedError extends Error {}

interface StoredEvaluation {
  status: string;
  source: "gemini" | "fallback" | null;
  recognized_evidence_ids: string[] | null;
  missed_evidence_ids: string[] | null;
  unsupported_assumptions: string[] | null;
}

export async function readStoredEvaluation(
  supabase: SupabaseServerClient,
  userId: string,
  attemptId: string,
) {
  const { data, error } = await supabase
    .from("attempt_evaluations")
    .select("status, source, recognized_evidence_ids, missed_evidence_ids, unsupported_assumptions")
    .eq("attempt_id", attemptId)
    .eq("user_id", userId)
    .maybeSingle<StoredEvaluation>();
  if (error || !data || data.status !== "complete") return null;
  return {
    source: data.source,
    recognizedEvidenceIds: data.recognized_evidence_ids ?? [],
    missedEvidenceIds: data.missed_evidence_ids ?? [],
    unsupportedAssumptions: data.unsupported_assumptions ?? [],
  };
}

/** Builds the review from an already-loaded attempt. Throws NotCompletedError for unfinished attempts. */
export function reviewFromLoaded(
  loaded: LoadedAttempt,
  displayName: string | null,
  evaluation: Awaited<ReturnType<typeof readStoredEvaluation>>,
): ReviewView {
  const { attempt } = loaded;
  if (attempt.state !== "COMPLETED" || !attempt.decisionId) throw new NotCompletedError();
  const template = getScenarioTemplate(attempt.scenarioKey);
  if (!template) throw new ApiError(404, "unknown_scenario", "That scenario doesn't exist.");
  // The exact narrative the learner played: same tokens, same stored personalization (never regenerated).
  const played = buildClientView({ ...loaded, displayName });
  return buildReviewView({
    attemptId: attempt.id,
    template,
    render: played.render,
    module: played.module,
    attemptNumber: attempt.attemptNumber,
    isPractice: attempt.isPractice,
    decisionId: attempt.decisionId,
    learnerActions: recordedActions(loaded.events),
    evaluation,
  });
}

export async function loadReview(
  supabase: SupabaseServerClient,
  userId: string,
  attemptId: string,
  displayName: string | null,
): Promise<ReviewView> {
  const loaded = await loadAttempt(supabase, userId, attemptId);
  if (loaded.attempt.state !== "COMPLETED") throw new NotCompletedError();
  return reviewFromLoaded(loaded, displayName, await readStoredEvaluation(supabase, userId, attemptId));
}
