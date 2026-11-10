/**
 * LIVE Step 9 checks (Reveal the Red Flags + Your Recovery Playbook) against the real Supabase project and a running
 * app (APP_URL, default http://localhost:3000). Attempts are completed through the trusted writer with a synthetic
 * evaluation, so this suite makes NO evaluation Gemini call. The Playbook note POST may make ONE Gemini call per
 * attempt only when 20261114090000_recovery_playbooks.sql is applied (otherwise it answers "unavailable").
 *
 *   npm run build && npm start   # in another terminal
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
const APP = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DOMAIN = process.env.INTEGRATION_EMAIL_DOMAIN ?? "example.com";
const RUN = Date.now().toString(36);
const PASSWORD = `Practice-not-panic-${RUN}`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const REASON = "The sender wasn't a saved contact and the app says it never asks for codes.";
const email = (who: string) => `scamsense.s9.${who}.${RUN}@${DOMAIN}`;

const step8 =
  !!URL_ &&
  !!KEY &&
  (await fetch(`${URL_}/rest/v1/attempt_evaluations?select=attempt_id&limit=1`, { headers: { apikey: KEY } })
    .then((r) => r.status !== 404)
    .catch(() => false));
const step9Migrated =
  !!URL_ &&
  (await fetch(`${URL_}/rest/v1/attempt_recovery_playbooks?select=attempt_id&limit=1`, {
    headers: { apikey: KEY },
  })
    .then((r) => r.status !== 404)
    .catch(() => false));
const appUp = await fetch(`${APP}/api/config/currencies`)
  .then((r) => r.ok)
  .catch(() => false);
const ready = step8 && !!SERVICE && appUp;
if (!ready)
  console.warn(
    `[step 9 tests] skipped: ${!step8 ? "Step 8 migration" : !SERVICE ? "service key" : "app not running"}`,
  );
if (ready && !step9Migrated)
  console.warn(
    "[step 9 tests] 20261114090000_recovery_playbooks.sql not applied: Playbook notes stay 'unavailable'",
  );

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

async function call(jar: Jar, method: string, path: string) {
  const res = await fetch(`${APP}${path}`, { method, redirect: "manual", headers: { cookie: jar.header() } });
  jar.store(res);
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, json, text, location: res.headers.get("location") };
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

async function user(who: string) {
  const c = createClient(URL_, KEY, opts);
  const { data, error } = await c.auth.signUp({
    email: email(who),
    password: PASSWORD,
    options: { data: { display_name: `Step9 ${who}`, age_confirmed: true } },
  });
  if (error || !data.session) throw new Error(`sign-up failed (is "Confirm email" off?): ${error?.code}`);
  const jar = new Jar();
  const s = await fetch(`${APP}/api/auth/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email(who), password: PASSWORD }),
  });
  jar.store(s);
  const p = await fetch(`${APP}/api/profile`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: jar.header() },
    body: JSON.stringify(PROFILE),
  });
  if (!p.ok) throw new Error(`profile ${p.status}`);
  return { id: data.user!.id, jar };
}

describe.skipIf(!ready)(`Step 9 review + playbook (${APP})`, { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let erin: { id: string; jar: Jar };
  let frank: { id: string; jar: Jar };
  let original = "";
  let unfinished = "";
  let replay = "";

  async function attempt(userId: string, from: "FINALIZED" | "COMPLETED") {
    const a = await admin.rpc("create_scenario_attempt", {
      p_user_id: userId,
      p_scenario_key: "m1-s1",
      p_content_version: "it",
    });
    if (a.error) throw new Error(a.error.message);
    const id = (a.data as { id: string }).id;
    const step = (f: string, t: string, type: string, extra: Record<string, string | null> = {}) =>
      admin.rpc("apply_attempt_event", {
        p_user_id: userId,
        p_attempt_id: id,
        p_from_state: f,
        p_to_state: t,
        p_event_type: type,
        p_action_id: extra.action ?? null,
        p_decision_id: extra.decision ?? null,
        p_justification: extra.text ?? null,
      });
    for (const [f, t, type, extra] of [
      ["INTRO", "ACTIVE", "START", {}],
      ["ACTIVE", "INVESTIGATING", "RECORD_ACTION", { action: "check_sender_details" }],
      ["INVESTIGATING", "DECISION_SELECTED", "SELECT_DECISION", { decision: "block_report" }],
      ["DECISION_SELECTED", "EXPLANATION_REQUIRED", "CONFIRM_DECISION", { decision: "block_report" }],
      ["EXPLANATION_REQUIRED", "FINALIZED", "SUBMIT_EXPLANATION", { text: REASON }],
    ] as const) {
      const r = await step(f, t, type, extra);
      if (r.error) throw new Error(`${type}: ${r.error.message}`);
    }
    if (from === "FINALIZED") return id;
    const claim = await admin.rpc("claim_attempt_evaluation", { p_user_id: userId, p_attempt_id: id });
    if (claim.error) throw new Error(claim.error.message);
    const r = await admin.rpc("record_attempt_evaluation", {
      p_user_id: userId,
      p_attempt_id: id,
      p_source: "fallback",
      p_model: null,
      p_prompt_version: "it",
      p_decision_correct: true,
      p_decision_assessment: "correct_strong_reasoning",
      p_recognized_evidence_ids: ["unknown_number"],
      p_missed_evidence_ids: ["asked_for_code"],
      p_unsupported_assumptions: [],
      p_reasoning_explanation: "Nice work noticing the unsaved number.",
      p_verification_feedback: "Good checking.",
      p_payment_behavior_feedback: "Nothing was shared.",
      p_improvement_advice: "Also check the app.",
      p_educational_takeaway: "Never share a code you didn't ask for.",
      p_humorous_comment: "Keep going.",
      p_evaluation_confidence: "high",
      p_input_tokens: null,
      p_output_tokens: null,
      p_latency_ms: null,
      p_decision_points: 40,
      p_reasoning_points: 8,
      p_verification_points: 3,
      p_payment_safety_points: 10,
      p_verification_action_ids: ["check_sender_details"],
      p_scoring_version: "integration-test",
      p_payment_classification: null,
    });
    if (r.error) throw new Error(r.error.message);
    return id;
  }

  async function snapshot(userId: string) {
    const [att, ev, sc, led, pay, run] = await Promise.all([
      admin
        .from("scenario_attempts")
        .select("id, state, decision_id, justification, updated_at")
        .eq("user_id", userId)
        .order("id"),
      admin.from("scenario_attempt_events").select("id").eq("user_id", userId),
      admin
        .from("scenario_scores")
        .select("attempt_id, total_points")
        .eq("user_id", userId)
        .order("attempt_id"),
      admin.from("wallet_ledger_entries").select("id, amount_minor").eq("user_id", userId),
      admin.from("payment_transactions").select("id").eq("user_id", userId),
      admin.from("module_runs").select("id, completed_at").eq("user_id", userId),
    ]);
    return JSON.stringify([att.data, ev.data?.length, sc.data, led.data, pay.data, run.data]);
  }

  beforeAll(async () => {
    admin = createClient(URL_, SERVICE, opts);
    erin = await user("erin");
    frank = await user("frank");
    const r = await admin.rpc("start_module_run", {
      p_user_id: erin.id,
      p_module_key: "spot-the-trap",
      p_currency: "USD",
      p_starting_funds_minor: 300_000,
    });
    if (r.error) throw new Error(r.error.message);
    original = await attempt(erin.id, "COMPLETED");
    replay = await attempt(erin.id, "COMPLETED"); // attempt_number 2 = practice replay
    unfinished = await attempt(erin.id, "FINALIZED"); // a third (replay) attempt left unfinished
  });

  it("hides the review and Playbook of an unfinished attempt (no evidence text in the response)", async () => {
    for (const path of [`/play/${unfinished}/review`, `/play/${unfinished}/playbook`]) {
      const r = await call(erin.jar, "GET", path);
      expect(r.text).not.toContain("Someone asked for your verification code");
      expect(r.text).not.toContain("A one-time code is a key to your account");
    }
    const api = await call(erin.jar, "POST", `/api/attempts/${unfinished}/playbook`);
    expect(api.status).toBe(409);
    expect(api.json.error.code).toBe("not_completed");
  });

  it("renders the read-only review with the authored evidence and the learner's reasoning", async () => {
    const r = await call(erin.jar, "GET", `/play/${original}/review`);
    expect(r.status).toBe(200);
    expect(r.text).toContain("Reveal the Red Flags");
    expect(r.text).toContain("Someone asked for your verification code"); // answer-key title (after completion)
    expect(r.text).toContain("Review mode");
    expect(r.text).toContain("mentioned"); // reasoning state is serialized separately
  });

  it("renders the Playbook with verified sources and the U.S. label, no invented deadlines", async () => {
    const r = await call(erin.jar, "GET", `/play/${original}/playbook`);
    expect(r.status).toBe(200);
    expect(r.text).toContain("Based on U.S. PayPal policies. Eligibility and terms apply.");
    expect(r.text).toContain("https://www.paypal.com/us/security/report-fraud");
    expect(r.text).toContain("phishing@paypal.com");
    // 2026-11-10: every source is verified, so no placeholder cards remain.
    expect(r.text).not.toContain("Not yet verified");
    expect(r.text).not.toContain("HTTP 403");
    expect(r.text).toContain("PayPal User Agreement: Liability for Unauthorized Transactions");
  });

  it("another user gets neither page nor note", async () => {
    for (const path of [`/play/${original}/review`, `/play/${original}/playbook`]) {
      const r = await call(frank.jar, "GET", path);
      expect(r.text).not.toContain("Someone asked for your verification code");
      expect(r.text).not.toContain("A one-time code is a key to your account");
    }
    expect((await call(frank.jar, "POST", `/api/attempts/${original}/playbook`)).status).toBe(404);
    expect((await call(new Jar(), "POST", `/api/attempts/${original}/playbook`)).status).toBe(401);
  });

  it("opening review/Playbook never changes attempts, events, scores, ledger, payments, or progress", async () => {
    const before = await snapshot(erin.id);
    await call(erin.jar, "GET", `/play/${original}/review`);
    await call(erin.jar, "GET", `/play/${original}/playbook`);
    const n1 = await call(erin.jar, "POST", `/api/attempts/${original}/playbook`);
    const n2 = await call(erin.jar, "POST", `/api/attempts/${original}/playbook`);
    expect(n1.status).toBe(200);
    if (step9Migrated) {
      expect(n1.json.note.status).toMatch(/ready|pending/);
      expect(n2.json.note).toEqual(n1.json.note.status === "ready" ? n1.json.note : n2.json.note);
    } else {
      expect(n1.json.note).toEqual({ status: "unavailable" });
    }
    expect(await snapshot(erin.id)).toBe(before);
  });

  it("keeps the original and the replay separate (each reviews its own attempt)", async () => {
    const r = await call(erin.jar, "GET", `/play/${replay}/review`);
    expect(r.status).toBe(200);
    expect(r.text).toMatch(/Practice attempt (<!-- -->)?2/);
    const o = await call(erin.jar, "GET", `/play/${original}/review`);
    expect(o.text).not.toContain("Practice attempt");
    if (step9Migrated) {
      const rows = await admin
        .from("attempt_recovery_playbooks")
        .select("attempt_id, is_practice")
        .eq("user_id", erin.id);
      for (const row of rows.data ?? []) expect(row.is_practice).toBe(row.attempt_id !== original);
    }
  });
});
