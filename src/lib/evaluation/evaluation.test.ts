import { describe, expect, it } from "vitest";
import { SCENARIO_TEMPLATES } from "@/content/scenarios/templates.server";
import { scoreScenario } from "@/lib/domain/scoring";
import { buildAttemptFacts } from "./facts";
import { fallbackEvaluation, FALLBACK_ENCOURAGEMENT, keywordMatches } from "./fallback";
import { buildResultsView } from "./results";
import { evaluationJsonSchema, parseEvaluationOutput } from "./schema";

const m2s1 = SCENARIO_TEMPLATES["m2-s1"]; // fraudulent invoice (payable)
const m2s2 = SCENARIO_TEMPLATES["m2-s2"]; // legitimate laptop purchase (payable)
const ids = (t: typeof m2s1) => t.evidenceDefinitions.map((e) => e.evidenceId);
const core = (t: typeof m2s1) =>
  t.evidenceDefinitions.filter((e) => e.educationalImportance === "core").map((e) => e.evidenceId);

const output = (over: Record<string, unknown> = {}) => ({
  scenarioId: "m2-s1",
  decisionAssessment: "correct_strong_reasoning",
  recognizedEvidenceIds: [ids(m2s1)[0], ids(m2s1)[1]],
  missedEvidenceIds: [],
  unsupportedAssumptions: [],
  reasoningExplanation:
    "You compared the invoice with your billing portal, which is exactly the right instinct.",
  verificationFeedback: "Opening your saved bookmark instead of the email link was a strong check.",
  paymentBehaviorFeedback: "You didn't pay, so your story budget stayed safe.",
  improvementAdvice: "Next time, also compare the sender address with earlier receipts.",
  educationalTakeaway: "Check bills through a channel you already trust.",
  humorousComment: "Your laptop fund just dodged a plot twist.",
  evaluationConfidence: "high",
  ...over,
});
const ctx = (decisionCorrect: boolean) => ({
  scenarioKey: "m2-s1",
  evidenceIds: ids(m2s1),
  coreEvidenceIds: core(m2s1),
  decisionCorrect,
});

describe("Gemini evaluation output validation", () => {
  it("accepts a valid response and completes missed core evidence deterministically", () => {
    const r = parseEvaluationOutput(output(), ctx(true));
    expect(r.recognizedEvidenceIds).toEqual([ids(m2s1)[0], ids(m2s1)[1]]);
    for (const id of core(m2s1))
      if (!r.recognizedEvidenceIds.includes(id)) expect(r.missedEvidenceIds).toContain(id);
    expect(r.humorousComment).not.toBe(r.reasoningExplanation); // separate fields (R14)
  });

  it("discards fabricated evidence IDs instead of scoring them", () => {
    const r = parseEvaluationOutput(
      output({ recognizedEvidenceIds: ["made_up_flag", ids(m2s1)[0]] }),
      ctx(true),
    );
    expect(r.recognizedEvidenceIds).toEqual([ids(m2s1)[0]]);
    expect(r.discardedEvidenceIds).toEqual(["made_up_flag"]);
  });

  it("rejects an assessment that contradicts the fixed answer key", () => {
    expect(() => parseEvaluationOutput(output(), ctx(false))).toThrow();
    expect(() =>
      parseEvaluationOutput(output({ decisionAssessment: "incorrect_unsupported_reasoning" }), ctx(true)),
    ).toThrow();
  });

  it.each([
    ["reasoningExplanation", "PayPal Purchase Protection will refund you within 180 days."],
    ["educationalTakeaway", "Over 60% of invoice scams start this way."],
    ["improvementAdvice", "You earned 30 points for reasoning."],
    ["verificationFeedback", "Visit www.example.com to learn more."],
    ["humorousComment", "Wow, that was a gullible move."],
  ])("rejects %s with invented policy/statistics/points/links/mocking", (field, text) => {
    expect(() => parseEvaluationOutput(output({ [field]: text }), ctx(true))).toThrow();
  });

  it("rejects the wrong scenario and over-long fields", () => {
    expect(() => parseEvaluationOutput(output({ scenarioId: "m2-s2" }), ctx(true))).toThrow();
    expect(() => parseEvaluationOutput(output({ humorousComment: "x".repeat(181) }), ctx(true))).toThrow();
  });

  it("constrains evidence IDs in the JSON schema sent to Gemini (no points field exists)", () => {
    const schema = JSON.stringify(evaluationJsonSchema("m2-s1", ids(m2s1)));
    for (const id of ids(m2s1)) expect(schema).toContain(id);
    expect(schema).not.toMatch(/points|score/i);
  });
});

