/**
 * Measured Gemini request counts for the Step 8 services (brief §18, §21), with an in-memory database and a fake
 * Gemini transport. These prove WHEN Gemini is called; the live script (npm run test:gemini) proves the real model's
 * output passes validation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCENARIO_TEMPLATES } from "@/content/scenarios/templates.server";
import { createFakeDb, fakeClient, type FakeDb } from "@/lib/testing/fakeSupabase";
import { resetRateLimits, setGeminiDepsForTests, type GeminiDeps } from "./gemini";
import { getUsageSnapshot, resetUsage } from "./usage";

let db: FakeDb;
vi.mock("@/lib/supabase/admin", () => ({
  getTrustedWriter: () => fakeClient(db),
  TrustedWriterNotConfiguredError: class extends Error {},
}));

// The evaluation service loads attempts through the scenario service; tests control what it returns.
const loadAttemptMock = vi.fn();
vi.mock("@/lib/scenario/server", () => ({
  loadAttempt: (...a: unknown[]) => loadAttemptMock(...a),
  attemptFunctionError: (e: { message?: string }) => new Error(e.message),
}));

const { resolveRoutingTags, ensureModuleOrder } = await import("@/lib/routing/server");
const { ensureAttemptPersonalization } = await import("@/lib/personalization/server");
const { evaluateAttempt, getEvaluationStatus } = await import("@/lib/evaluation/server");

const USER = "11111111-1111-4111-8111-111111111111";
type Replier = (prompt: string, schema: Record<string, unknown>) => unknown;

function gemini(reply: Replier | "fail") {
  const deps: GeminiDeps = {
    model: "test-model",
    requestTimeoutMs: 5_000,
    now: () => Date.now(),
    random: () => 0.5,
    sleep: async () => {},
    generate: async (a) => {
      if (reply === "fail") throw Object.assign(new Error("unavailable"), { status: 503 });
      return {
        text: JSON.stringify(reply(a.prompt, a.jsonSchema)),
        finishReason: "STOP",
        inputTokens: 500,
        outputTokens: 200,
      };
    },
  };
  setGeminiDepsForTests(deps);
}

const requests = (c: "classification" | "personalization" | "evaluation") =>
  getUsageSnapshot().categories[c].requests;
const supabase = () => fakeClient(db) as never;

beforeEach(() => {
  db = createFakeDb();
  resetUsage();
  resetRateLimits();
});
afterEach(() => setGeminiDepsForTests(undefined));

/* ------------------------------------------------------------------------------------------------ routing */

const classifierReply: Replier = () => ({
  mappedActivityTags: ["online_selling", "freelancing"],
  mappedContextTags: ["freelancer"],
  contextSummary: "sells commissioned digital art to online clients",
  unmappedDescriptions: [],
  interpretationStatus: "mapped",
  shortExplanation: "Selling commissioned artwork online.",
});

