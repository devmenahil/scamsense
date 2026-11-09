import "server-only";
/**
 * Reasoning evaluation service (Step 8, Component D).
 *
 * After the decision AND explanation are locked and any Sandbox checkout is resolved (state FINALIZED), ONE Gemini
 * request evaluates the actual explanation against the fixed answer key and writes the feedback and a separate witty
 * comment. The backend validates the evidence IDs, computes every point deterministically (scoring.ts), and then
 * record_attempt_evaluation stores the evaluation, advances the results states, and completes the attempt in one
 * transaction (score, payment classification, module completion). Original attempts and replays are evaluated
 * independently (one evaluation row per attempt); replays never touch official results (complete_scenario_attempt).
 *
 * Failure handling: nothing is fabricated. The attempt stays FINALIZED with its decision, explanation, actions, and
 * verified payment intact; the learner can retry (another Gemini call) or, after a real failure, choose clearly
 * labelled basic feedback (authored text + keyword matching). Evaluation never calls PayPal, so it can never cause a
 * second capture or a second Training Funds deduction.
 */
import { getScenarioTemplate } from "@/content/scenarios/templates.server";
import { ApiError } from "@/lib/api/server";
import { generateJson, isGeminiConfigured } from "@/lib/ai/gemini";
import { recordFallback } from "@/lib/ai/usage";
import { formatMoney } from "@/lib/domain/currency";
import { FINALIZED_STATES } from "@/lib/domain/scenarioStateMachine";
import { scoreScenario } from "@/lib/domain/scoring";
import { scenarioAmountMinor } from "@/lib/domain/trainingFunds";
import { attemptFunctionError, loadAttempt, type LoadedAttempt } from "@/lib/scenario/server";
import { recordedActions } from "@/lib/scenario/view";
import { getTrustedWriter, TrustedWriterNotConfiguredError } from "@/lib/supabase/admin";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { fallbackEvaluation } from "./fallback";
import { buildAttemptFacts, type AttemptFacts, type PaymentFact } from "./facts";
import { buildEvaluationPrompt, EVALUATION_PROMPT_VERSION, EVALUATION_SYSTEM } from "./prompt";
import { buildResultsView, type EvaluationRow, type ResultsView, type ScoreRow } from "./results";
import { evaluationJsonSchema, parseEvaluationOutput, type EvaluationOutput } from "./schema";

export type EvaluationStatus =
  | { status: "complete"; results: ResultsView | null }
  | { status: "pending" }
  | { status: "failed"; basicAvailable: boolean; geminiAvailable: boolean }
  | { status: "not_ready" };

const EVAL_SELECT =
  "status, source, decision_correct, decision_assessment, recognized_evidence_ids, missed_evidence_ids, unsupported_assumptions, reasoning_explanation, verification_feedback, payment_behavior_feedback, improvement_advice, educational_takeaway, humorous_comment, failure_count";

function writer() {
  try {
    return getTrustedWriter();
  } catch (e) {
    if (e instanceof TrustedWriterNotConfiguredError)
      throw new ApiError(
        503,
        "service_unavailable",
        "Feedback can't be saved right now. Please try again later.",
      );
    throw e;
  }
}

export function paymentFact(loaded: LoadedAttempt, isPayDecision: boolean): PaymentFact {
  if (!isPayDecision) return { kind: "not_applicable" };
  const amountText = formatMoney(
    scenarioAmountMinor(loaded.attempt.scenarioKey, loaded.run.startingFundsMinor),
    loaded.run.currency,
  );
  const captured = loaded.payments.find((p) => p.status === "CAPTURED");
  return captured
    ? {
        kind: "captured",
        amountText: formatMoney(captured.amountMinor, captured.currency),
        practice: loaded.attempt.isPractice,
      }
    : { kind: "not_paid", amountText };
}

async function readEvaluation(supabase: SupabaseServerClient, userId: string, attemptId: string) {
  const { data, error } = await supabase
    .from("attempt_evaluations")
    .select(EVAL_SELECT)
    .eq("attempt_id", attemptId)
    .eq("user_id", userId)
    .maybeSingle<EvaluationRow>();
  if (error) return null;
  return data;
}

