/**
 * LIVE integration tests for Step 6: the immersive scenario engine (state machine, event log, attempts API, replays).
 *
 *   npm run test:integration          (APP_URL defaults to http://localhost:3000 for the API layer)
 *
 * Requires supabase/migrations/20261110090000_scenario_engine.sql applied and SUPABASE_SERVICE_ROLE_KEY set. Layer 1
 * drives the database as the trusted server and as a hostile browser; layer 2 drives the real API routes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const APP = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DOMAIN = process.env.INTEGRATION_EMAIL_DOMAIN ?? "example.com";
const RUN = Date.now().toString(36);
const PASSWORD = `Practice-not-panic-${RUN}`;
const email = (who: string) => `scamsense.se.${who}.${RUN}@${DOMAIN}`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const REASON = "I checked the details in my own account before deciding.";

const migrated =
  !!URL_ &&
  !!KEY &&
  (await fetch(`${URL_}/rest/v1/scenario_attempt_events?select=id&limit=1`, { headers: { apikey: KEY } })
    .then((r) => r.status !== 404)
    .catch(() => false));
const ready = migrated && !!SERVICE;
if (!ready) {
  console.warn(
    `[scenario engine tests] skipped: ${!migrated ? "apply 20261110090000_scenario_engine.sql" : "set SUPABASE_SERVICE_ROLE_KEY"}`,
  );
}

async function signUp(who: string) {
  const c = createClient(URL_, KEY, opts);
  const { data, error } = await c.auth.signUp({
    email: email(who),
    password: PASSWORD,
    options: { data: { display_name: `Engine ${who}`, age_confirmed: true } },
  });
  if (error || !data.session) throw new Error(`sign-up failed (is "Confirm email" off?): ${error?.code}`);
  return { c, id: data.user!.id };
}

type Step = [
  from: string,
  to: string,
  type: string,
  extra?: { action?: string; decision?: string; text?: string },
];

function stepper(admin: SupabaseClient, userId: string) {
  return (attemptId: string, [from, to, type, extra = {}]: Step) =>
    admin.rpc("apply_attempt_event", {
      p_user_id: userId,
      p_attempt_id: attemptId,
      p_from_state: from,
      p_to_state: to,
      p_event_type: type,
      p_action_id: extra.action ?? null,
      p_decision_id: extra.decision ?? null,
      p_justification: extra.text ?? null,
    });
}

const RESULTS_PIPELINE: Step[] = [
  ["FINALIZED", "FEEDBACK_AVAILABLE", "FEEDBACK_READY"],
  ["FEEDBACK_AVAILABLE", "REVIEW_AVAILABLE", "REVIEW_READY"],
  ["REVIEW_AVAILABLE", "RECOVERY_AVAILABLE", "RECOVERY_READY"],
];

function completeArgs(userId: string, attemptId: string) {
  return {
    p_user_id: userId,
    p_attempt_id: attemptId,
    p_decision_correct: true,
    p_decision_points: 40,
    p_reasoning_points: 10,
    p_verification_points: 10,
    p_payment_safety_points: 10,
    p_reasoning_source: "fallback",
    p_addressed_evidence_ids: [],
    p_verification_action_ids: [],
    p_scoring_version: "integration-test",
    p_payment_classification: null,
  };
}

/* ======================================================================================== layer 1: database */

