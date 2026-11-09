/**
 * LIVE integration tests for Step 7: PayPal SANDBOX checkout.
 *
 *   npm run test:integration          (APP_URL defaults to http://localhost:3000 for the API layer)
 *
 * Layer 1 drives the database functions as the trusted server (and as a hostile browser) to prove the money
 * invariants: server-derived amounts, one open order and one capture per attempt, exactly-once ledger debits for the
 * scored attempt, practice replays off the ledger, cancellations/failures never paid. Captures here are database
 * records with synthetic ids — they test the DATABASE rules, not PayPal.
 *
 * Layer 2 drives the real API routes, which create REAL orders in the PayPal Sandbox (verified by reading them back
 * from PayPal). A successful capture needs a Sandbox Personal buyer to approve the order in PayPal's own UI, which an
 * automated test cannot do; that path is verified manually (README "Manual Sandbox checkout test").
 *
 * Requires supabase/migrations/20261111090000_paypal_checkout.sql applied, SUPABASE_SERVICE_ROLE_KEY, and (layer 2)
 * NEXT_PUBLIC_PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET for the Sandbox app. Secrets are never printed.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PP_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
const PP_SECRET = process.env.PAYPAL_CLIENT_SECRET ?? "";
const PP_BASE = "https://api-m.sandbox.paypal.com";
const APP = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DOMAIN = process.env.INTEGRATION_EMAIL_DOMAIN ?? "example.com";
const RUN = Date.now().toString(36);
const PASSWORD = `Practice-not-panic-${RUN}`;
const email = (who: string) => `scamsense.pp.${who}.${RUN}@${DOMAIN}`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const REASON = "The seller profile, reviews and checkout all looked consistent to me.";
const key = (attemptId: string, seq: number) => `scamsense-${attemptId}-checkout-${seq}`;

const migrated =
  !!URL_ &&
  !!KEY &&
  (await fetch(`${URL_}/rest/v1/payment_transactions?select=id&limit=1`, { headers: { apikey: KEY } })
    .then((r) => r.status !== 404)
    .catch(() => false));
const ready = migrated && !!SERVICE;
if (!ready) {
  console.warn(
    `[paypal checkout tests] skipped: ${!migrated ? "apply 20261111090000_paypal_checkout.sql" : "set SUPABASE_SERVICE_ROLE_KEY"}`,
  );
}

async function signUp(who: string) {
  const c = createClient(URL_, KEY, opts);
  const { data, error } = await c.auth.signUp({
    email: email(who),
    password: PASSWORD,
    options: { data: { display_name: `Payer ${who}`, age_confirmed: true } },
  });
  if (error || !data.session) throw new Error(`sign-up failed (is "Confirm email" off?): ${error?.code}`);
  return { c, id: data.user!.id };
}

type Step = [from: string, to: string, type: string, extra?: { decision?: string; text?: string }];
const PIPELINE: Step[] = [
  ["FINALIZED", "FEEDBACK_AVAILABLE", "FEEDBACK_READY"],
  ["FEEDBACK_AVAILABLE", "REVIEW_AVAILABLE", "REVIEW_READY"],
  ["REVIEW_AVAILABLE", "RECOVERY_AVAILABLE", "RECOVERY_READY"],
];

function db(admin: SupabaseClient, userId: string) {
  const step = async (attemptId: string, [from, to, type, extra = {}]: Step) => {
    const r = await admin.rpc("apply_attempt_event", {
      p_user_id: userId,
      p_attempt_id: attemptId,
      p_from_state: from,
      p_to_state: to,
      p_event_type: type,
      p_action_id: null,
      p_decision_id: extra.decision ?? null,
      p_justification: extra.text ?? null,
    });
    if (r.error) throw new Error(`${type}: ${r.error.message}`);
  };
  return {
    step,
    async attempt(scenarioKey: string) {
      const a = await admin.rpc("create_scenario_attempt", {
        p_user_id: userId,
        p_scenario_key: scenarioKey,
        p_content_version: "it",
      });
      if (a.error) throw new Error(a.error.message);
      return a.data.id as string;
    },
    async toDecision(attemptId: string, decision: string, pay: boolean) {
      await step(attemptId, ["INTRO", "ACTIVE", "START"]);
      await step(attemptId, ["ACTIVE", "DECISION_SELECTED", "SELECT_DECISION", { decision }]);
      await step(attemptId, ["DECISION_SELECTED", "EXPLANATION_REQUIRED", "CONFIRM_DECISION", { decision }]);
      await step(attemptId, [
        "EXPLANATION_REQUIRED",
        pay ? "PAYMENT_PENDING" : "FINALIZED",
        "SUBMIT_EXPLANATION",
        { text: REASON },
      ]);
    },
    async complete(attemptId: string, classification: "spending" | "fraud_loss" | null = null) {
      for (const s of PIPELINE) await step(attemptId, s);
      const r = await admin.rpc("complete_scenario_attempt", {
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
        p_payment_classification: classification,
      });
      if (r.error) throw new Error(`complete: ${r.error.message}`);
    },
    order: (
      attemptId: string,
      seq: number,
      orderId: string,
      amount: number,
      currency = "USD",
      requestId?: string,
    ) =>
      admin.rpc("record_payment_order", {
        p_user_id: userId,
        p_attempt_id: attemptId,
        p_request_id: requestId ?? key(attemptId, seq),
        p_paypal_order_id: orderId,
        p_paypal_order_status: "CREATED",
        p_amount_minor: amount,
        p_currency: currency,
      }),
    capture: (paymentId: string, captureId: string, amount: number, status = "COMPLETED", asUser = userId) =>
      admin.rpc("record_payment_capture", {
        p_user_id: asUser,
        p_payment_id: paymentId,
        p_paypal_capture_id: captureId,
        p_paypal_capture_status: status,
        p_paypal_order_status: "COMPLETED",
        p_amount_minor: amount,
        p_currency: "USD",
      }),
    update: (paymentId: string, status: "PENDING" | "CANCELLED" | "FAILED", code: string | null = null) =>
      admin.rpc("update_payment_order", {
        p_user_id: userId,
        p_payment_id: paymentId,
        p_status: status,
        p_paypal_order_status: null,
        p_paypal_capture_id: null,
        p_paypal_capture_status: null,
        p_failure_code: code,
      }),
  };
}

/** Starts Module 1, completes both scenarios without payments, and starts Module 2 (US$3,000). */
async function openModule2(admin: SupabaseClient, userId: string) {
  const d = db(admin, userId);
  for (const [m, funds] of [["spot-the-trap", 300_000]] as const) {
    const r = await admin.rpc("start_module_run", {
      p_user_id: userId,
      p_module_key: m,
      p_currency: "USD",
      p_starting_funds_minor: funds,
    });
    if (r.error) throw new Error(r.error.message);
  }
  for (const [s, decision] of [
    ["m1-s1", "block_report"],
    ["m1-s2", "report_email"],
  ] as const) {
    const id = await d.attempt(s);
    await d.toDecision(id, decision, false);
    await d.complete(id);
  }
  const r = await admin.rpc("start_module_run", {
    p_user_id: userId,
    p_module_key: "trust-under-pressure",
    p_currency: "USD",
    p_starting_funds_minor: 300_000,
  });
  if (r.error) throw new Error(r.error.message);
  return d;
}