async function readScore(supabase: SupabaseServerClient, userId: string, attemptId: string) {
  const { data } = await supabase
    .from("scenario_scores")
    .select(
      "decision_points, reasoning_points, verification_points, payment_safety_points, total_points, max_points",
    )
    .eq("attempt_id", attemptId)
    .eq("user_id", userId)
    .maybeSingle<ScoreRow>();
  return data ?? null;
}

async function loadEvaluationProfile(supabase: SupabaseServerClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("occupation, custom_occupation, financial_goal, custom_goal, age_bracket")
    .eq("user_id", userId)
    .maybeSingle<{
      occupation: string | null;
      custom_occupation: string | null;
      financial_goal: string | null;
      custom_goal: string | null;
      age_bracket: string | null;
    }>();
  return {
    occupation: data?.occupation ?? null,
    customOccupation: data?.custom_occupation ?? null,
    financialGoal: data?.financial_goal ?? null,
    customGoal: data?.custom_goal ?? null,
    ageBracket: data?.age_bracket ?? null,
  };
}

/** Stored status/results of an attempt's evaluation. Never calls Gemini (revisiting results costs nothing). */
export async function getEvaluationStatus(
  supabase: SupabaseServerClient,
  userId: string,
  loaded: LoadedAttempt,
): Promise<EvaluationStatus> {
  const { attempt } = loaded;
  if (!(FINALIZED_STATES as readonly string[]).includes(attempt.state)) return { status: "not_ready" };
  const row = await readEvaluation(supabase, userId, attempt.id);
  if (row?.status === "complete" && attempt.state === "COMPLETED") {
    return { status: "complete", results: await buildResults(supabase, userId, loaded, row) };
  }
  if (row?.status === "failed" || (!row && !isGeminiConfigured())) {
    return { status: "failed", basicAvailable: true, geminiAvailable: isGeminiConfigured() };
  }
  if (row?.status === "pending") return { status: "pending" };
  return { status: "pending" };
}

async function buildResults(
  supabase: SupabaseServerClient,
  userId: string,
  loaded: LoadedAttempt,
  row: EvaluationRow,
): Promise<ResultsView | null> {
  const template = getScenarioTemplate(loaded.attempt.scenarioKey);
  if (!template || !loaded.attempt.decisionId) return null;
  const score = await readScore(supabase, userId, loaded.attempt.id);
  const captured = loaded.payments.find((p) => p.status === "CAPTURED");
  return buildResultsView({
    attemptId: loaded.attempt.id,
    template,
    isPractice: loaded.attempt.isPractice,
    decisionId: loaded.attempt.decisionId,
    evaluation: row,
    score,
    payment: captured
      ? {
          amountText: formatMoney(captured.amountMinor, captured.currency),
          meaning:
            template.paymentConfiguration.outcome === "none" ? null : template.paymentConfiguration.outcome,
        }
      : null,
  });
}

/**
 * Evaluates a finalized attempt once. `mode: "basic"` is only accepted after a real Gemini failure (or when Gemini
 * isn't configured), so basic feedback can't be used to skip the AI assessment.
 */