describe.skipIf(!ready)("scenario engine (database)", () => {
  let admin: SupabaseClient;
  let carol: SupabaseClient;
  let carolId = "";
  let dave: SupabaseClient;
  let attempt = "";
  let step: ReturnType<typeof stepper>;

  beforeAll(async () => {
    admin = createClient(URL_, SERVICE, opts);
    ({ c: carol, id: carolId } = await signUp("carol"));
    ({ c: dave } = await signUp("dave"));
    step = stepper(admin, carolId);
    const run = await admin.rpc("start_module_run", {
      p_user_id: carolId,
      p_module_key: "spot-the-trap",
      p_currency: "USD",
      p_starting_funds_minor: 300_000,
    });
    if (run.error) throw new Error(run.error.message);
    const a = await admin.rpc("create_scenario_attempt", {
      p_user_id: carolId,
      p_scenario_key: "m1-s1",
      p_content_version: "it",
    });
    attempt = a.data.id;
  });

  it("browser roles cannot change attempts or the event log", async () => {
    expect((await carol.rpc("apply_attempt_event", {})).error).not.toBeNull();
    const upd = await carol
      .from("scenario_attempts")
      .update({ state: "FINALIZED" })
      .eq("id", attempt)
      .select();
    expect(upd.data ?? []).toEqual([]);
    const ins = await carol
      .from("scenario_attempt_events")
      .insert({ attempt_id: attempt, event_type: "START" });
    expect(ins.error).not.toBeNull();
    // Even the trusted writer can't update rows directly any more: only apply_attempt_event changes state.
    const direct = await admin.from("scenario_attempts").update({ state: "ACTIVE" }).eq("id", attempt);
    expect(direct.error).not.toBeNull();
  });

  it("rejects illegal transitions and stale states", async () => {
    expect((await step(attempt, ["INTRO", "FINALIZED", "FINALIZE"])).error?.message).toBe(
      "invalid_state_transition",
    );
    expect(
      (await step(attempt, ["ACTIVE", "INVESTIGATING", "RECORD_ACTION", { action: "x" }])).error?.message,
    ).toBe("attempt_state_conflict");
    expect((await step(attempt, ["INTRO", "ACTIVE", "START"])).error).toBeNull();
    expect((await step(attempt, ["ACTIVE", "COMPLETED", "COMPLETE"])).error?.message).toBe(
      "attempt_complete_via_function",
    );
  });

  it("records each action once in an append-only log the owner can read", async () => {
    expect(
      (await step(attempt, ["ACTIVE", "INVESTIGATING", "RECORD_ACTION", { action: "check_sender_details" }]))
        .error,
    ).toBeNull();
    const again = await step(attempt, [
      "INVESTIGATING",
      "INVESTIGATING",
      "RECORD_ACTION",
      { action: "check_sender_details" },
    ]);
    expect(again.error).toBeNull();
    const events = await carol
      .from("scenario_attempt_events")
      .select("event_type, action_id")
      .eq("attempt_id", attempt)
      .order("id");
    expect(events.data).toEqual([
      { event_type: "START", action_id: null },
      { event_type: "RECORD_ACTION", action_id: "check_sender_details" },
    ]);
    expect((await dave.from("scenario_attempt_events").select("id").eq("attempt_id", attempt)).data).toEqual(
      [],
    );
    expect(
      (await admin.from("scenario_attempt_events").update({ action_id: "y" }).eq("attempt_id", attempt))
        .error,
    ).not.toBeNull();
  });

  it("locks the decision on confirm and the explanation on submit (R11)", async () => {
    expect(
      (
        await step(attempt, [
          "INVESTIGATING",
          "DECISION_SELECTED",
          "SELECT_DECISION",
          { decision: "block_report" },
        ])
      ).error,
    ).toBeNull();
    expect(
      (
        await step(attempt, [
          "DECISION_SELECTED",
          "EXPLANATION_REQUIRED",
          "CONFIRM_DECISION",
          { decision: "send_code" },
        ])
      ).error?.message,
    ).toBe("decision_mismatch");
    expect(
      (
        await step(attempt, [
          "DECISION_SELECTED",
          "EXPLANATION_REQUIRED",
          "CONFIRM_DECISION",
          { decision: "block_report" },
        ])
      ).error,
    ).toBeNull();
    // No way back to exploring or to another decision now.
    expect((await step(attempt, ["EXPLANATION_REQUIRED", "ACTIVE", "CLEAR_DECISION"])).error?.message).toBe(
      "invalid_state_transition",
    );
    expect(
      (
        await step(attempt, [
          "EXPLANATION_REQUIRED",
          "FINALIZED",
          "SUBMIT_EXPLANATION",
          { text: "too short" },
        ])
      ).error,
    ).not.toBeNull();
    expect(
      (await step(attempt, ["EXPLANATION_REQUIRED", "FINALIZED", "SUBMIT_EXPLANATION", { text: REASON }]))
        .error,
    ).toBeNull();
    const row = (await carol.from("scenario_attempts").select("*").eq("id", attempt).single()).data;
    expect(row).toMatchObject({ state: "FINALIZED", decision_id: "block_report", justification: REASON });
    expect(row.finalized_at).not.toBeNull();
  });

  it("only completes from the end of the results pipeline, through complete_scenario_attempt", async () => {
    expect(
      (await admin.rpc("complete_scenario_attempt", completeArgs(carolId, attempt))).error?.message,
    ).toBe("attempt_not_ready_for_completion");
    for (const s of RESULTS_PIPELINE) expect((await step(attempt, s)).error).toBeNull();
    expect((await admin.rpc("complete_scenario_attempt", completeArgs(carolId, attempt))).error).toBeNull();
    const events =
      (await carol.from("scenario_attempt_events").select("event_type").eq("attempt_id", attempt)).data ?? [];
    expect(events.at(-1)).toEqual({ event_type: "COMPLETE" });
  });

  it("a replay is a separate practice attempt with its own log, payment flow, and no effect on the original", async () => {
    const before = (await carol.from("scenario_attempts").select("*").eq("id", attempt).single()).data;
    const beforeEvents = (await carol.from("scenario_attempt_events").select("id").eq("attempt_id", attempt))
      .data;
    const r = await admin.rpc("create_scenario_attempt", {
      p_user_id: carolId,
      p_scenario_key: "m1-s1",
      p_content_version: "it",
    });
    expect(r.data).toMatchObject({ attempt_number: 2, is_replay: true, state: "INTRO" });
    const replay = r.data.id as string;
    const flow: Step[] = [
      ["INTRO", "ACTIVE", "START"],
      ["ACTIVE", "ACTIVE", "RECORD_ACTION", { action: "reply_not_me" }],
      ["ACTIVE", "DECISION_SELECTED", "SELECT_DECISION", { decision: "send_code" }],
      ["DECISION_SELECTED", "EXPLANATION_REQUIRED", "CONFIRM_DECISION", { decision: "send_code" }],
      ["EXPLANATION_REQUIRED", "PAYMENT_PENDING", "SUBMIT_EXPLANATION", { text: REASON }],
      ["PAYMENT_PENDING", "PAYMENT_CANCELLED", "PAYMENT_CANCELLED"],
      ["PAYMENT_CANCELLED", "PAYMENT_PENDING", "RETRY_PAYMENT"],
    ];
    for (const s of flow) expect((await step(replay, s)).error, s[2]).toBeNull();
    // A payment state can only be left by capture (server, Step 7), cancellation, or finishing without paying.
    expect((await step(replay, ["PAYMENT_PENDING", "FINALIZED", "FINALIZE"])).error?.message).toBe(
      "invalid_state_transition",
    );
    expect(
      (await step(replay, ["PAYMENT_PENDING", "PAYMENT_CANCELLED", "PAYMENT_CANCELLED"])).error,
    ).toBeNull();
    expect((await step(replay, ["PAYMENT_CANCELLED", "FINALIZED", "FINALIZE"])).error).toBeNull();

    expect((await carol.from("scenario_attempts").select("*").eq("id", attempt).single()).data).toEqual(
      before,
    );
    expect((await carol.from("scenario_attempt_events").select("id").eq("attempt_id", attempt)).data).toEqual(
      beforeEvents,
    );
    const replayEvents =
      (await carol.from("scenario_attempt_events").select("event_type").eq("attempt_id", replay)).data ?? [];
    expect(replayEvents.map((e) => e.event_type)).toContain("RETRY_PAYMENT");
    // Nothing was charged: no ledger payment exists for either attempt.
    const pays = await carol.from("wallet_ledger_entries").select("id").eq("entry_type", "PAYMENT");
    expect(pays.data).toEqual([]);
  });
});