describe("hybrid routing request counts", () => {
  it("Profile A (predefined only): 0 classification requests in every module", async () => {
    gemini(classifierReply);
    db.tables.profiles = [
      {
        user_id: USER,
        occupation: "student",
        custom_occupation: null,
        financial_activities: ["online_shopping", "job_applications"],
        custom_activity: null,
      },
    ];
    for (const m of ["spot-the-trap", "trust-under-pressure", "outsmart-the-scam"] as const)
      await ensureModuleOrder(supabase(), USER, m, { allowGemini: true });
    expect(requests("classification")).toBe(0);
    expect(db.tables.module_scenario_orders!.map((o) => o.scenario_order)).toEqual([
      ["m1-s1", "m1-s2"],
      ["m2-s2", "m2-s1"],
      ["m3-s1", "m3-s2"],
    ]);
    expect(db.tables.module_scenario_orders!.every((o) => o.routing_source === "predefined")).toBe(true);
  });

  it("Profile D (custom text): 1 classification, cached and reused by every later module", async () => {
    gemini(classifierReply);
    db.tables.profiles = [
      {
        user_id: USER,
        occupation: "other",
        custom_occupation: "Digital artist selling commissions.",
        financial_activities: ["other"],
        custom_activity: "I accept payments for commissioned artwork through social platforms.",
      },
    ];
    await ensureModuleOrder(supabase(), USER, "spot-the-trap", { allowGemini: true });
    expect(requests("classification")).toBe(1);
    expect(db.tables.profile_interpretations).toHaveLength(1);
    expect(JSON.stringify(db.tables.profile_interpretations)).not.toContain("artist selling"); // no raw text cached
    await ensureModuleOrder(supabase(), USER, "trust-under-pressure", { allowGemini: true });
    await ensureModuleOrder(supabase(), USER, "outsmart-the-scam", { allowGemini: true });
    expect(requests("classification")).toBe(1);
    expect(getUsageSnapshot().categories.classification.cacheHits).toBe(2);
    expect(
      db.tables.module_scenario_orders!.find((o) => o.module_key === "outsmart-the-scam")!.scenario_order,
    ).toEqual(["m3-s2", "m3-s1"]);
  });

  it("changed custom text is classified again; unchanged text never is", async () => {
    gemini(classifierReply);
    const p = {
      occupation: "other",
      customOccupation: "Digital artist",
      financialActivities: ["online_shopping"],
      customActivity: null,
    };
    await resolveRoutingTags(supabase(), USER, p, { allowGemini: true });
    await resolveRoutingTags(
      supabase(),
      USER,
      { ...p, customOccupation: "digital ARTIST" },
      { allowGemini: true },
    );
    expect(requests("classification")).toBe(1);
    await resolveRoutingTags(
      supabase(),
      USER,
      { ...p, customOccupation: "Wedding photographer" },
      { allowGemini: true },
    );
    expect(requests("classification")).toBe(2);
  });

  it("Profile E (custom goal only) and F (vague text): 0 classification requests", async () => {
    gemini(classifierReply);
    const e = await resolveRoutingTags(
      supabase(),
      USER,
      {
        occupation: "student",
        customOccupation: null,
        financialActivities: ["online_shopping"],
        customActivity: null,
      },
      { allowGemini: true },
    );
    const f = await resolveRoutingTags(
      supabase(),
      USER,
      {
        occupation: "other",
        customOccupation: "Something else.",
        financialActivities: ["digital_wallet_usage"],
        customActivity: null,
      },
      { allowGemini: true },
    );
    expect(requests("classification")).toBe(0);
    expect(e.source).toBe("predefined");
    expect(f.source).toBe("custom_neutral");
    expect(f.tags.contextTags).toEqual(["general_consumer"]);
  });

  it("classification failure falls back to safe tags, caches nothing, and routing still works", async () => {
    gemini("fail");
    const r = await resolveRoutingTags(
      supabase(),
      USER,
      {
        occupation: "other",
        customOccupation: "Digital artist",
        financialActivities: ["online_selling"],
        customActivity: null,
      },
      { allowGemini: true },
    );
    expect(r.source).toBe("custom_fallback");
    expect(r.tags).toEqual({ activityTags: ["online_selling"], contextTags: ["general_consumer"] });
    expect(db.tables.profile_interpretations ?? []).toHaveLength(0);
  });

  it("a saved order never changes (refresh, profile edit)", async () => {
    gemini(classifierReply);
    db.tables.profiles = [
      {
        user_id: USER,
        occupation: "student",
        custom_occupation: null,
        financial_activities: ["online_shopping"],
        custom_activity: null,
      },
    ];
    const first = await ensureModuleOrder(supabase(), USER, "trust-under-pressure", { allowGemini: true });
    db.tables.profiles = [
      {
        user_id: USER,
        occupation: "business_owner",
        custom_occupation: null,
        financial_activities: ["business_purchases"],
        custom_activity: null,
      },
    ];
    const again = await ensureModuleOrder(supabase(), USER, "trust-under-pressure", { allowGemini: true });
    expect(again).toMatchObject({ order: first!.order, created: false });
  });
});

/* ------------------------------------------------------------------------------------------------ personalization */

