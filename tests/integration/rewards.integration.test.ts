/**
 * LIVE Step 11 checks (module rewards, certificates, analysis report, certificate email requests, private PDF storage)
 * against the real Supabase project and a running app (APP_URL, default http://localhost:3000).
 *
 * Attempts are completed through the trusted writer with a synthetic stored evaluation: NO Gemini call, NO PayPal call.
 * Email-request deduplication is exercised through the database functions directly, so Zapier is NOT called — except
 * in the opt-in last test, which sends ONE real certificate email when ZAPIER_LIVE_TEST_EMAIL is set.
 *
 *   npm run build && npm start   # in another terminal
 *   npx vitest run --config vitest.integration.config.mts tests/integration/rewards.integration.test.ts
 *   ZAPIER_LIVE_TEST_EMAIL=you@example.com npx vitest run ... (optional: real Zapier → Gmail email with the PDF)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const APP = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DOMAIN = process.env.INTEGRATION_EMAIL_DOMAIN ?? "example.com";
const LIVE_EMAIL = process.env.ZAPIER_LIVE_TEST_EMAIL ?? "";
const RUN = Date.now().toString(36);
const PASSWORD = `Practice-not-panic-${RUN}`;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const REASON = "The sender wasn't a saved contact and the app says it never asks for codes.";
const email = (who: string) => `scamsense.s11.${who}.${RUN}@${DOMAIN}`;
const CODE = /^SS[1-3]-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

const migrated =
  !!URL_ &&
  !!KEY &&
  (await fetch(`${URL_}/rest/v1/certificates?select=id&limit=1`, { headers: { apikey: KEY } })
    .then((r) => r.status !== 404)
    .catch(() => false));
const appUp = await fetch(`${APP}/api/config/currencies`)
  .then((r) => r.ok)
  .catch(() => false);
const ready = migrated && !!SERVICE && appUp;
if (!ready)
  console.warn(
    `[step 11 tests] skipped: ${!migrated ? "20261115090000_module_rewards.sql not applied" : !SERVICE ? "service key" : "app not running"}`,
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

async function call(jar: Jar | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${APP}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(jar ? { cookie: jar.header() } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  jar?.store(res);
  const buf = Buffer.from(await res.arrayBuffer());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = JSON.parse(buf.toString("utf8"));
  } catch {
    /* pdf or html */
  }
  return { status: res.status, json, buf, headers: res.headers };
}