/* ======================================================================================== layer 2: API */

const appUp =
  ready &&
  (await fetch(`${APP}/api/config/currencies`)
    .then((r) => r.ok)
    .catch(() => false));

class Jar {
  private cookies = new Map<string, string>();
  store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair!.indexOf("=");
      if (/max-age=0/i.test(c) || pair!.slice(i + 1) === "") this.cookies.delete(pair!.slice(0, i));
      else this.cookies.set(pair!.slice(0, i), pair!.slice(i + 1));
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function call(jar: Jar, method: string, path: string, body?: unknown) {
  const res = await fetch(`${APP}${path}`, {
    method,
    redirect: "manual",
    headers: { cookie: jar.header(), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  jar.store(res);
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, json, text };
}

const PROFILE = {
  displayName: "Erin Example",
  occupation: "student",
  country: "US",
  financialActivities: ["online_shopping"],
  paymentExperience: "occasional",
  incomeBracket: "prefer_not_to_say",
  financialGoal: "buying_laptop",
  customGoal: "",
  goalAmount: "",
  preferredCurrency: "USD",
};

async function apiUser(who: string) {
  const { id } = await signUp(who);
  const jar = new Jar();
  const s = await call(jar, "POST", "/api/auth/sign-in", { email: email(who), password: PASSWORD });
  if (s.status !== 200) throw new Error(`sign-in ${s.status}`);
  const p = await call(jar, "PUT", "/api/profile", PROFILE);
  if (p.status !== 200) throw new Error(`profile ${p.status} ${p.text}`);
  return { id, jar };
}

describe.skipIf(!appUp)(`scenario engine API (${APP})`, { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let erin: { id: string; jar: Jar };
  let frank: { id: string; jar: Jar };
  let m1s1 = "";
  let m1s2 = "";
  const ev = (id: string, body: unknown) => call(erin.jar, "POST", `/api/attempts/${id}/events`, body);

  beforeAll(async () => {
    admin = createClient(URL_, SERVICE, opts);
    erin = await apiUser("erin");
    frank = await apiUser("frank");
  });

  it("requires a session, a started module, and an unlocked module", async () => {
    expect((await call(new Jar(), "POST", "/api/scenarios/m1-s1/attempts")).status).toBe(401);
    expect((await call(erin.jar, "POST", "/api/scenarios/m1-s1/attempts")).status).toBe(409); // not started
    expect((await call(erin.jar, "POST", "/api/scenarios/nope/attempts")).status).toBe(404);
    expect((await call(erin.jar, "POST", "/api/modules/spot-the-trap/start")).status).toBe(201);
    const locked = await call(erin.jar, "POST", "/api/scenarios/m2-s2/attempts");
    expect(locked.status).toBe(409);
    expect(locked.json.error.code).toBe("module_locked");
  });

  it("creates an attempt once and resumes it afterwards", async () => {
    const a = await call(erin.jar, "POST", "/api/scenarios/m1-s1/attempts");
    expect(a.status).toBe(201);
    expect(a.json).toMatchObject({ kind: "new" });
    const b = await call(erin.jar, "POST", "/api/scenarios/m1-s1/attempts");
    expect(b.status).toBe(200);
    expect(b.json).toEqual({ attemptId: a.json.attemptId, kind: "resume" });
    m1s1 = a.json.attemptId;
  });

  it("serves a client-safe view: neutral intro, filled environment, no answer key (R9, R10)", async () => {
    const v = await call(erin.jar, "GET", `/api/attempts/${m1s1}`);
    expect(v.status).toBe(200);
    expect(v.json.attempt).toMatchObject({
      state: "INTRO",
      introLine: "You receive a message about your payment account.",
      isPractice: false,
      checkout: null,
    });
    expect(v.text).toContain("$150.00"); // 5% of the US$3,000 default funds
    for (const secret of [
      "fraudulent",
      "legitimate",
      "red_flag",
      "worth_verifying",
      "correctDecision",
      "evidence",
      "unsafe",
      "{{",
    ]) {
      expect(v.text).not.toContain(secret);
    }
    expect((await call(frank.jar, "GET", `/api/attempts/${m1s1}`)).status).toBe(404); // another user's attempt
    expect((await call(erin.jar, "GET", "/api/attempts/not-a-uuid")).status).toBe(404);
  });

  it("drives the state machine and rejects bypasses", async () => {
    expect((await ev(m1s1, { type: "RECORD_ACTION", actionId: "check_sender_details" })).status).toBe(409); // still INTRO
    expect((await ev(m1s1, { type: "START" })).json.attempt.state).toBe("ACTIVE");
    expect((await ev(m1s1, { type: "RECORD_ACTION", actionId: "made_up" })).status).toBe(400);
    expect((await ev(m1s1, { type: "RECORD_ACTION", actionId: "ask_why_code" })).status).toBe(409); // branch not reached
    const inv = await ev(m1s1, { type: "RECORD_ACTION", actionId: "check_sender_details" });
    expect(inv.json.attempt).toMatchObject({
      state: "INVESTIGATING",
      recordedActionIds: ["check_sender_details"],
    });
    expect((await ev(m1s1, { type: "SELECT_DECISION", decisionId: "send_code" })).status).toBe(409); // requires reply
    expect((await ev(m1s1, { type: "PAYMENT_CAPTURED" })).status).toBe(400); // server-only event
    expect((await ev(m1s1, { type: "START", extra: 1 })).status).toBe(400); // strict body
    expect((await ev(m1s1, { type: "SELECT_DECISION", decisionId: "block_report" })).json.attempt.state).toBe(
      "DECISION_SELECTED",
    );
    // A refresh here shows the same pending decision.
    expect((await call(erin.jar, "GET", `/api/attempts/${m1s1}`)).json.attempt.pendingDecisionId).toBe(
      "block_report",
    );
    expect((await ev(m1s1, { type: "CLEAR_DECISION" })).json.attempt.state).toBe("INVESTIGATING");
    await ev(m1s1, { type: "SELECT_DECISION", decisionId: "block_report" });
    expect((await ev(m1s1, { type: "CONFIRM_DECISION" })).json.attempt).toMatchObject({
      state: "EXPLANATION_REQUIRED",
      decisionId: "block_report",
    });
    // Bypass attempts: finalize or change the decision without an explanation.
    expect((await ev(m1s1, { type: "FINALIZE" })).status).toBe(409);
    expect((await ev(m1s1, { type: "SELECT_DECISION", decisionId: "delete_conversation" })).status).toBe(409);
    const short = await call(erin.jar, "POST", `/api/attempts/${m1s1}/justification`, {
      text: "  too short  ",
    });
    expect(short.status).toBe(400);
    const ok = await call(erin.jar, "POST", `/api/attempts/${m1s1}/justification`, { text: REASON });
    expect(ok.json.attempt).toMatchObject({ state: "FINALIZED", justification: REASON, checkout: null });
    const again = await call(erin.jar, "POST", `/api/attempts/${m1s1}/justification`, {
      text: `${REASON} Changed.`,
    });
    expect(again.status).toBe(409);
  });

  it("renders the player page for the owner only", async () => {
    const page = await call(erin.jar, "GET", `/play/${m1s1}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain("Your answer is saved");
    // Another user gets the not-found page. (The (app) loading boundary streams, so the HTTP status is already 200
    // when notFound() renders; what matters is that none of the attempt reaches them.)
    const foreign = await call(frank.jar, "GET", `/play/${m1s1}`);
    expect(foreign.text).toContain("find that page");
    expect(foreign.text).not.toContain(REASON);
    expect(foreign.text).not.toContain("You receive a message about your payment account");
  });

  it("runs the laptop purchase to the pending PayPal Sandbox checkout without faking a payment", async () => {
    // Finish Module 1 the way Steps 8–9 will (results pipeline + completion), so Module 2 unlocks.
    m1s2 = (await call(erin.jar, "POST", "/api/scenarios/m1-s2/attempts")).json.attemptId;
    await ev(m1s2, { type: "START" });
    await ev(m1s2, { type: "SELECT_DECISION", decisionId: "report_email" });
    await ev(m1s2, { type: "CONFIRM_DECISION" });
    await call(erin.jar, "POST", `/api/attempts/${m1s2}/justification`, { text: REASON });
    const step = stepper(admin, erin.id);
    for (const id of [m1s1, m1s2]) {
      for (const s of RESULTS_PIPELINE) expect((await step(id, s)).error).toBeNull();
      expect((await admin.rpc("complete_scenario_attempt", completeArgs(erin.id, id))).error).toBeNull();
    }
    expect((await call(erin.jar, "POST", "/api/modules/trust-under-pressure/start")).status).toBe(201);

    const laptop = (await call(erin.jar, "POST", "/api/scenarios/m2-s2/attempts")).json.attemptId as string;
    expect((await ev(laptop, { type: "START" })).status).toBe(200);
    expect((await ev(laptop, { type: "SELECT_DECISION", decisionId: "place_order" })).status).toBe(409); // checkout first
    for (const a of ["view_product", "view_seller_profile", "read_reviews", "view_checkout"]) {
      expect((await ev(laptop, { type: "RECORD_ACTION", actionId: a })).status, a).toBe(200);
    }
    await ev(laptop, { type: "SELECT_DECISION", decisionId: "place_order" });
    await ev(laptop, { type: "CONFIRM_DECISION" });
    const pending = await call(erin.jar, "POST", `/api/attempts/${laptop}/justification`, { text: REASON });
    expect(pending.json.attempt).toMatchObject({
      state: "PAYMENT_PENDING",
      checkout: { amountText: "$360.00", checkoutSequence: 1, integration: "pending" },
    });
    expect((await ev(laptop, { type: "FINALIZE" })).status).toBe(409); // can't skip the payment step
    expect((await ev(laptop, { type: "PAYMENT_CANCELLED" })).json.attempt.state).toBe("PAYMENT_CANCELLED");
    expect((await ev(laptop, { type: "RETRY_PAYMENT" })).json.attempt.checkout.checkoutSequence).toBe(2);

    // No money moved: Module 2's ledger is still just its opening entry.
    const progress = (await call(erin.jar, "GET", "/api/progress")).json.progress;
    expect(progress.modules["trust-under-pressure"].ledger).toHaveLength(1);
    expect(progress.modules["trust-under-pressure"].wallet.balanceMinor).toBe(300_000);
  });

  it("replays a completed scenario as a separate practice attempt without touching official progress", async () => {
    const before = (await call(erin.jar, "GET", "/api/progress")).json.progress;
    const r = await call(erin.jar, "POST", "/api/scenarios/m1-s1/attempts");
    expect(r.status).toBe(201);
    expect(r.json.kind).toBe("replay");
    const replay = r.json.attemptId as string;
    expect(replay).not.toBe(m1s1);
    const v = await call(erin.jar, "GET", `/api/attempts/${replay}`);
    expect(v.json.attempt).toMatchObject({
      isPractice: true,
      attemptNumber: 2,
      state: "INTRO",
      recordedActionIds: [],
    });
    await ev(replay, { type: "START" });
    await ev(replay, { type: "RECORD_ACTION", actionId: "reply_not_me" });
    await ev(replay, { type: "SELECT_DECISION", decisionId: "send_code" });
    await ev(replay, { type: "CONFIRM_DECISION" });
    const done = await call(erin.jar, "POST", `/api/attempts/${replay}/justification`, {
      text: `${REASON} (practice)`,
    });
    expect(done.json.attempt).toMatchObject({
      state: "FINALIZED",
      decisionId: "send_code",
      isPractice: true,
    });

    const original = await call(erin.jar, "GET", `/api/attempts/${m1s1}`);
    expect(original.json.attempt).toMatchObject({
      state: "COMPLETED",
      decisionId: "block_report",
      justification: REASON,
    });
    const after = (await call(erin.jar, "GET", "/api/progress")).json.progress;
    expect(after.totalPoints).toBe(before.totalPoints);
    expect(after.modules["spot-the-trap"]).toEqual(before.modules["spot-the-trap"]);
    expect(after.progression.completedScenarios).toBe(before.progression.completedScenarios);
  });
});