function personalizationRpcs() {
  const rows = (db.tables.scenario_personalizations ??= []);
  const links = (db.tables.attempt_personalizations ??= []);
  let n = 0;
  db.rpc.claim_scenario_personalization = (a) => {
    const ready = rows.find(
      (r) => r.scenario_key === a.p_scenario_key && r.status === "ready" && r.source === "gemini",
    );
    if (ready) return { data: { status: "ready", id: ready.id } };
    const pending = rows.find((r) => r.scenario_key === a.p_scenario_key && r.status === "pending");
    if (pending) return { data: { status: "busy", id: pending.id } };
    const row = {
      id: `p${++n}`,
      user_id: a.p_user_id,
      scenario_key: a.p_scenario_key,
      status: "pending",
      source: null,
      slots: {},
    };
    rows.push(row);
    return { data: { status: "claimed", id: row.id } };
  };
  db.rpc.complete_scenario_personalization = (a) => {
    const row = rows.find((r) => r.id === a.p_personalization_id)!;
    Object.assign(row, { status: "ready", source: a.p_source, slots: a.p_slots });
    return { data: row };
  };
  db.rpc.link_attempt_personalization = (a) => {
    const row = rows.find((r) => r.id === a.p_personalization_id)!;
    links.push({
      attempt_id: a.p_attempt_id,
      user_id: a.p_user_id,
      personalization_id: row.id,
      scenario_personalizations: row,
    });
    return { data: row.id };
  };
}

const personalizationReply: Replier = (_p, schema) => {
  const key = (schema.properties as { scenarioId: { enum: string[] } }).scenarioId.enum[0]!;
  const slots = SCENARIO_TEMPLATES[key as keyof typeof SCENARIO_TEMPLATES].render.slots;
  const values: Record<string, string> = {
    friendName: "Leila",
    friendMessage: "Still meeting at the library later?",
    friendReply: "Yes, see you there!",
    recentMerchant: "Campus Bookstore",
    otherSenderName: "Westbrook College",
    otherDomain: "westbrook-college",
    otherSubject: "Study room booking confirmed",
    otherPreview: "Room C is booked for your group…",
    otherBody: "Room C is booked for your group on Thursday.",
    incomeLabel: "Campus job",
    workspaceName: "Coursework and thesis drafts",
    laptopUse: "coursework and online lectures",
    jobTitle: "Remote Student Support Assistant",
    itemName: "compact camera with spare lens",
    earlierBuyerName: "Nadia Brooks",
  };
  return { scenarioId: key, slots: Object.fromEntries(slots.map((s) => [s.name, values[s.name]])) };
};

const intro = (id: string, scenarioKey: string, state = "INTRO") => ({
  id,
  scenarioKey,
  state,
  startingFundsMinor: 300_000,
  currency: "USD",
});

describe("personalization request counts", () => {
  beforeEach(() => {
    personalizationRpcs();
    db.tables.profiles = [
      {
        user_id: USER,
        occupation: "student",
        financial_activities: ["online_shopping"],
        financial_goal: "buying_laptop",
        payment_experience: "occasional",
      },
    ];
  });

  it("each of the six scenarios gets exactly one personalization request when first played", async () => {
    gemini(personalizationReply);
    const keys = Object.keys(SCENARIO_TEMPLATES);
    for (const [i, key] of keys.entries())
      expect((await ensureAttemptPersonalization(supabase(), USER, intro(`a${i}`, key))).outcome).toBe(
        "generated",
      );
    expect(requests("personalization")).toBe(6);
    expect(db.tables.scenario_personalizations!.every((r) => r.source === "gemini")).toBe(true);
  });

  it("refresh/resume, a started attempt, and a replay never call Gemini again", async () => {
    gemini(personalizationReply);
    await ensureAttemptPersonalization(supabase(), USER, intro("a1", "m2-s2"));
    expect((await ensureAttemptPersonalization(supabase(), USER, intro("a1", "m2-s2"))).outcome).toBe(
      "linked_existing",
    );
    expect(
      (await ensureAttemptPersonalization(supabase(), USER, intro("a1", "m2-s2", "ACTIVE"))).outcome,
    ).toBe("skipped");
    expect((await ensureAttemptPersonalization(supabase(), USER, intro("replay-1", "m2-s2"))).outcome).toBe(
      "reused",
    );
    expect(requests("personalization")).toBe(1);
  });

  it("an attempt already past its intro (legacy) keeps the authored defaults", async () => {
    gemini(personalizationReply);
    expect(
      (await ensureAttemptPersonalization(supabase(), USER, intro("legacy", "m1-s1", "INVESTIGATING")))
        .outcome,
    ).toBe("skipped");
    expect(requests("personalization")).toBe(0);
  });

  it("Gemini down → a tracked fallback instance; play continues; a later new attempt retries", async () => {
    gemini("fail");
    expect((await ensureAttemptPersonalization(supabase(), USER, intro("a1", "m1-s1"))).outcome).toBe(
      "fallback",
    );
    expect(db.tables.scenario_personalizations![0]).toMatchObject({
      status: "ready",
      source: "fallback",
      slots: {},
    });
    gemini(personalizationReply);
    expect((await ensureAttemptPersonalization(supabase(), USER, intro("a2", "m1-s1"))).outcome).toBe(
      "generated",
    );
  });
});