const PROFILE = (name: string) => ({
  displayName: name,
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

async function user(who: string, name: string) {
  const c = createClient(URL_, KEY, opts);
  const { data, error } = await c.auth.signUp({
    email: email(who),
    password: PASSWORD,
    options: { data: { display_name: name, age_confirmed: true } },
  });
  if (error || !data.session) throw new Error(`sign-up failed (is "Confirm email" off?): ${error?.code}`);
  const jar = new Jar();
  jar.store(
    await fetch(`${APP}/api/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email(who), password: PASSWORD }),
    }),
  );
  const p = await fetch(`${APP}/api/profile`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: jar.header() },
    body: JSON.stringify(PROFILE(name)),
  });
  if (!p.ok) throw new Error(`profile ${p.status}`);
  return { id: data.user!.id, jar, client: c };
}

describe.skipIf(!ready)(`Step 11 rewards (${APP})`, { timeout: 180_000 }, () => {
  let admin: SupabaseClient;
  let erin: Awaited<ReturnType<typeof user>>;
  let frank: Awaited<ReturnType<typeof user>>;
  const originals: string[] = [];

  async function complete(userId: string, scenario: "m1-s1" | "m1-s2", points: number) {
    const a = await admin.rpc("create_scenario_attempt", {
      p_user_id: userId,
      p_scenario_key: scenario,
      p_content_version: "it",
    });
    if (a.error) throw new Error(a.error.message);
    const id = (a.data as { id: string }).id;
    const decision = scenario === "m1-s1" ? "block_report" : "report_email";
    for (const [f, t, type, extra] of [
      ["INTRO", "ACTIVE", "START", {}],
      ["ACTIVE", "INVESTIGATING", "RECORD_ACTION", { action: "check_sender_details" }],
      ["INVESTIGATING", "DECISION_SELECTED", "SELECT_DECISION", { decision }],
      ["DECISION_SELECTED", "EXPLANATION_REQUIRED", "CONFIRM_DECISION", { decision }],
      ["EXPLANATION_REQUIRED", "FINALIZED", "SUBMIT_EXPLANATION", { text: REASON }],
    ] as const) {
      const r = await admin.rpc("apply_attempt_event", {
        p_user_id: userId,
        p_attempt_id: id,
        p_from_state: f,
        p_to_state: t,
        p_event_type: type,
        p_action_id: ("action" in extra ? extra.action : null) ?? null,
        p_decision_id: ("decision" in extra ? extra.decision : null) ?? null,
        p_justification: ("text" in extra ? extra.text : null) ?? null,
      });
      if (r.error) throw new Error(`${type}: ${r.error.message}`);
    }
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
      p_recognized_evidence_ids: [],
      p_missed_evidence_ids: [],
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
      // Split (points - decision 40 - payment safety 10) within the rubric caps: reasoning ≤ 30, verification ≤ 20.
      p_reasoning_points: Math.min(30, points - 50),
      p_verification_points: points - 50 - Math.min(30, points - 50),
      p_payment_safety_points: 10,
      p_verification_action_ids: ["check_sender_details"],
      p_scoring_version: "integration-test",
      p_payment_classification: null,
    });
    if (r.error) throw new Error(r.error.message);
    return id;
  }

  async function snapshot(userId: string) {
    const [att, sc, led, run, badge, cert] = await Promise.all([
      admin.from("scenario_attempts").select("id, state, updated_at").eq("user_id", userId).order("id"),
      admin
        .from("scenario_scores")
        .select("attempt_id, total_points")
        .eq("user_id", userId)
        .order("attempt_id"),
      admin.from("wallet_ledger_entries").select("id, amount_minor").eq("user_id", userId).order("id"),
      admin
        .from("module_runs")
        .select("id, completed_at, closing_balance_minor")
        .eq("user_id", userId)
        .order("id"),
      admin.from("badges").select("*").eq("user_id", userId).order("module_key"),
      admin.from("certificates").select("*").eq("user_id", userId).order("module_key"),
    ]);
    return JSON.stringify([att.data, sc.data, led.data, run.data, badge.data, cert.data]);
  }

  beforeAll(async () => {
    admin = createClient(URL_, SERVICE, opts);
    erin = await user("erin", "Erin Łukasiewicz");
    frank = await user("frank", "Frank Example");
    const r = await admin.rpc("start_module_run", {
      p_user_id: erin.id,
      p_module_key: "spot-the-trap",
      p_currency: "USD",
      p_starting_funds_minor: 300_000,
    });
    if (r.error) throw new Error(r.error.message);
    originals.push(await complete(erin.id, "m1-s1", 80));
    // Not complete yet: no rewards.
    const none = await admin.from("certificates").select("id").eq("user_id", erin.id);
    expect(none.data).toEqual([]);
    originals.push(await complete(erin.id, "m1-s2", 70));
  });

  it("awards exactly one badge and one certificate with the frozen module score", async () => {
    const [badges, certs, run] = await Promise.all([
      admin.from("badges").select("*").eq("user_id", erin.id),
      admin.from("certificates").select("*").eq("user_id", erin.id),
      admin.from("module_runs").select("completed_at").eq("user_id", erin.id).single(),
    ]);
    expect(badges.data).toHaveLength(1);
    expect(certs.data).toHaveLength(1);
    expect(badges.data![0]).toMatchObject({ badge_key: "scam-spotter", module_score: 150, max_score: 200 });
    const c = certs.data![0];
    expect(c.certificate_code).toMatch(CODE);
    expect(c).toMatchObject({ recipient_name: "Erin Łukasiewicz", module_title: "Spot the Trap" });
    expect(Date.parse(c.completed_at)).toBe(Date.parse(run.data!.completed_at));
  });

  it("is idempotent: repair calls, replays, and repeat completions change nothing", async () => {
    const before = await snapshot(erin.id);
    expect(
      (await admin.rpc("ensure_module_rewards", { p_user_id: erin.id, p_module_key: "spot-the-trap" })).data,
    ).toBe("awarded");
    // A replay of m1-s1 (practice) completes without touching the official record.
    await complete(erin.id, "m1-s1", 100);
    const after = JSON.parse(await snapshot(erin.id));
    const prev = JSON.parse(before);
    expect(after[1].filter((s: { attempt_id: string }) => originals.includes(s.attempt_id))).toEqual(
      prev[1].filter((s: { attempt_id: string }) => originals.includes(s.attempt_id)),
    );
    expect(after[3]).toEqual(prev[3]); // module run (completion + closing balance)
    expect(after[4]).toEqual(prev[4]); // badges
    expect(after[5]).toEqual(prev[5]); // certificates: same code
  });

  it("keeps rewards final and unwritable from the browser", async () => {
    const upd = await admin.from("certificates").update({ recipient_name: "Mallory" }).eq("user_id", erin.id);
    expect(upd.error?.message ?? "").toMatch(/module_reward_final|permission denied/);
    const ins = await erin.client
      .from("badges")
      .insert({ user_id: erin.id, module_key: "outsmart-the-scam" });
    expect(ins.error).not.toBeNull();
    const fn = await erin.client.rpc("ensure_module_rewards", {
      p_user_id: erin.id,
      p_module_key: "spot-the-trap",
    });
    expect(fn.error).not.toBeNull();
    const peek = await frank.client.from("certificates").select("id").eq("user_id", erin.id);
    expect(peek.data ?? []).toEqual([]);
  });

  it("unlocks the next module", async () => {
    const r = await admin.rpc("start_module_run", {
      p_user_id: erin.id,
      p_module_key: "trust-under-pressure",
      p_currency: "USD",
      p_starting_funds_minor: 300_000,
    });
    expect(r.error).toBeNull();
  });

  it("serves certificate data to the owner only, with no file or link", async () => {
    const own = await call(erin.jar, "GET", "/api/certificates/spot-the-trap");
    expect(own.status).toBe(200);
    expect(own.json.certificate).toMatchObject({
      moduleTitle: "Spot the Trap",
      recipientName: "Erin Łukasiewicz",
    });
    expect(own.json.certificate.certificateId).toMatch(CODE);
    expect(own.json.certificate.id).toBeUndefined();
    expect(JSON.stringify(own.json)).not.toMatch(/https?:\/\/|token=|\.pdf/);
    expect((await call(frank.jar, "GET", "/api/certificates/spot-the-trap")).status).toBe(409);
    expect((await call(null, "GET", "/api/certificates/spot-the-trap")).status).toBe(401);
    const page = await call(erin.jar, "GET", "/modules/spot-the-trap/complete");
    expect(page.status).toBe(200);
    const html = page.buf.toString("utf8");
    expect(html).toContain("Certificate of Completion");
    expect(html).toContain(own.json.certificate.certificateId);
    expect(html).toContain("Download Analysis Report");
    expect(html).not.toMatch(/Download (my |your )?certificate/i);
  });

  it("downloads the analysis report as a PDF, repeatably, for the owner only", async () => {
    const before = await snapshot(erin.id);
    for (let i = 0; i < 2; i++) {
      const r = await call(erin.jar, "GET", "/api/modules/spot-the-trap/report");
      expect(r.status).toBe(200);
      expect(r.headers.get("content-type")).toBe("application/pdf");
      expect(r.headers.get("content-disposition")).toMatch(
        /^attachment; filename="ScamSense-Analysis-Report-Module-1-Spot-the-Trap-\d{4}-\d{2}-\d{2}\.pdf"$/,
      );
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      expect(r.buf.subarray(0, 5).toString()).toBe("%PDF-");
    }
    expect(await snapshot(erin.id)).toBe(before);
    expect((await call(frank.jar, "GET", "/api/modules/spot-the-trap/report")).status).toBe(409);
    expect((await call(null, "GET", "/api/modules/spot-the-trap/report")).status).toBe(401);
    expect((await call(erin.jar, "GET", "/api/modules/trust-under-pressure/report")).status).toBe(409);
    expect((await call(erin.jar, "GET", "/api/modules/nope/report")).status).toBe(404);
  });

  it("validates the email request body before anything is sent", async () => {
    const bad = await call(erin.jar, "POST", "/api/certificates/spot-the-trap/email", {
      email: "not-an-email",
      requestId: randomUUID(),
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error.fields.email).toBeTruthy();
    const extra = await call(erin.jar, "POST", "/api/certificates/spot-the-trap/email", {
      email: "a@example.com",
      requestId: randomUUID(),
      displayName: "Mallory",
    });
    expect(extra.status).toBe(400);
    const notMine = await call(frank.jar, "POST", "/api/certificates/spot-the-trap/email", {
      email: "a@example.com",
      requestId: randomUUID(),
    });
    expect(notMine.status).toBe(409);
  });

  it("deduplicates and rate-limits email requests in the database", async () => {
    const cert = (await admin.from("certificates").select("id").eq("user_id", erin.id).single()).data!
      .id as string;
    const begin = (key: string, to = "erin@example.com") =>
      admin.rpc("begin_certificate_email_request", {
        p_user_id: erin.id,
        p_certificate_id: cert,
        p_recipient_email: to,
        p_idempotency_key: key,
      });
    const k1 = randomUUID();
    const first = await begin(k1);
    expect(first.data.outcome).toBe("created");
    expect((await begin(k1)).data.outcome).toBe("existing"); // network retry
    expect((await begin(randomUUID())).data.outcome).toBe("in_flight"); // concurrent click
    const fin = await admin.rpc("finish_certificate_email_request", {
      p_user_id: erin.id,
      p_request_id: first.data.request.id,
      p_status: "SUBMITTED",
      p_http_status: 200,
      p_error_code: null,
    });
    expect(fin.data.status).toBe("SUBMITTED");
    const again = await admin.rpc("finish_certificate_email_request", {
      p_user_id: erin.id,
      p_request_id: first.data.request.id,
      p_status: "FAILED",
      p_http_status: 500,
      p_error_code: "x",
    });
    expect(again.data.status).toBe("SUBMITTED"); // final
    expect((await begin(randomUUID())).data.outcome).toBe("duplicate"); // same address within 30 s
    // A different address is an intentional new send; then the hourly cap applies.
    const outcomes: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await begin(randomUUID(), `other${i}@example.com`);
      outcomes.push(r.data.outcome);
      if (r.data.outcome === "created")
        await admin.rpc("finish_certificate_email_request", {
          p_user_id: erin.id,
          p_request_id: r.data.request.id,
          p_status: "FAILED",
          p_http_status: null,
          p_error_code: "network",
        });
    }
    expect(outcomes.filter((o) => o === "created")).toHaveLength(4); // 5 per certificate per hour
    expect(outcomes.at(-1)).toBe("rate_limited");
    // Another user's certificate can't be used.
    const foreign = await admin.rpc("begin_certificate_email_request", {
      p_user_id: frank.id,
      p_certificate_id: cert,
      p_recipient_email: "f@example.com",
      p_idempotency_key: randomUUID(),
    });
    expect(foreign.error?.message).toBe("certificate_not_found");
    // The owner sees their requests; others don't.
    expect((await erin.client.from("certificate_email_requests").select("id")).data!.length).toBeGreaterThan(
      0,
    );
    expect((await frank.client.from("certificate_email_requests").select("id")).data).toEqual([]);
  });

  it("keeps certificate PDFs private and signed links short-lived", async () => {
    const path = `it-${RUN}/v1/test.pdf`;
    const pdf = Buffer.from("%PDF-1.4\n%%EOF\n");
    const up = await admin.storage
      .from("certificate-pdfs")
      .upload(path, pdf, { contentType: "application/pdf" });
    expect(up.error).toBeNull();
    // Not public, not readable by a signed-in learner.
    const pub = await fetch(`${URL_}/storage/v1/object/public/certificate-pdfs/${path}`);
    expect(pub.ok).toBe(false);
    const asUser = await erin.client.storage.from("certificate-pdfs").download(path);
    expect(asUser.error).not.toBeNull();
    // A signed link works without any session, with the right type and file name, until it expires.
    const signed = await admin.storage
      .from("certificate-pdfs")
      // 10 s: long enough to absorb request latency and ~1 s of clock skew with Supabase, short enough to wait out.
      .createSignedUrl(path, 10, { download: "ScamSense-Certificate-test.pdf" });
    const ok = await fetch(signed.data!.signedUrl);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(ok.headers.get("content-disposition") ?? "").toContain("ScamSense-Certificate-test.pdf");
    await new Promise((r) => setTimeout(r, 13_000));
    const expired = await fetch(signed.data!.signedUrl);
    expect(expired.ok).toBe(false);
    await admin.storage.from("certificate-pdfs").remove([path]);
  });

  it.skipIf(!LIVE_EMAIL)("sends ONE real certificate email through Zapier (opt-in)", async () => {
    // A fresh learner, so the earlier rate-limit test can't interfere.
    const gina = await user("gina", "Gina Example");
    await admin.rpc("start_module_run", {
      p_user_id: gina.id,
      p_module_key: "spot-the-trap",
      p_currency: "USD",
      p_starting_funds_minor: 300_000,
    });
    await complete(gina.id, "m1-s1", 90);
    await complete(gina.id, "m1-s2", 85);
    const r = await call(gina.jar, "POST", "/api/certificates/spot-the-trap/email", {
      email: LIVE_EMAIL,
      requestId: randomUUID(),
    });
    expect(r.status).toBe(200);
    expect(r.json.email.status).toBe("submitted");
    expect(JSON.stringify(r.json)).not.toMatch(/https?:\/\/|token=/); // no signed URL reaches the browser
    console.info("[step 11] Zapier accepted the request. Check the inbox for the PDF attachment.");
  });
});