export async function evaluateAttempt(
  supabase: SupabaseServerClient,
  userId: string,
  attemptId: string,
  mode: "ai" | "basic",
): Promise<EvaluationStatus> {
  const loaded = await loadAttempt(supabase, userId, attemptId);
  const { attempt } = loaded;
  if (attempt.state === "COMPLETED") return getEvaluationStatus(supabase, userId, loaded);
  if (
    !(FINALIZED_STATES as readonly string[]).includes(attempt.state) ||
    !attempt.decisionId ||
    !attempt.justification
  )
    throw new ApiError(409, "not_finalized", "Finish your decision and explanation first.");

  const template = getScenarioTemplate(attempt.scenarioKey);
  if (!template) throw new ApiError(404, "unknown_scenario", "That scenario doesn't exist.");

  const previous = await readEvaluation(supabase, userId, attemptId);
  if (mode === "basic" && !((previous?.failure_count ?? 0) > 0 || !isGeminiConfigured()))
    throw new ApiError(
      409,
      "basic_not_available",
      "Personalized feedback is still available. Please try again.",
    );

  const w = writer();
  const { data: claim, error: claimError } = await w.rpc("claim_attempt_evaluation", {
    p_user_id: userId,
    p_attempt_id: attemptId,
  });
  if (claimError) throw attemptFunctionError(claimError);
  if (claim === "complete")
    return getEvaluationStatus(supabase, userId, await loadAttempt(supabase, userId, attemptId));
  if (claim === "busy") return { status: "pending" };

  const decision = template.render.decisions.find((d) => d.id === attempt.decisionId);
  const facts: AttemptFacts = buildAttemptFacts({
    template,
    isPractice: attempt.isPractice,
    decisionId: attempt.decisionId,
    justification: attempt.justification,
    recordedActionIds: recordedActions(loaded.events),
    payment: paymentFact(loaded, decision?.kind === "pay"),
  });

  let output: EvaluationOutput;
  let source: "gemini" | "fallback";
  let meta: {
    model: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number | null;
  };
  if (mode === "basic") {
    output = fallbackEvaluation(template, facts);
    source = "fallback";
    meta = { model: null, inputTokens: null, outputTokens: null, latencyMs: null };
    recordFallback("evaluation");
  } else {
    const evidenceIds = template.evidenceDefinitions.map((e) => e.evidenceId);
    const result = await generateJson({
      category: "evaluation",
      rateKey: userId,
      systemInstruction: EVALUATION_SYSTEM,
      prompt: buildEvaluationPrompt({
        template,
        facts,
        storyDetails: loaded.personalization?.slots ?? {},
        profile: await loadEvaluationProfile(supabase, userId),
      }),
      jsonSchema: evaluationJsonSchema(template.scenarioId, evidenceIds),
      parse: (raw) =>
        parseEvaluationOutput(raw, {
          scenarioKey: template.scenarioId,
          evidenceIds,
          coreEvidenceIds: template.evidenceDefinitions
            .filter((e) => e.educationalImportance === "core")
            .map((e) => e.evidenceId),
          decisionCorrect: facts.decisionCorrect,
        }),
      maxOutputTokens: 1_800,
      temperature: 0.3,
      thinking: "low",
    });
    if (!result.ok) {
      await w.rpc("fail_attempt_evaluation", {
        p_user_id: userId,
        p_attempt_id: attemptId,
        p_reason: result.reason,
      });
      return { status: "failed", basicAvailable: true, geminiAvailable: result.reason !== "not_configured" };
    }
    output = result.value;
    source = "gemini";
    meta = {
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      latencyMs: result.latencyMs,
    };
  }

  // Points: deterministic, from the validated evidence IDs and the engine-recorded actions (R13, R32).
  const score = scoreScenario(template.evaluationRubric, facts.behavior, {
    source,
    addressedEvidenceIds: output.recognizedEvidenceIds,
  });

  const { error } = await w.rpc("record_attempt_evaluation", {
    p_user_id: userId,
    p_attempt_id: attemptId,
    p_source: source,
    p_model: meta.model,
    p_prompt_version: source === "gemini" ? EVALUATION_PROMPT_VERSION : "basic-fallback-1",
    p_decision_correct: score.decisionCorrect,
    p_decision_assessment: output.decisionAssessment,
    p_recognized_evidence_ids: score.addressedEvidenceIds,
    p_missed_evidence_ids: output.missedEvidenceIds,
    p_unsupported_assumptions: output.unsupportedAssumptions,
    p_reasoning_explanation: output.reasoningExplanation,
    p_verification_feedback: output.verificationFeedback,
    p_payment_behavior_feedback: output.paymentBehaviorFeedback,
    p_improvement_advice: output.improvementAdvice,
    p_educational_takeaway: output.educationalTakeaway,
    p_humorous_comment: output.humorousComment,
    p_evaluation_confidence: output.evaluationConfidence,
    p_input_tokens: meta.inputTokens,
    p_output_tokens: meta.outputTokens,
    p_latency_ms: meta.latencyMs,
    p_decision_points: score.decisionPoints,
    p_reasoning_points: score.reasoningPoints,
    p_verification_points: score.verificationPoints,
    p_payment_safety_points: score.paymentSafetyPoints,
    p_verification_action_ids: score.verificationActionIds,
    p_scoring_version: score.scoringVersion,
    p_payment_classification: facts.paymentClassification,
  });
  if (error) {
    // The Gemini result is lost but nothing else changed; the claim expires and a retry evaluates again.
    await w.rpc("fail_attempt_evaluation", {
      p_user_id: userId,
      p_attempt_id: attemptId,
      p_reason: "save_failed",
    });
    throw attemptFunctionError(error);
  }
  return getEvaluationStatus(supabase, userId, await loadAttempt(supabase, userId, attemptId));
}
