/**
 * LIVE integration tests for Step 8 (hybrid routing, personalization instances, evaluations) against the real
 * Supabase project. Requires supabase/migrations/20261112090000_hybrid_intelligence.sql applied and
 * SUPABASE_SERVICE_ROLE_KEY set; otherwise the suite is skipped with a warning. No Gemini calls are made here.
 *
 *   npm run test:integration
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DOMAIN = process.env.INTEGRATION_EMAIL_DOMAIN ?? "example.com";
const RUN = Date.now().toString(36);
const PASSWORD = `Practice-not-panic-${RUN}`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const REASON = "The sender wasn't a saved contact and the app says it never asks for codes.";

const migrated =
  !!URL_ &&
  !!KEY &&
  (await fetch(`${URL_}/rest/v1/attempt_evaluations?select=attempt_id&limit=1`, { headers: { apikey: KEY } })
    .then((r) => r.status !== 404)
    .catch(() => false));
const ready = migrated && !!SERVICE;
if (!ready)
  console.warn(
    `[step 8 tests] skipped: ${!migrated ? "apply 20261112090000_hybrid_intelligence.sql" : "set SUPABASE_SERVICE_ROLE_KEY"}`,
  );

async function signUp(who: string) {
  const c = createClient(URL_, KEY, opts);
  const { data, error } = await c.auth.signUp({
    email: `scamsense.s8.${who}.${RUN}@${DOMAIN}`,
    password: PASSWORD,
    options: { data: { display_name: `Step8 ${who}`, age_confirmed: true } },
  });
  if (error || !data.session) throw new Error(`sign-up failed (is "Confirm email" off?): ${error?.code}`);
  return { c, id: data.user!.id };
}

describe.skipIf(!ready)("Step 8 database layer", () => {
  let admin: SupabaseClient;
  let ana: SupabaseClient;
  let anaId = "";
  let ben: SupabaseClient;

  const step = (
    attemptId: string,
    from: string,
    to: string,
    type: string,
    extra: Record<string, string | null> = {},
  ) =>
    admin.rpc("apply_attempt_event", {
      p_user_id: anaId,
      p_attempt_id: attemptId,
      p_from_state: from,
      p_to_state: to,
      p_event_type: type,
      p_action_id: extra.action ?? null,
      p_decision_id: extra.decision ?? null,
      p_justification: extra.text ?? null,
    });

  async function finalizedAttempt(scenario = "m1-s1") {
    const a = await admin.rpc("create_scenario_attempt", {
      p_user_id: anaId,
      p_scenario_key: scenario,
      p_content_version: "it",
    });
    if (a.error) throw new Error(a.error.message);
    const id = (a.data as { id: string }).id;
    for (const [from, to, type, extra] of [
      ["INTRO", "ACTIVE", "START", {}],
      ["ACTIVE", "DECISION_SELECTED", "SELECT_DECISION", { decision: "block_report" }],
      ["DECISION_SELECTED", "EXPLANATION_REQUIRED", "CONFIRM_DECISION", { decision: "block_report" }],
      ["EXPLANATION_REQUIRED", "FINALIZED", "SUBMIT_EXPLANATION", { text: REASON }],
    ] as const) {
      const r = await step(id, from, to, type, extra);
      if (r.error) throw new Error(`${type}: ${r.error.message}`);
    }
    return id;
  }

  const recordArgs = (attemptId: string, over: Record<string, unknown> = {}) => ({
    p_user_id: anaId,
    p_attempt_id: attemptId,
    p_source: "gemini",
    p_model: "integration-test",
    p_prompt_version: "it",
    p_decision_correct: true,
    p_decision_assessment: "correct_strong_reasoning",
    p_recognized_evidence_ids: ["code_request_evidence"],
    p_missed_evidence_ids: [],
    p_unsupported_assumptions: [],
    p_reasoning_explanation: "Nice work noticing the code request.",
    p_verification_feedback: "Good checking.",
    p_payment_behavior_feedback: "Nothing was shared.",
    p_improvement_advice: "Also check the app.",
    p_educational_takeaway: "Never share a code you didn't ask for.",
    p_humorous_comment: "Your savings stayed put.",
    p_evaluation_confidence: "high",
    p_input_tokens: 10,
    p_output_tokens: 10,
    p_latency_ms: 10,
    p_decision_points: 40,
    p_reasoning_points: 15,
    p_verification_points: 5,
    p_payment_safety_points: 10,
    p_verification_action_ids: [],
    p_scoring_version: "integration-test",
    p_payment_classification: null,
    ...over,
  });

  beforeAll(async () => {
    admin = createClient(URL_, SERVICE, opts);
    ({ c: ana, id: anaId } = await signUp("ana"));
    ({ c: ben } = await signUp("ben"));
    const run = await admin.rpc("start_module_run", {
      p_user_id: anaId,
      p_module_key: "spot-the-trap",
      p_currency: "USD",
      p_starting_funds_minor: 300_000,
    });
    if (run.error) throw new Error(run.error.message);
  });

  it("stores Other descriptions only while Other is selected (trigger + checks)", async () => {
    const set = (row: Record<string, unknown>) =>
      ana
        .from("profiles")
        .update(row)
        .eq("user_id", anaId)
        .select("occupation, custom_occupation, financial_activities, custom_activity")
        .single();
    const ok = await set({
      occupation: "other",
      custom_occupation: "  Digital artist ",
      financial_activities: ["other", "online_selling"],
      custom_activity: "Sell commissions",
    });
    expect(ok.error).toBeNull();
    expect(ok.data).toMatchObject({
      custom_occupation: "Digital artist",
      custom_activity: "Sell commissions",
    });
    const cleared = await set({ occupation: "student", financial_activities: ["online_shopping"] });
    expect(cleared.data).toMatchObject({ custom_occupation: null, custom_activity: null });
    const tooLong = await set({ occupation: "other", custom_occupation: "x".repeat(81) });
    expect(tooLong.error).not.toBeNull();
  });

  it("module order: written once by the server, immutable, own-module only, private", async () => {
    const insert = (order: string[]) =>
      admin.from("module_scenario_orders").insert({
        user_id: anaId,
        module_key: "spot-the-trap",
        scenario_order: order,
        scores: [],
        routing_source: "predefined",
        routing_version: "it",
      });
    expect((await insert(["m1-s1", "m3-s1"])).error).not.toBeNull(); // another module's scenario
    expect((await insert(["m1-s2", "m1-s1"])).error).toBeNull();
    expect((await insert(["m1-s1", "m1-s2"])).error).not.toBeNull(); // one row per (user, module)
    const upd = await admin
      .from("module_scenario_orders")
      .update({ scenario_order: ["m1-s1", "m1-s2"] })
      .eq("user_id", anaId);
    expect(upd.error).not.toBeNull();
    expect(
      (await ana.from("module_scenario_orders").select("scenario_order").single()).data?.scenario_order,
    ).toEqual(["m1-s2", "m1-s1"]);
    expect((await ben.from("module_scenario_orders").select("*")).data).toEqual([]);
    expect(
      (
        await ana.from("module_scenario_orders").insert({
          user_id: anaId,
          module_key: "outsmart-the-scam",
          scenario_order: ["m3-s1", "m3-s2"],
          scores: [],
          routing_source: "predefined",
          routing_version: "it",
        })
      ).error,
    ).not.toBeNull();
  });

  it("personalization: one generation in flight, reused afterwards, linked only before play", async () => {
    const claim = () =>
      admin.rpc("claim_scenario_personalization", {
        p_user_id: anaId,
        p_scenario_key: "m1-s1",
        p_content_version: "it",
      });
    const first = (await claim()).data as { status: string; id: string };
    expect(first.status).toBe("claimed");
    expect(((await claim()).data as { status: string }).status).toBe("busy");
    const done = await admin.rpc("complete_scenario_personalization", {
      p_user_id: anaId,
      p_personalization_id: first.id,
      p_source: "gemini",
      p_slots: { friendName: "Leila" },
      p_fallback_reason: null,
      p_model: "it",
      p_prompt_version: "it",
      p_input_tokens: 1,
      p_output_tokens: 1,
      p_latency_ms: 1,
    });
    expect(done.error).toBeNull();
    expect((await claim()).data).toMatchObject({ status: "ready", id: first.id });

    const a = await admin.rpc("create_scenario_attempt", {
      p_user_id: anaId,
      p_scenario_key: "m1-s1",
      p_content_version: "it",
    });
    const attemptId = (a.data as { id: string }).id;
    const link = () =>
      admin.rpc("link_attempt_personalization", {
        p_user_id: anaId,
        p_attempt_id: attemptId,
        p_personalization_id: first.id,
      });
    expect((await link()).error).toBeNull();
    expect((await link()).data).toBe(first.id); // idempotent
    const read = await ana
      .from("attempt_personalizations")
      .select("personalization_id, scenario_personalizations(slots)")
      .eq("attempt_id", attemptId)
      .single();
    expect(read.data).toMatchObject({ scenario_personalizations: { slots: { friendName: "Leila" } } });
    expect((await ben.from("scenario_personalizations").select("*")).data).toEqual([]);
    // Browsers can't run the writer functions.
    expect(
      (
        await ana.rpc("claim_scenario_personalization", {
          p_user_id: anaId,
          p_scenario_key: "m1-s2",
          p_content_version: "it",
        })
      ).error,
    ).not.toBeNull();
  });

  it("evaluation: claimed once, recorded atomically to COMPLETED with a backend score, idempotent", async () => {
    // Uses the open m1-s1 attempt from the previous test.
    const open = await ana
      .from("scenario_attempts")
      .select("id")
      .eq("scenario_key", "m1-s1")
      .neq("state", "COMPLETED")
      .single();
    const id = open.data!.id as string;
    for (const [from, to, type, extra] of [
      ["INTRO", "ACTIVE", "START", {}],
      ["ACTIVE", "DECISION_SELECTED", "SELECT_DECISION", { decision: "block_report" }],
      ["DECISION_SELECTED", "EXPLANATION_REQUIRED", "CONFIRM_DECISION", { decision: "block_report" }],
      ["EXPLANATION_REQUIRED", "FINALIZED", "SUBMIT_EXPLANATION", { text: REASON }],
    ] as const)
      expect((await step(id, from, to, type, extra)).error).toBeNull();
    const claim = () => admin.rpc("claim_attempt_evaluation", { p_user_id: anaId, p_attempt_id: id });
    expect((await claim()).data).toBe("claimed");
    expect((await claim()).data).toBe("busy");
    expect((await ana.rpc("record_attempt_evaluation", recordArgs(id))).error).not.toBeNull(); // browser refused
    const rec = await admin.rpc("record_attempt_evaluation", recordArgs(id));
    expect(rec.error).toBeNull();
    expect(rec.data).toMatchObject({ already_complete: false, module_completed: false });
    expect(
      (await admin.rpc("record_attempt_evaluation", recordArgs(id, { p_reasoning_points: 30 }))).data,
    ).toMatchObject({ already_complete: true });
    expect((await claim()).data).toBe("complete");

    const att = await ana.from("scenario_attempts").select("state, decision_correct").eq("id", id).single();
    expect(att.data).toMatchObject({ state: "COMPLETED", decision_correct: true });
    const score = await ana
      .from("scenario_scores")
      .select("total_points, reasoning_points, reasoning_source")
      .eq("attempt_id", id)
      .single();
    expect(score.data).toMatchObject({ total_points: 70, reasoning_points: 15, reasoning_source: "gemini" }); // not overwritten
    const events = await ana
      .from("scenario_attempt_events")
      .select("event_type")
      .eq("attempt_id", id)
      .order("id");
    expect(events.data!.map((e) => e.event_type).slice(-4)).toEqual([
      "FEEDBACK_READY",
      "REVIEW_READY",
      "RECOVERY_READY",
      "COMPLETE",
    ]);
    const ev = await ana
      .from("attempt_evaluations")
      .select("status, humorous_comment, is_practice")
      .eq("attempt_id", id)
      .single();
    expect(ev.data).toMatchObject({
      status: "complete",
      humorous_comment: "Your savings stayed put.",
      is_practice: false,
    });
    expect((await ben.from("attempt_evaluations").select("*")).data).toEqual([]);
  });

  it("a failed evaluation keeps the attempt FINALIZED and can be claimed again; replays are separate", async () => {
    const id = await finalizedAttempt("m1-s2");
    // The player has already seen this attempt's environment: its narrative can no longer be swapped.
    const p = (await ana.from("scenario_personalizations").select("id").limit(1).single()).data!.id;
    const late = await admin.rpc("link_attempt_personalization", {
      p_user_id: anaId,
      p_attempt_id: id,
      p_personalization_id: p,
    });
    expect(late.error?.message).toBe("personalization_too_late");
    expect((await admin.rpc("claim_attempt_evaluation", { p_user_id: anaId, p_attempt_id: id })).data).toBe(
      "claimed",
    );
    await admin.rpc("fail_attempt_evaluation", { p_user_id: anaId, p_attempt_id: id, p_reason: "timeout" });
    expect((await ana.from("scenario_attempts").select("state").eq("id", id).single()).data?.state).toBe(
      "FINALIZED",
    );
    expect((await admin.rpc("claim_attempt_evaluation", { p_user_id: anaId, p_attempt_id: id })).data).toBe(
      "claimed",
    );
    const rec = await admin.rpc(
      "record_attempt_evaluation",
      recordArgs(id, {
        p_source: "fallback",
        p_decision_correct: false,
        p_decision_assessment: "incorrect_unsupported_reasoning",
        p_decision_points: 0,
      }),
    );
    expect(rec.error).toBeNull();
    expect(rec.data).toMatchObject({ module_completed: true }); // both first attempts completed

    const runBefore = await ana
      .from("module_runs")
      .select("completed_at, closing_balance_minor")
      .eq("module_key", "spot-the-trap")
      .single();
    const replay = await finalizedAttempt("m1-s1");
    expect(
      (await ana.from("scenario_attempts").select("attempt_number").eq("id", replay).single()).data
        ?.attempt_number,
    ).toBe(2);
    expect(
      (await admin.rpc("claim_attempt_evaluation", { p_user_id: anaId, p_attempt_id: replay })).data,
    ).toBe("claimed");
    expect(
      (await admin.rpc("record_attempt_evaluation", recordArgs(replay, { p_reasoning_points: 30 }))).error,
    ).toBeNull();
    const ev = await ana.from("attempt_evaluations").select("attempt_id, is_practice").order("created_at");
    expect(ev.data!.filter((e) => e.is_practice)).toHaveLength(1);
    const runAfter = await ana
      .from("module_runs")
      .select("completed_at, closing_balance_minor")
      .eq("module_key", "spot-the-trap")
      .single();
    expect(runAfter.data).toEqual(runBefore.data); // replay never changes the official run
  });
});