/* ------------------------------------------------------------------------------------------------ evaluation */

const t = SCENARIO_TEMPLATES["m1-s1"];
const correct = t.evaluationRubric.correctDecisionIds[0]!;
function loaded(state: string, attemptId = "e1", isPractice = false) {
  return {
    attempt: {
      id: attemptId,
      scenarioKey: "m1-s1",
      attemptNumber: isPractice ? 2 : 1,
      isPractice,
      state,
      pendingDecisionId: null,
      decisionId: correct,
      justification: "The sender wasn't a saved number and the app said they never ask for codes.",
    },
    events: [{ eventType: "RECORD_ACTION", actionId: "check_sender_details" }],
    run: { currency: "USD", startingFundsMinor: 300_000 },
    payments: [],
    personalization: null,
  };
}

function evaluationRpcs() {
  const evals = (db.tables.attempt_evaluations ??= []);
  db.rpc.claim_attempt_evaluation = (a) => {
    const e = evals.find((x) => x.attempt_id === a.p_attempt_id);
    if (e?.status === "complete") return { data: "complete" };
    if (e?.status === "pending") return { data: "busy" };
    if (e) e.status = "pending";
    else
      evals.push({
        attempt_id: a.p_attempt_id,
        user_id: a.p_user_id,
        status: "pending",
        failure_count: 0,
        recognized_evidence_ids: [],
        missed_evidence_ids: [],
        unsupported_assumptions: [],
      });
    return { data: "claimed" };
  };
  db.rpc.fail_attempt_evaluation = (a) => {
    const e = evals.find((x) => x.attempt_id === a.p_attempt_id)!;
    Object.assign(e, { status: "failed", failure_count: (e.failure_count as number) + 1 });
    return {};
  };
  db.rpc.record_attempt_evaluation = (a) => {
    const e = evals.find((x) => x.attempt_id === a.p_attempt_id)!;
    Object.assign(e, {
      status: "complete",
      source: a.p_source,
      decision_correct: a.p_decision_correct,
      decision_assessment: a.p_decision_assessment,
      recognized_evidence_ids: a.p_recognized_evidence_ids,
      missed_evidence_ids: a.p_missed_evidence_ids,
      unsupported_assumptions: a.p_unsupported_assumptions,
      reasoning_explanation: a.p_reasoning_explanation,
      verification_feedback: a.p_verification_feedback,
      payment_behavior_feedback: a.p_payment_behavior_feedback,
      improvement_advice: a.p_improvement_advice,
      educational_takeaway: a.p_educational_takeaway,
      humorous_comment: a.p_humorous_comment,
    });
    (db.tables.scenario_scores ??= []).push({
      attempt_id: a.p_attempt_id,
      user_id: a.p_user_id,
      decision_points: a.p_decision_points,
      reasoning_points: a.p_reasoning_points,
      verification_points: a.p_verification_points,
      payment_safety_points: a.p_payment_safety_points,
      total_points:
        (a.p_decision_points as number) +
        (a.p_reasoning_points as number) +
        (a.p_verification_points as number) +
        (a.p_payment_safety_points as number),
      max_points: 100,
    });
    return { data: { attempt_id: a.p_attempt_id } };
  };
}

