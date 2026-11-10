/** TEST-ONLY report fixture built from the real Module 1 templates and realistic saved results. */
import { getModule } from "@/content/modules";
import { getScenarioTemplate } from "@/content/scenarios/templates.server";
import { buildResultsView, type EvaluationRow } from "@/lib/evaluation/results";
import { buildModuleReport } from "@/lib/report/build";

// ---------------------------------------------------------------------------------------------------------------------
function evaluation(over: Partial<EvaluationRow>): EvaluationRow {
  return {
    status: "complete",
    source: "gemini",
    decision_correct: true,
    decision_assessment: "correct_strong_reasoning",
    recognized_evidence_ids: [],
    missed_evidence_ids: [],
    unsupported_assumptions: [],
    reasoning_explanation: "You noticed the request for a code.",
    verification_feedback: "Checking the app was the right move.",
    payment_behavior_feedback: "",
    improvement_advice: "Next time, also check the sender.",
    educational_takeaway: "Codes are keys.",
    humorous_comment: "This must never appear in the report.",
    failure_count: 0,
    ...over,
  };
}

export function sampleReport() {
  const m = getModule("spot-the-trap")!;
  const t1 = getScenarioTemplate("m1-s1")!;
  const t2 = getScenarioTemplate("m1-s2")!;
  const correct1 = t1.evaluationRubric.correctDecisionIds[0]!;
  const correct2 = t2.render.decisions.find(
    (d) => !t2.evaluationRubric.correctDecisionIds.includes(d.id),
  )!.id;
  const r1 = buildResultsView({
    attemptId: "a1",
    template: t1,
    isPractice: false,
    decisionId: correct1,
    evaluation: evaluation({
      recognized_evidence_ids: ["asked_for_code", "time_pressure"],
      missed_evidence_ids: ["unknown_number", "signin_attempt"],
      unsupported_assumptions: ["Assumed the message was real because it used the right logo."],
    }),
    score: {
      decision_points: 40,
      reasoning_points: 18,
      verification_points: 12,
      payment_safety_points: 10,
      total_points: 80,
      max_points: 100,
    },
    payment: null,
  });
  const r2 = buildResultsView({
    attemptId: "a2",
    template: t2,
    isPractice: false,
    decisionId: correct2,
    evaluation: evaluation({
      decision_correct: false,
      source: "fallback",
      missed_evidence_ids: ["lookalike_domain"],
    }),
    score: {
      decision_points: 0,
      reasoning_points: 5,
      verification_points: 4,
      payment_safety_points: 0,
      total_points: 9,
      max_points: 100,
    },
    payment: { amountText: "$240.00", meaning: "fraud_loss" },
  });
  return buildModuleReport({
    module: m,
    learnerName: "Łukasz Renée Test-Learner",
    completedAt: "2026-11-10T12:00:00Z",
    generatedAt: "2026-11-11T09:00:00Z",
    certificateId: "SS1-7F3A-91C2-0B4E",
    wallet: {
      currency: "USD",
      startingMinor: 300000,
      balanceMinor: 276000,
      spendingMinor: 0,
      fraudLossMinor: 24000,
      pendingMinor: 0,
      paymentCount: 1,
    },
    scenarios: [
      {
        position: 2,
        template: t2,
        fallbackTitle: "x",
        scenarioKey: "m1-s2",
        completedAt: "2026-11-10T12:00:00Z",
        justification: "It looked official ".repeat(40),
        verificationActionIds: [],
        results: r2,
      },
      {
        position: 1,
        template: t1,
        fallbackTitle: "x",
        scenarioKey: "m1-s1",
        completedAt: "2026-11-09T12:00:00Z",
        justification: "They asked for my code and rushed me, so I checked the app first.",
        verificationActionIds: ["check_sender_details", "open_tandempay_app"],
        results: r1,
      },
    ],
  });
}
