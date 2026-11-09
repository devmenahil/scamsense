/**
 * LIVE integration tests for Phase 3 (Step 5): module runs, training-funds ledger, attempts/replays, scores.
 *
 *   npm run test:integration
 *
 * Requirements (in addition to supabase.integration.test.ts): the migration
 * supabase/migrations/20261109120000_progression_wallet.sql applied, and SUPABASE_SERVICE_ROLE_KEY (legacy service-role
 * JWT or new sb_secret_… key) in .env.local. Without them this file is skipped with a note.
 *
 * Layer 1 drives the database exactly as the server will (trusted writer = service_role) and as a malicious browser
 * could (publishable key + user session). Layer 2 drives the ScamSense API routes of a running app (APP_URL).
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
const email = (who: string) => `scamsense.it.${who}.${RUN}@${DOMAIN}`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const tablesReady =
  !!URL_ &&
  !!KEY &&
  (await fetch(`${URL_}/rest/v1/module_runs?select=id&limit=1`, { headers: { apikey: KEY } })
    .then((r) => r.status !== 404)
    .catch(() => false));
const ready = tablesReady && !!SERVICE;
if (!ready) {
  console.warn(
    `[progression tests] skipped: ${!tablesReady ? "apply 20261109120000_progression_wallet.sql" : ""}` +
      `${!tablesReady && !SERVICE ? " and " : ""}${!SERVICE ? "set SUPABASE_SERVICE_ROLE_KEY" : ""}`,
  );
}

async function signUp(who: string) {
  const c = createClient(URL_, KEY, opts);
  const { data, error } = await c.auth.signUp({
    email: email(who),
    password: PASSWORD,
    options: { data: { display_name: `Progress ${who}`, age_confirmed: true } },
  });
  if (error || !data.session) throw new Error(`sign-up failed (is "Confirm email" off?): ${error?.code}`);
  return { c, id: data.user!.id };
}

describe.skipIf(!ready)("progression + training funds (database)", () => {
  let admin: SupabaseClient;
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let aliceId = "";
  let m1s1 = "";
  let m1s2 = "";
  let m1RunId = "";

  const rpc = (fn: string, args: Record<string, unknown>) => admin.rpc(fn, args);
  const complete = (attemptId: string, classification: string | null, points = [40, 15, 10, 10]) =>
    rpc("complete_scenario_attempt", {
      p_user_id: aliceId,
      p_attempt_id: attemptId,
      p_decision_correct: points[0] === 40,
      p_decision_points: points[0],
      p_reasoning_points: points[1],
      p_verification_points: points[2],
      p_payment_safety_points: points[3],
      p_reasoning_source: "fallback",
      p_addressed_evidence_ids: ["ev.test"],
      p_verification_action_ids: [],
      p_scoring_version: "integration-test",
      p_payment_classification: classification,
    });
  /** Walks an attempt through the Step 6 state machine (apply_attempt_event) to the end of the results pipeline. */
  const step = (
    attemptId: string,
    from: string,
    to: string,
    type: string,
    extra: { decision?: string; text?: string } = {},
  ) =>
    rpc("apply_attempt_event", {
      p_user_id: aliceId,
      p_attempt_id: attemptId,
      p_from_state: from,
      p_to_state: to,
      p_event_type: type,
      p_action_id: null,
      p_decision_id: extra.decision ?? null,
      p_justification: extra.text ?? null,
    });
  const toEvaluating = async (attemptId: string, decision = "report_email") => {
    const steps: [string, string, string, { decision?: string; text?: string }?][] = [
      ["INTRO", "ACTIVE", "START"],
      ["ACTIVE", "DECISION_SELECTED", "SELECT_DECISION", { decision }],
      ["DECISION_SELECTED", "EXPLANATION_REQUIRED", "CONFIRM_DECISION", { decision }],
      [
        "EXPLANATION_REQUIRED",
        "FINALIZED",
        "SUBMIT_EXPLANATION",
        { text: "Integration test reasoning text." },
      ],
      ["FINALIZED", "FEEDBACK_AVAILABLE", "FEEDBACK_READY"],
      ["FEEDBACK_AVAILABLE", "REVIEW_AVAILABLE", "REVIEW_READY"],
      ["REVIEW_AVAILABLE", "RECOVERY_AVAILABLE", "RECOVERY_READY"],
    ];
    for (const [from, to, type, extra] of steps) {
      const r = await step(attemptId, from, to, type, extra);
      if (r.error) throw new Error(`${type}: ${r.error.message}`);
    }
  };
  const ledger = async (c: SupabaseClient, runId: string) =>
    (await c.from("wallet_ledger_entries").select("*").eq("module_run_id", runId).order("id")).data ?? [];

  beforeAll(async () => {
    admin = createClient(URL_, SERVICE, opts);
    const a = await signUp("pa");
    const b = await signUp("pb");
    alice = a.c;
    aliceId = a.id;
    bob = b.c;
  });

  it("browser roles cannot call gameplay functions or write gameplay tables", async () => {
    const r = await alice.rpc("start_module_run", {
      p_user_id: aliceId,
      p_module_key: "spot-the-trap",
      p_currency: "USD",
      p_starting_funds_minor: 999_999_999,
    });
    expect(r.error).not.toBeNull();
    const ins = await alice
      .from("module_runs")
      .insert({ user_id: aliceId, module_key: "spot-the-trap", currency: "USD", starting_funds_minor: 1 });
    expect(ins.error?.code).toBe("42501");
    const anonClient = createClient(URL_, KEY, opts);
    const anon = await anonClient.from("module_runs").select("id");
    expect(anon.data ?? []).toEqual([]);
    for (const fn of [
      "start_module_run",
      "create_scenario_attempt",
      "record_training_payment",
      "complete_scenario_attempt",
    ]) {
      expect((await anonClient.rpc(fn, {})).error, fn).not.toBeNull();
      expect((await alice.rpc(fn, {})).error, fn).not.toBeNull();
    }
    // Users cannot write scores or ledger rows directly either.
    expect(
      (await alice.from("scenario_scores").insert({ attempt_id: crypto.randomUUID() })).error?.code,
    ).toBe("42501");
    expect(
      (await alice.from("wallet_ledger_entries").insert({ user_id: aliceId, entry_type: "MODULE_START" }))
        .error?.code,
    ).toBe("42501");
  });

  it("refuses to start Module 2 before Module 1 is complete", async () => {
    const r = await rpc("start_module_run", {
      p_user_id: aliceId,
      p_module_key: "trust-under-pressure",
      p_currency: "USD",
      p_starting_funds_minor: 300_000,
    });
    expect(r.error?.message).toBe("module_locked");
  });

  it("starts Module 1 once with a single MODULE_START entry (idempotent)", async () => {
    const args = {
      p_user_id: aliceId,
      p_module_key: "spot-the-trap",
      p_currency: "USD",
      p_starting_funds_minor: 300_000,
    };
    const first = await rpc("start_module_run", args);
    const second = await rpc("start_module_run", { ...args, p_starting_funds_minor: 999_999 });
    expect(first.error).toBeNull();
    m1RunId = first.data.id;
    expect(second.data.id).toBe(m1RunId);
    const rows = await ledger(alice, m1RunId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entry_type: "MODULE_START",
      amount_minor: 300_000,
      balance_after_minor: 300_000,
    });
  });

  it("creates attempts and resumes the open one instead of duplicating it", async () => {
    const a = await rpc("create_scenario_attempt", {
      p_user_id: aliceId,
      p_scenario_key: "m1-s1",
      p_content_version: "v-test",
    });
    const again = await rpc("create_scenario_attempt", {
      p_user_id: aliceId,
      p_scenario_key: "m1-s1",
      p_content_version: "v-test",
    });
    expect(a.data).toMatchObject({ attempt_number: 1, is_replay: false, state: "INTRO" });
    expect(again.data.id).toBe(a.data.id);
    m1s1 = a.data.id;
    const locked = await rpc("create_scenario_attempt", {
      p_user_id: aliceId,
      p_scenario_key: "m2-s1",
      p_content_version: "v-test",
    });
    expect(locked.error?.message).toBe("module_not_started");
  });

  it("debits a payment exactly once and never below zero", async () => {
    const pay = (attempt: string, amount: number, key: string) =>
      rpc("record_training_payment", {
        p_user_id: aliceId,
        p_attempt_id: attempt,
        p_amount_minor: amount,
        p_idempotency_key: key,
      });
    const first = await pay(m1s1, 15_000, `it-${RUN}-k1`);
    const retry = await pay(m1s1, 15_000, `it-${RUN}-k1`);
    expect(first.error).toBeNull();
    expect(retry.data.id).toBe(first.data.id);
    expect((await pay(m1s1, 15_000, `it-${RUN}-k2`)).error?.message).toBe("duplicate_attempt_payment");

    const s2 = await rpc("create_scenario_attempt", {
      p_user_id: aliceId,
      p_scenario_key: "m1-s2",
      p_content_version: "v-test",
    });
    m1s2 = s2.data.id;
    expect((await pay(m1s2, 285_001, `it-${RUN}-k3`)).error?.message).toBe("insufficient_funds");

    const rows = await ledger(alice, m1RunId);
    expect(rows.map((r) => r.balance_after_minor)).toEqual([300_000, 285_000]);
    // Nothing about legitimacy is stored while the scenario is in progress (R10).
    expect(rows[1].classification).toBe("pending");
  });

  it("only complete_scenario_attempt can complete an attempt; the ledger is append-only", async () => {
    expect((await complete(m1s1, "fraud_loss")).error?.message).toBe("attempt_not_ready_for_completion");
    const direct = await admin.from("scenario_attempts").update({ state: "COMPLETED" }).eq("id", m1s1);
    expect(direct.error).not.toBeNull();
    const tamper = await admin
      .from("wallet_ledger_entries")
      .update({ amount_minor: -1 })
      .eq("attempt_id", m1s1);
    expect(tamper.error).not.toBeNull();
  });

  it("completes with a score, classifies the payment, and finishes the module after both scenarios", async () => {
    await toEvaluating(m1s1);
    expect((await complete(m1s1, null)).error?.message).toBe("payment_classification_required");
    const one = await complete(m1s1, "fraud_loss", [0, 15, 10, 0]);
    expect(one.error).toBeNull();
    expect(one.data.module_completed).toBe(false);

    const score = await alice.from("scenario_scores").select("*").eq("attempt_id", m1s1).single();
    expect(score.data).toMatchObject({ total_points: 25, is_replay: false, decision_correct: false });
    expect((await ledger(alice, m1RunId))[1].classification).toBe("fraud_loss");

    await toEvaluating(m1s2);
    const two = await complete(m1s2, null);
    expect(two.data.module_completed).toBe(true);
    const run = await alice.from("module_runs").select("*").eq("id", m1RunId).single();
    expect(run.data.closing_balance_minor).toBe(285_000);
    expect(run.data.completed_at).not.toBeNull();

    // Completing again is idempotent and can never overwrite the official score or add points.
    expect((await complete(m1s2, null, [40, 30, 20, 10])).data.module_completed).toBe(true);
    expect((await complete(m1s1, "spending", [40, 30, 20, 10])).error).toBeNull();
    const again = await alice.from("scenario_scores").select("total_points").eq("attempt_id", m1s1);
    expect(again.data).toEqual([{ total_points: 25 }]);
    expect((await ledger(alice, m1RunId))[1].classification).toBe("fraud_loss");
    const direct = await admin.from("scenario_scores").update({ decision_points: 40 }).eq("attempt_id", m1s1);
    expect(direct.error).not.toBeNull();
  });

  it("replays are full practice attempts that never touch the official record", async () => {
    const officialBefore = (await alice.from("scenario_attempts").select("*").eq("id", m1s1).single()).data;
    const runBefore = (await alice.from("module_runs").select("*").eq("id", m1RunId).single()).data;

    const r = await rpc("create_scenario_attempt", {
      p_user_id: aliceId,
      p_scenario_key: "m1-s1",
      p_content_version: "v-test",
    });
    expect(r.data).toMatchObject({ attempt_number: 2, is_replay: true, state: "INTRO" });
    expect(r.data.id).not.toBe(m1s1); // its own practice attempt id

    // The whole flow is available again: explore, a new decision and justification, a checkout that is cancelled,
    // retried, and finally finished without paying (Step 6 state machine).
    const id = r.data.id as string;
    const flow: [string, string, string, { decision?: string; text?: string }?][] = [
      ["INTRO", "ACTIVE", "START"],
      ["ACTIVE", "DECISION_SELECTED", "SELECT_DECISION", { decision: "pay_now" }],
      ["DECISION_SELECTED", "EXPLANATION_REQUIRED", "CONFIRM_DECISION", { decision: "pay_now" }],
      [
        "EXPLANATION_REQUIRED",
        "PAYMENT_PENDING",
        "SUBMIT_EXPLANATION",
        { text: "A new reasoning for my practice replay attempt." },
      ],
      ["PAYMENT_PENDING", "PAYMENT_CANCELLED", "PAYMENT_CANCELLED"],
      ["PAYMENT_CANCELLED", "PAYMENT_PENDING", "RETRY_PAYMENT"],
      ["PAYMENT_PENDING", "PAYMENT_CANCELLED", "PAYMENT_CANCELLED"],
      ["PAYMENT_CANCELLED", "FINALIZED", "FINALIZE"],
      ["FINALIZED", "FEEDBACK_AVAILABLE", "FEEDBACK_READY"],
      ["FEEDBACK_AVAILABLE", "REVIEW_AVAILABLE", "REVIEW_READY"],
    ];
    for (const [from, to, type, extra] of flow)
      expect((await step(id, from, to, type, extra)).error, type).toBeNull();

    // Replay payments are never charged to the official Training Funds ledger (Phase 5 stores them separately).
    const paid = await rpc("record_training_payment", {
      p_user_id: aliceId,
      p_attempt_id: r.data.id,
      p_amount_minor: 1,
      p_idempotency_key: `it-${RUN}-replay`,
    });
    expect(paid.error?.message).toBe("replay_not_charged");

    expect((await step(id, "REVIEW_AVAILABLE", "RECOVERY_AVAILABLE", "RECOVERY_READY")).error).toBeNull();
    const done = await complete(r.data.id, null, [40, 30, 20, 10]);
    expect(done.error).toBeNull();
    expect(done.data).toMatchObject({ is_replay: true, module_completed: true });

    // Separate records; the official attempt, score, run, and ledger are unchanged.
    const scores = await alice
      .from("scenario_scores")
      .select("attempt_id, is_replay, total_points")
      .eq("scenario_key", "m1-s1")
      .order("is_replay");
    expect(scores.data).toEqual([
      { attempt_id: m1s1, is_replay: false, total_points: 25 },
      { attempt_id: r.data.id, is_replay: true, total_points: 100 },
    ]);
    expect((await alice.from("scenario_attempts").select("*").eq("id", m1s1).single()).data).toEqual(
      officialBefore,
    );
    expect((await alice.from("module_runs").select("*").eq("id", m1RunId).single()).data).toEqual(runBefore);
    expect((await ledger(alice, m1RunId)).length).toBe(2);

    // A third play is possible too, and only one replay can be open at a time.
    const third = await rpc("create_scenario_attempt", {
      p_user_id: aliceId,
      p_scenario_key: "m1-s1",
      p_content_version: "v-test",
    });
    const same = await rpc("create_scenario_attempt", {
      p_user_id: aliceId,
      p_scenario_key: "m1-s1",
      p_content_version: "v-test",
    });
    expect(third.data.attempt_number).toBe(3);
    expect(same.data.id).toBe(third.data.id);
  });

  it("Module 2 now starts with fresh funds and Module 1 history is preserved", async () => {
    const m2 = await rpc("start_module_run", {
      p_user_id: aliceId,
      p_module_key: "trust-under-pressure",
      p_currency: "USD",
      p_starting_funds_minor: 300_000,
    });
    expect(m2.error).toBeNull();
    expect((await ledger(alice, m2.data.id)).map((r) => r.balance_after_minor)).toEqual([300_000]);
    expect((await ledger(alice, m1RunId)).map((r) => r.balance_after_minor)).toEqual([300_000, 285_000]);
  });

  it("other users see none of it", async () => {
    for (const t of ["module_runs", "scenario_attempts", "wallet_ledger_entries", "scenario_scores"]) {
      const r = await bob.from(t).select("user_id");
      expect(r.data ?? [], t).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------------------------------------------------- */

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
    headers: { cookie: jar.header(), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
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

describe.skipIf(!appUp)(`progression API (${APP})`, () => {
  const erin = new Jar();

  it("requires a session", async () => {
    expect((await call(new Jar(), "GET", "/api/progress")).status).toBe(401);
    expect((await call(new Jar(), "POST", "/api/modules/spot-the-trap/start")).status).toBe(401);
  });

  it("signs up and onboards a user with an income bracket (USD only: GBP rejected by the server)", async () => {
    const s = await call(erin, "POST", "/api/auth/sign-up", {
      displayName: "Erin",
      email: email("erin"),
      password: PASSWORD,
      ageConfirmed: true,
    });
    expect(s.status).toBe(201);
    expect((await call(erin, "GET", "/api/progress")).status).toBe(403); // onboarding first
    const p = await call(erin, "PUT", "/api/profile", {
      displayName: "Erin",
      occupation: "student",
      country: "GB",
      financialActivities: ["online_shopping"],
      paymentExperience: "new",
      incomeBracket: "1000_2499",
      financialGoal: "education",
      customGoal: "",
      goalAmount: "",
      preferredCurrency: "GBP",
    });
    expect(p.status).toBe(400);
    expect(p.json.error.fields.preferredCurrency).toBeDefined();
    const ok = await call(erin, "PUT", "/api/profile", {
      displayName: "Erin",
      occupation: "student",
      country: "GB",
      financialActivities: ["online_shopping"],
      paymentExperience: "new",
      incomeBracket: "1000_2499",
      financialGoal: "education",
      customGoal: "",
      goalAmount: "",
      preferredCurrency: "USD",
    });
    expect(ok.status).toBe(200);
  });

  it("previews funds, refuses locked modules, and starts Module 1 idempotently", async () => {
    const before = await call(erin, "GET", "/api/progress");
    expect(before.status).toBe(200);
    expect(before.json.progress.currentWallet).toEqual({
      kind: "preview",
      moduleKey: "spot-the-trap",
      funds: { currency: "USD", startingFundsMinor: 175_000, baselineUsd: 1750, basis: "income_bracket" },
    });
    expect((await call(erin, "POST", "/api/modules/trust-under-pressure/start")).status).toBe(409);
    expect((await call(erin, "POST", "/api/modules/nope/start")).status).toBe(404);

    expect((await call(erin, "POST", "/api/modules/spot-the-trap/start")).status).toBe(201);
    expect((await call(erin, "POST", "/api/modules/spot-the-trap/start")).status).toBe(200);
    const after = await call(erin, "GET", "/api/progress");
    expect(after.json.progress.currentWallet.kind).toBe("active");
    expect(after.json.progress.currentWallet.summary).toMatchObject({
      currency: "USD",
      startingMinor: 175_000,
      balanceMinor: 175_000,
    });
    expect(after.json.progress.modules["spot-the-trap"].ledger).toHaveLength(1);
  });

  it("renders the dashboard with Training Funds (never a PayPal balance)", async () => {
    const page = await call(erin, "GET", "/dashboard");
    expect(page.status).toBe(200);
    expect(page.text).toContain("Training Funds");
    expect(page.text).toContain("$1,750.00");
    expect(page.text).not.toMatch(/PayPal balance<|Demonstration data/);
  });

  it("keeps progress after signing out and back in", async () => {
    const before = (await call(erin, "GET", "/api/progress")).json.progress;
    expect((await call(erin, "POST", "/api/auth/sign-out")).status).toBe(200);
    expect((await call(erin, "GET", "/api/progress")).status).toBe(401);
    const signIn = await call(erin, "POST", "/api/auth/sign-in", {
      email: email("erin"),
      password: PASSWORD,
    });
    expect(signIn.status).toBe(200);
    const after = (await call(erin, "GET", "/api/progress")).json.progress;
    expect(after).toEqual(before);
  });
});