const uniq = (p: string) => `${p}${RUN}${Math.random().toString(36).slice(2, 8)}`.toUpperCase().slice(0, 24);

/* ======================================================================================== layer 1: database */

describe.skipIf(!ready)("PayPal checkout (database guarantees)", { timeout: 120_000 }, () => {
  let admin: SupabaseClient;
  let gina: SupabaseClient;
  let ginaId = "";
  let hank: SupabaseClient;
  let hankId = "";
  let d: ReturnType<typeof db>;
  let laptop = "";
  const ledger = async (c: SupabaseClient) =>
    (
      await c
        .from("wallet_ledger_entries")
        .select("entry_type, amount_minor, classification, attempt_id")
        .order("id")
    ).data ?? [];
  const payment = async (c: SupabaseClient, attemptId: string) =>
    (await c.from("payment_transactions").select("*").eq("attempt_id", attemptId).order("checkout_sequence"))
      .data ?? [];
  const state = async (c: SupabaseClient, attemptId: string) =>
    (await c.from("scenario_attempts").select("state").eq("id", attemptId).single()).data?.state;

  beforeAll(async () => {
    admin = createClient(URL_, SERVICE, opts);
    ({ c: gina, id: ginaId } = await signUp("gina"));
    ({ c: hank, id: hankId } = await signUp("hank"));
    d = await openModule2(admin, ginaId);
    laptop = await d.attempt("m2-s2");
    await d.toDecision(laptop, "place_order", true);
  });

  it("browser roles can't write payments or call the payment functions", async () => {
    const insert = await gina.from("payment_transactions").insert({ attempt_id: laptop });
    expect(insert.error).not.toBeNull();
    for (const fn of ["record_payment_order", "record_payment_capture", "update_payment_order"]) {
      const r = await gina.rpc(fn, {});
      expect(r.error, fn).not.toBeNull();
      const anon = await createClient(URL_, KEY, opts).rpc(fn, {});
      expect(anon.error, fn).not.toBeNull();
    }
  });

  it("only accepts the server-derived amount, currency, and checkout sequence", async () => {
    expect((await d.order(laptop, 1, uniq("O"), 99_999)).error?.message).toBe("amount_mismatch"); // modified amount
    expect((await d.order(laptop, 1, uniq("O"), 36_000, "EUR")).error?.message).toBe("currency_mismatch");
    expect((await d.order(laptop, 2, uniq("O"), 36_000)).error?.message).toBe("checkout_sequence_mismatch");
    // Another user can't attach an order to this attempt.
    expect((await db(admin, hankId).order(laptop, 1, uniq("O"), 36_000)).error?.message).toBe(
      "attempt_not_found",
    );
  });

  let p1 = "";
  it("stores one open order per checkout; the same request id returns the same row", async () => {
    const order = uniq("O");
    const a = await d.order(laptop, 1, order, 36_000);
    expect(a.error).toBeNull();
    expect(a.data).toMatchObject({
      status: "CREATED",
      amount_minor: 36_000,
      currency: "USD",
      is_practice: false,
      environment: "sandbox",
      percent_bp: 1200,
    });
    p1 = a.data.id;
    expect((await d.order(laptop, 1, order, 36_000)).data.id).toBe(p1); // idempotent retry
    expect((await d.order(laptop, 1, uniq("O"), 36_000)).error?.message).toBe("payment_order_mismatch");
    // The owner can read it; another user can't.
    expect(await payment(gina, laptop)).toHaveLength(1);
    expect(await payment(hank, laptop)).toEqual([]);
  });

  it("a cancellation is never a payment; a retry gets a new sequence and a new order", async () => {
    expect((await d.update(p1, "CANCELLED", "buyer_cancelled")).error).toBeNull();
    expect(await state(gina, laptop)).toBe("PAYMENT_CANCELLED");
    expect((await d.update(p1, "CANCELLED")).error).toBeNull(); // repeated cancel: idempotent
    expect((await d.capture(p1, uniq("C"), 36_000)).error?.message).toBe("payment_closed"); // can't capture it later
    expect((await ledger(gina)).filter((e) => e.entry_type === "PAYMENT")).toEqual([]);
    await d.step(laptop, ["PAYMENT_CANCELLED", "PAYMENT_PENDING", "RETRY_PAYMENT"]);
    // The cancelled checkout's request id can't be reused for a new order.
    expect((await d.order(laptop, 1, uniq("O"), 36_000)).error?.message).toBe("payment_order_mismatch");
  });

  let p2 = "";
  const captureId = uniq("CAP");
  it("records a verified capture once: CAPTURED, one ledger debit, attempt finalized", async () => {
    const o = await d.order(laptop, 2, uniq("O"), 36_000);
    expect(o.error).toBeNull();
    p2 = o.data.id;
    expect((await d.capture(p2, captureId, 35_000)).error?.message).toBe("capture_amount_mismatch");
    expect((await d.capture(p2, captureId, 36_000, "PENDING")).error?.message).toBe("capture_not_completed");
    expect((await d.capture(p2, captureId, 36_000, "COMPLETED", hankId)).error?.message).toBe(
      "payment_not_found",
    );

    const ok = await d.capture(p2, captureId, 36_000);
    expect(ok.error).toBeNull();
    expect(ok.data).toMatchObject({
      status: "CAPTURED",
      paypal_capture_id: captureId,
      outcome_classification: "pending",
    });
    expect(ok.data.ledger_entry_id).not.toBeNull();
    // Repeating the same capture (retry, refresh, reconciliation) changes nothing; a different one is rejected.
    expect((await d.capture(p2, captureId, 36_000)).data.ledger_entry_id).toBe(ok.data.ledger_entry_id);
    expect((await d.capture(p2, uniq("CAP"), 36_000)).error?.message).toBe("capture_mismatch");

    const pays = (await ledger(gina)).filter((e) => e.entry_type === "PAYMENT");
    expect(pays).toEqual([
      { entry_type: "PAYMENT", amount_minor: -36_000, classification: "pending", attempt_id: laptop },
    ]);
    expect(await state(gina, laptop)).toBe("FINALIZED");
    const events = (
      await gina.from("scenario_attempt_events").select("event_type").eq("attempt_id", laptop).order("id")
    ).data!.map((e) => e.event_type);
    expect(events.slice(-2)).toEqual(["PAYMENT_CAPTURED", "FINALIZE"]);
    expect((await d.order(laptop, 2, uniq("O"), 36_000, "USD", key(laptop, 3))).error?.message).toBe(
      "attempt_state_conflict",
    );
  });

  it("a capture id can never be applied to another attempt or user", async () => {
    const hd = await openModule2(admin, hankId);
    const hankLaptop = await hd.attempt("m2-s2");
    await hd.toDecision(hankLaptop, "place_order", true);
    const o = await hd.order(hankLaptop, 1, uniq("O"), 36_000);
    const reuse = await hd.capture(o.data.id, captureId, 36_000);
    expect(reuse.error?.code).toBe("23505"); // unique paypal_capture_id
    expect((await ledger(hank)).filter((e) => e.entry_type === "PAYMENT")).toEqual([]);
  });

  it("pending captures don't touch Training Funds; failures move to cancelled without a payment", async () => {
    const invoice = await d.attempt("m2-s1");
    await d.toDecision(invoice, "pay_invoice", true);
    const o = await d.order(invoice, 1, uniq("O"), 30_000);
    expect(o.data.amount_minor).toBe(30_000); // 10% of 3,000
    expect((await d.update(o.data.id, "PENDING")).error).toBeNull();
    expect(await state(gina, invoice)).toBe("PAYMENT_PENDING");
    expect((await ledger(gina)).filter((e) => e.attempt_id === invoice)).toEqual([]);
    expect((await d.update(o.data.id, "FAILED", "capture_declined")).error).toBeNull();
    expect(await state(gina, invoice)).toBe("PAYMENT_CANCELLED");
    expect((await payment(gina, invoice))[0]).toMatchObject({
      status: "FAILED",
      failure_code: "capture_declined",
    });
    await d.step(invoice, ["PAYMENT_CANCELLED", "FINALIZED", "FINALIZE"]); // finish without paying
    await d.complete(invoice);
    expect((await ledger(gina)).filter((e) => e.attempt_id === invoice)).toEqual([]);
  });

  it("classifies the payment once at completion, and a replay pays in Sandbox without touching the ledger", async () => {
    await d.complete(laptop, "spending");
    expect((await payment(gina, laptop)).find((p) => p.status === "CAPTURED")?.outcome_classification).toBe(
      "spending",
    );
    expect((await ledger(gina)).find((e) => e.attempt_id === laptop)?.classification).toBe("spending");
    const before = await ledger(gina);
    const run = (await gina.from("module_runs").select("*").eq("module_key", "trust-under-pressure").single())
      .data;
    expect(run.completed_at).not.toBeNull(); // both Module 2 scenarios completed

    const replay = await d.attempt("m2-s2");
    expect(replay).not.toBe(laptop);
    await d.toDecision(replay, "place_order", true);
    const o = await d.order(replay, 1, uniq("O"), 36_000);
    expect(o.data).toMatchObject({ is_practice: true, request_id: key(replay, 1) });
    const cap = await d.capture(o.data.id, uniq("CAP"), 36_000);
    expect(cap.error).toBeNull();
    expect(cap.data).toMatchObject({ status: "CAPTURED", ledger_entry_id: null });
    expect(await state(gina, replay)).toBe("FINALIZED");
    // Official ledger, module run, and the original score are untouched.
    expect(await ledger(gina)).toEqual(before);
    expect(
      (await gina.from("module_runs").select("*").eq("module_key", "trust-under-pressure").single()).data,
    ).toEqual(run);
    // The practice payment is classified for learning when the replay completes.
    await d.complete(replay, "spending");
    expect((await payment(gina, replay))[0].outcome_classification).toBe("spending");
    const scores = (
      await gina.from("scenario_scores").select("attempt_id, is_replay").eq("scenario_key", "m2-s2")
    ).data!;
    expect(scores.filter((s) => !s.is_replay).map((s) => s.attempt_id)).toEqual([laptop]);
  });

  it("captured payments can't be rewritten", async () => {
    expect((await d.update(p2, "FAILED")).error?.message).toBe("payment_closed");
    const tamper = await admin.from("payment_transactions").update({ amount_minor: 1 }).eq("id", p2);
    expect(tamper.error).not.toBeNull(); // no UPDATE grant, and the trigger would refuse anyway
  });
});