describe("deterministic scoring from validated evidence (backend authoritative)", () => {
  const facts = (decisionId: string, justification: string, actions: string[], t = m2s1) =>
    buildAttemptFacts({
      template: t,
      isPractice: false,
      decisionId,
      justification,
      recordedActionIds: actions,
      payment: { kind: "not_applicable" },
    });

  it("gives decision points from the answer key, never from Gemini's opinion", () => {
    const correct = t2Correct();
    const f = facts(correct, "The sender domain is different from my earlier receipts.", []);
    expect(f.decisionCorrect).toBe(true);
    const s = scoreScenario(m2s1.evaluationRubric, f.behavior, {
      source: "gemini",
      addressedEvidenceIds: [],
    });
    expect(s.decisionPoints).toBe(40);
    expect(s.reasoningPoints).toBe(0); // the right decision alone earns no reasoning credit
  });

  it("is reproducible: same validated IDs and actions → same points", () => {
    const f = facts(
      t2Correct(),
      "x".repeat(25),
      m2s1.evaluationRubric.verificationActions.map((v) => v.id),
    );
    const a = scoreScenario(m2s1.evaluationRubric, f.behavior, {
      source: "gemini",
      addressedEvidenceIds: ids(m2s1),
    });
    const b = scoreScenario(m2s1.evaluationRubric, f.behavior, {
      source: "gemini",
      addressedEvidenceIds: ids(m2s1),
    });
    expect(a).toEqual(b);
    expect(a.totalPoints).toBe(100);
  });

  it("classifies a captured payment from the answer key (fraud loss vs spending)", () => {
    const pay = (t: typeof m2s1) => t.paymentConfiguration.payableDecisionIds[0]!;
    const captured = { kind: "captured" as const, amountText: "US$300.00", practice: false };
    expect(
      buildAttemptFacts({
        template: m2s1,
        isPractice: false,
        decisionId: pay(m2s1),
        justification: "x",
        recordedActionIds: [],
        payment: captured,
      }).paymentClassification,
    ).toBe("fraud_loss");
    expect(
      buildAttemptFacts({
        template: m2s2,
        isPractice: false,
        decisionId: pay(m2s2),
        justification: "x",
        recordedActionIds: [],
        payment: captured,
      }).paymentClassification,
    ).toBe("spending");
    expect(
      buildAttemptFacts({
        template: m2s1,
        isPractice: false,
        decisionId: pay(m2s1),
        justification: "x",
        recordedActionIds: [],
        payment: { kind: "not_paid", amountText: "US$300.00" },
      }).paymentClassification,
    ).toBeNull();
  });
});

function t2Correct() {
  return m2s1.evaluationRubric.correctDecisionIds[0]!;
}

describe("basic fallback (only after a real Gemini failure)", () => {
  it("matches whole keyword phrases and never invents humor", () => {
    const sample = m2s1.evidenceDefinitions[0]!;
    const text = `I noticed the ${sample.keywords[0]} looked different from before.`;
    expect(keywordMatches(m2s1, text)).toContain(sample.evidenceId);
    expect(keywordMatches(m2s1, "Everything looked fine to me honestly.")).toEqual([]);
    const f = buildAttemptFacts({
      template: m2s1,
      isPractice: false,
      decisionId: t2Correct(),
      justification: text,
      recordedActionIds: [],
      payment: { kind: "not_applicable" },
    });
    const out = fallbackEvaluation(m2s1, f);
    expect(out.humorousComment).toBe(FALLBACK_ENCOURAGEMENT);
    expect(out.reasoningExplanation).toBe(m2s1.fallbackContent.feedbackCorrect);
    expect(out.evaluationConfidence).toBe("low");
  });
});

describe("results view", () => {
  it("shows recognized and missed evidence titles only for the completed attempt's own scenario", () => {
    const v = buildResultsView({
      attemptId: "a",
      template: m2s1,
      isPractice: true,
      decisionId: t2Correct(),
      evaluation: {
        status: "complete",
        source: "gemini",
        decision_correct: true,
        decision_assessment: "correct_strong_reasoning",
        recognized_evidence_ids: [ids(m2s1)[0]!],
        missed_evidence_ids: [ids(m2s1)[1]!, "unknown"],
        unsupported_assumptions: [],
        reasoning_explanation: "r",
        verification_feedback: "v",
        payment_behavior_feedback: "p",
        improvement_advice: "i",
        educational_takeaway: "t",
        humorous_comment: "h",
        failure_count: 0,
      },
      score: {
        decision_points: 40,
        reasoning_points: 10,
        verification_points: 0,
        payment_safety_points: 10,
        total_points: 60,
        max_points: 100,
      },
      payment: null,
    });
    expect(v.recognized.map((e) => e.id)).toEqual([ids(m2s1)[0]]);
    expect(v.missed.map((e) => e.id)).toEqual([ids(m2s1)[1]]);
    expect(v.isPractice).toBe(true);
    expect(v.humorousComment).toBe("h");
  });
});