const evaluationReply: Replier = () => ({
  scenarioId: "m1-s1",
  decisionAssessment: "correct_strong_reasoning",
  recognizedEvidenceIds: [t.evidenceDefinitions[0]!.evidenceId, "invented_id"],
  missedEvidenceIds: [],
  unsupportedAssumptions: [],
  reasoningExplanation:
    "Great instinct to notice the number wasn't saved and to trust what the app says about codes.",
  verificationFeedback: "Checking the sender's details was a solid step.",
  paymentBehaviorFeedback: "No code shared, so nothing in the story was taken.",
  improvementAdvice: "Next time also open the app's security page to see the sign-in attempt.",
  educationalTakeaway: "A code you didn't ask for is a reason to pause, not to share.",
  humorousComment: "Your laptop savings just stayed firmly on your side of the screen.",
  evaluationConfidence: "high",
});

describe("evaluation request counts", () => {
  beforeEach(() => {
    evaluationRpcs();
    db.tables.profiles = [{ user_id: USER, occupation: "student", financial_goal: "buying_laptop" }];
  });

  it("one request per completed attempt carries feedback AND humor; revisiting results costs nothing", async () => {
    gemini(evaluationReply);
    loadAttemptMock.mockResolvedValueOnce(loaded("FINALIZED")).mockResolvedValue(loaded("COMPLETED"));
    const r = await evaluateAttempt(supabase(), USER, "e1", "ai");
    expect(r.status).toBe("complete");
    expect(requests("evaluation")).toBe(1);
    const stored = db.tables.attempt_evaluations![0]!;
    expect(stored.humorous_comment).toMatch(/laptop/);
    expect(stored.recognized_evidence_ids).toEqual([t.evidenceDefinitions[0]!.evidenceId]); // invented id discarded
    expect(db.tables.scenario_scores![0]!.decision_points).toBe(40); // backend scoring
    // Results page / refresh / second POST: stored result, no new request.
    await getEvaluationStatus(supabase(), USER, loaded("COMPLETED") as never);
    await evaluateAttempt(supabase(), USER, "e1", "ai");
    expect(requests("evaluation")).toBe(1);
  });

  it("a duplicate concurrent request gets 'pending' and makes no request", async () => {
    gemini(evaluationReply);
    db.tables.attempt_evaluations!.push({
      attempt_id: "e1",
      user_id: USER,
      status: "pending",
      failure_count: 0,
    });
    loadAttemptMock.mockResolvedValue(loaded("FINALIZED"));
    expect(await evaluateAttempt(supabase(), USER, "e1", "ai")).toEqual({ status: "pending" });
    expect(requests("evaluation")).toBe(0);
  });

  it("Gemini failure fabricates nothing; basic feedback only after that failure; never touches payments", async () => {
    gemini("fail");
    loadAttemptMock.mockResolvedValue(loaded("FINALIZED"));
    await expect(evaluateAttempt(supabase(), USER, "e1", "basic")).rejects.toThrow(); // not before a failure
    expect(await evaluateAttempt(supabase(), USER, "e1", "ai")).toMatchObject({
      status: "failed",
      basicAvailable: true,
    });
    expect(db.calls.rpc).not.toContain("record_attempt_evaluation");
    expect(db.calls.rpc.some((n) => /payment|capture|training/.test(n))).toBe(false);
    loadAttemptMock.mockResolvedValueOnce(loaded("FINALIZED")).mockResolvedValue(loaded("COMPLETED"));
    const before = requests("evaluation");
    expect((await evaluateAttempt(supabase(), USER, "e1", "basic")).status).toBe("complete");
    expect(requests("evaluation")).toBe(before);
    expect(db.tables.attempt_evaluations![0]).toMatchObject({ source: "fallback" });
  });

  it("a replay is evaluated independently (its own row and request)", async () => {
    gemini(evaluationReply);
    loadAttemptMock.mockResolvedValueOnce(loaded("FINALIZED")).mockResolvedValueOnce(loaded("COMPLETED"));
    await evaluateAttempt(supabase(), USER, "e1", "ai");
    loadAttemptMock
      .mockResolvedValueOnce(loaded("FINALIZED", "e2", true))
      .mockResolvedValueOnce(loaded("COMPLETED", "e2", true));
    await evaluateAttempt(supabase(), USER, "e2", "ai");
    expect(requests("evaluation")).toBe(2);
    expect(db.tables.attempt_evaluations!.map((e) => e.attempt_id)).toEqual(["e1", "e2"]);
  });
});