/* ======================================================================================== layer 2: API + Sandbox */

const appUp =
  ready &&
  !!PP_ID &&
  !!PP_SECRET &&
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

async function apiUser(who: string) {
  const { id } = await signUp(who);
  const jar = new Jar();
  if (
    (await call(jar, "POST", "/api/auth/sign-in", { email: email(who), password: PASSWORD })).status !== 200
  ) {
    throw new Error("sign-in failed");
  }
  const p = await call(jar, "PUT", "/api/profile", {
    displayName: `Payer ${who}`,
    occupation: "student",
    country: "US",
    financialActivities: ["online_shopping"],
    paymentExperience: "occasional",
    incomeBracket: "prefer_not_to_say",
    financialGoal: "buying_laptop",
    customGoal: "",
    goalAmount: "",
    preferredCurrency: "USD",
  });
  if (p.status !== 200) throw new Error(`profile ${p.status}`);
  return { id, jar };
}

/** Reads an order straight from PayPal Sandbox (independent of the app) to prove it is real. */
async function paypalOrder(orderId: string) {
  const t = await fetch(`${PP_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${PP_ID}:${PP_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const { access_token } = (await t.json()) as { access_token: string };
  const r = await fetch(`${PP_BASE}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  return {
    status: r.status,
    json: (await r.json()) as {
      status: string;
      purchase_units: { custom_id: string; amount: { currency_code: string; value: string } }[];
    },
  };
}

describe.skipIf(!appUp)(`PayPal Sandbox checkout API (${APP})`, { timeout: 240_000 }, () => {
  let admin: SupabaseClient;
  let ivy: { id: string; jar: Jar };
  let jack: { id: string; jar: Jar };
  let laptop = "";
  let firstOrder = "";
  const ev = (who: { jar: Jar }, id: string, body: unknown) =>
    call(who.jar, "POST", `/api/attempts/${id}/events`, body);
  const co = (who: { jar: Jar }, id: string, path: string, body?: unknown) =>
    call(who.jar, "POST", `/api/attempts/${id}/checkout/${path}`, body);

  async function toCheckout(who: { jar: Jar }, scenarioKey: string, actions: string[], decision: string) {
    const id = (await call(who.jar, "POST", `/api/scenarios/${scenarioKey}/attempts`)).json
      .attemptId as string;
    expect((await ev(who, id, { type: "START" })).status).toBe(200);
    for (const a of actions)
      expect((await ev(who, id, { type: "RECORD_ACTION", actionId: a })).status, a).toBe(200);
    expect((await ev(who, id, { type: "SELECT_DECISION", decisionId: decision })).status).toBe(200);
    expect((await ev(who, id, { type: "CONFIRM_DECISION" })).status).toBe(200);
    return {
      id,
      explained: await call(who.jar, "POST", `/api/attempts/${id}/justification`, { text: REASON }),
    };
  }

  beforeAll(async () => {
    admin = createClient(URL_, SERVICE, opts);
    ivy = await apiUser("ivy");
    jack = await apiUser("jack");
    await openModule2(admin, ivy.id);
    const r = await toCheckout(
      ivy,
      "m2-s2",
      ["view_product", "view_seller_profile", "read_reviews", "view_checkout"],
      "place_order",
    );
    laptop = r.id;
    expect(r.explained.json.attempt).toMatchObject({
      state: "PAYMENT_PENDING",
      checkout: { amountText: "$360.00", currency: "USD", available: true, openOrder: null },
    });
  });

  it("requires a session and the attempt's owner", async () => {
    expect((await co({ jar: new Jar() }, laptop, "order")).status).toBe(401);
    expect((await co(jack, laptop, "order")).status).toBe(404);
    expect((await co(jack, laptop, "capture", { orderId: "ABC123" })).status).toBe(404);
    expect((await co(jack, laptop, "cancel")).status).toBe(404);
  });

  it("creates a REAL Sandbox order for the server-computed amount, and reuses it for double clicks", async () => {
    // A client-supplied amount is ignored: the route takes no body.
    const results = await Promise.all([
      co(ivy, laptop, "order", { amount: "1.00" }),
      co(ivy, laptop, "order"),
      co(ivy, laptop, "order"),
    ]);
    const ok = results.filter((r) => r.status === 200);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    // A request that didn't get 200 was told PayPal is still processing (retry), never given a second order.
    for (const r of results.filter((x) => x.status !== 200)) expect(r.status).toBe(503);
    firstOrder = ok[0]!.json.orderId;
    expect(ok.every((r) => r.json.orderId === firstOrder)).toBe(true);
    expect((await co(ivy, laptop, "order")).json.orderId).toBe(firstOrder); // a refresh gets the same order

    const pp = await paypalOrder(firstOrder);
    expect(pp.status).toBe(200);
    expect(pp.json.status).toBe("CREATED");
    expect(pp.json.purchase_units[0]).toMatchObject({
      custom_id: laptop,
      amount: { currency_code: "USD", value: "360.00" },
    });

    const rows = (await admin.from("payment_transactions").select("*").eq("attempt_id", laptop)).data!;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      paypal_order_id: firstOrder,
      status: "CREATED",
      amount_minor: 36_000,
      request_id: key(laptop, 1),
    });
  });

  it("never treats an unapproved order as paid", async () => {
    const cap = await co(ivy, laptop, "capture", { orderId: firstOrder });
    expect(cap.status).toBe(409);
    expect(cap.json.error.code).toBe("not_approved");
    expect((await co(ivy, laptop, "sync")).json).toMatchObject({
      outcome: "awaiting_approval",
      attempt: { state: "PAYMENT_PENDING" },
    });
    expect((await co(ivy, laptop, "capture", { orderId: "NOTMYORDER123" })).status).toBe(404); // order mismatch
    expect((await co(ivy, laptop, "capture", { orderId: "../x" })).status).toBe(400);
    const progress = (await call(ivy.jar, "GET", "/api/progress")).json.progress;
    expect(progress.modules["trust-under-pressure"].wallet.balanceMinor).toBe(300_000);
  });

  it("cancels after checking with PayPal; retry creates a new real order; Training Funds untouched", async () => {
    expect((await ev(ivy, laptop, { type: "PAYMENT_CANCELLED" })).status).toBe(400); // only via /checkout/cancel
    const c = await co(ivy, laptop, "cancel");
    expect(c.status).toBe(200);
    expect(c.json).toMatchObject({
      outcome: "cancelled",
      attempt: { state: "PAYMENT_CANCELLED", checkout: { lastClosed: "CANCELLED" } },
    });
    expect((await co(ivy, laptop, "capture", { orderId: firstOrder })).json.error.code).toBe(
      "checkout_closed",
    );
    expect((await co(ivy, laptop, "order")).status).toBe(409); // no checkout while cancelled
    expect((await ev(ivy, laptop, { type: "RETRY_PAYMENT" })).json.attempt.checkout.checkoutSequence).toBe(2);
    const second = await co(ivy, laptop, "order");
    expect(second.status).toBe(200);
    expect(second.json.orderId).not.toBe(firstOrder);
    expect((await paypalOrder(second.json.orderId)).json.purchase_units[0]!.amount.value).toBe("360.00");
    const progress = (await call(ivy.jar, "GET", "/api/progress")).json.progress;
    expect(progress.modules["trust-under-pressure"].ledger).toHaveLength(1);
    expect(progress.modules["trust-under-pressure"].wallet.balanceMinor).toBe(300_000);
  });

  it("connects the invoice and job scenarios to the same checkout, and keeps non-payment scenarios out", async () => {
    const invoice = await toCheckout(ivy, "m2-s1", ["open_invoice"], "pay_invoice");
    expect(invoice.explained.json.attempt.checkout).toMatchObject({
      amountText: "$300.00",
      payee: "Brightline Billing Services LLC",
    });
    const io = await co(ivy, invoice.id, "order");
    expect(io.status).toBe(200);
    expect((await paypalOrder(io.json.orderId)).json.purchase_units[0]).toMatchObject({
      custom_id: invoice.id,
      amount: { value: "300.00" },
    });
    expect((await co(ivy, invoice.id, "cancel")).json.outcome).toBe("cancelled");
    expect((await ev(ivy, invoice.id, { type: "FINALIZE" })).json.attempt).toMatchObject({
      state: "FINALIZED",
      payment: null,
    });

    // Module 3: finish Module 2 the way Steps 8–9 will, then the job scenario's equipment deposit.
    const d = db(admin, ivy.id);
    expect((await co(ivy, laptop, "cancel")).json.outcome).toBe("cancelled");
    await ev(ivy, laptop, { type: "FINALIZE" });
    await d.complete(laptop);
    await d.complete(invoice.id);
    expect((await call(ivy.jar, "POST", "/api/modules/outsmart-the-scam/start")).status).toBe(201);
    const job = await toCheckout(ivy, "m3-s1", ["open_onboarding_chat", "ask_payment_details"], "pay_fee");
    expect(job.explained.json.attempt.checkout.amountText).toBe("$450.00"); // 15% of 3,000
    const jo = await co(ivy, job.id, "order");
    expect((await paypalOrder(jo.json.orderId)).json.purchase_units[0]!.amount.value).toBe("450.00");

    // The seller's dilemma: shipping is a decision, never a checkout (no fabricated capture).
    const seller = await toCheckout(ivy, "m3-s2", [], "hold_shipment");
    expect(seller.explained.json.attempt).toMatchObject({
      state: "FINALIZED",
      checkout: null,
      payment: null,
    });
    expect((await co(ivy, seller.id, "order")).status).toBe(409);
    // OTP scenario: finalized without any checkout either.
    const m1 = (
      await admin
        .from("scenario_attempts")
        .select("id")
        .eq("user_id", ivy.id)
        .eq("scenario_key", "m1-s1")
        .single()
    ).data!.id;
    expect((await co(ivy, m1, "order")).status).toBe(409);
  });

  it("a replay gets its own real Sandbox order, separate from the original attempt", async () => {
    const before = (await call(ivy.jar, "GET", "/api/progress")).json.progress;
    const replay = await toCheckout(
      ivy,
      "m2-s2",
      ["view_product", "view_seller_profile", "read_reviews", "view_checkout"],
      "place_order",
    );
    expect(replay.id).not.toBe(laptop);
    expect(replay.explained.json.attempt).toMatchObject({ isPractice: true, state: "PAYMENT_PENDING" });
    const o = await co(ivy, replay.id, "order");
    expect(o.status).toBe(200);
    const pp = await paypalOrder(o.json.orderId);
    expect(pp.json.purchase_units[0]).toMatchObject({ custom_id: replay.id, amount: { value: "360.00" } });
    const row = (
      await admin
        .from("payment_transactions")
        .select("is_practice, request_id")
        .eq("paypal_order_id", o.json.orderId)
        .single()
    ).data!;
    expect(row).toEqual({ is_practice: true, request_id: key(replay.id, 1) });
    const after = (await call(ivy.jar, "GET", "/api/progress")).json.progress;
    for (const k of ["ledger", "wallet"]) {
      expect(after.modules["trust-under-pressure"][k]).toEqual(before.modules["trust-under-pressure"][k]);
    }
  });
});
