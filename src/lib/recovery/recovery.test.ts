/**
 * Your Recovery Playbook (Step 9): the policy knowledge base never carries unverified facts, the scenario → policy
 * mapping is deterministic, no authored text invents deadlines or refund promises, Gemini output is rejected when it
 * touches policy, and Gemini is called at most once per completed attempt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DISTINCTIONS } from "@/content/playbook/distinctions";
import { POLICY_RECORDS, getPolicy, policyItems } from "@/content/playbook/policies";
import { SCENARIO_PLAYBOOKS } from "@/content/playbook/scenarios.server";
import { SCENARIO_KEYS, type ScenarioKey } from "@/content/modules";
import { SCENARIO_TEMPLATES } from "@/content/scenarios/templates.server";
import { resetRateLimits, setGeminiDepsForTests, type GeminiDeps } from "@/lib/ai/gemini";
import { getUsageSnapshot, resetUsage } from "@/lib/ai/usage";
import { createFakeDb, fakeClient, type FakeDb } from "@/lib/testing/fakeSupabase";
import { buildPlaybookView, selectPolicyIds } from "./playbook";
import { buildPlaybookPrompt } from "./prompt";
import { parsePlaybookNote, playbookJsonSchema } from "./schema";

let db: FakeDb;
vi.mock("@/lib/supabase/admin", () => ({
  getTrustedWriter: () => fakeClient(db),
  TrustedWriterNotConfiguredError: class extends Error {},
}));
const loadAttemptMock = vi.fn();
vi.mock("@/lib/scenario/server", () => ({
  loadAttempt: (...a: unknown[]) => loadAttemptMock(...a),
  attemptFunctionError: (e: { message?: string }) => new Error(e.message),
}));
const { personalizePlaybook, loadPlaybook } = await import("./server");
const { NotCompletedError } = await import("@/lib/review/server");

const KEYS = SCENARIO_KEYS as readonly ScenarioKey[];
const USER = "11111111-1111-4111-8111-111111111111";
const MOD = { key: "m", title: "M", order: 1 };

function view(key: ScenarioKey, opts: { appropriate?: boolean; paid?: boolean } = {}) {
  const t = SCENARIO_TEMPLATES[key];
  const decisionId =
    opts.appropriate === false
      ? t.render.decisions.find((d) => !t.evaluationRubric.correctDecisionIds.includes(d.id))!.id
      : t.evaluationRubric.correctDecisionIds[0]!;
  return buildPlaybookView({
    attemptId: "a1",
    template: t,
    guide: SCENARIO_PLAYBOOKS[key],
    module: MOD,
    attemptNumber: 1,
    outcome: {
      decisionId,
      appropriate: opts.appropriate ?? true,
      paid: !!opts.paid,
      amountText: opts.paid ? "$300.00" : null,
      isPractice: false,
    },
  });
}

/* ------------------------------------------------------------------------------------------------ knowledge base */

describe("policy knowledge base", () => {
  it("only official U.S. PayPal URLs, unique stable ids, no fabricated effective dates", () => {
    const ids = POLICY_RECORDS.map((p) => p.policyId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of POLICY_RECORDS) {
      expect(p.sourceUrl.startsWith("https://www.paypal.com/us/")).toBe(true);
      expect(p.jurisdiction).toBe("US");
      expect(p.effectiveDate).toBeNull(); // none of the pages read printed an effective date
    }
    // The "Last updated" dates the legal pages print (2026-11-10 check).
    expect(getPolicy("purchase-protection")!.pageUpdated).toBe("2026-01-26");
    expect(getPolicy("seller-protection")!.pageUpdated).toBe("2026-01-26");
    expect(getPolicy("user-agreement")!.pageUpdated).toBe("2026-11-04");
  });

  it("verified records have a verification date and facts; unverified ones carry NO policy content", () => {
    for (const p of POLICY_RECORDS) {
      if (p.verificationStatus === "verified") {
        expect(p.lastVerified).toBe("2026-11-10");
        expect(p.factualSummary.length).toBeGreaterThan(0);
      } else {
        expect(p.lastVerified).toBeNull();
        expect(policyItems(p)).toEqual([]);
      }
    }
    // 2026-11-10: every official source loaded and was read; nothing is left as a 403 placeholder.
    expect(POLICY_RECORDS.filter((p) => p.verificationStatus !== "verified")).toEqual([]);
    expect(POLICY_RECORDS.map((p) => p.policyId).sort()).toEqual([
      "dispute-filing-timeframes",
      "purchase-protection",
      "purchase-protection-help",
      "report-fraud",
      "report-suspicious-messages",
      "report-unauthorized-help",
      "seller-protection",
      "seller-protection-help",
      "user-agreement",
    ]);
  });

  it("keeps the key policy distinctions as verified facts", () => {
    const text = (id: string, item: string) =>
      policyItems(getPolicy(id)!).find((i) => i.id === item)?.text ?? "";
    // authorized vs unauthorized
    expect(text("user-agreement", "definition")).toMatch(/did not authorize and that did not benefit you/);
    expect(text("purchase-protection", "unauthorized_is_different")).toMatch(
      /different from the Purchase Protection/,
    );
    // purchase vs seller eligibility
    expect(text("purchase-protection", "good_standing")).toBe("Have a PayPal account in good standing.");
    expect(text("seller-protection", "us_address")).toMatch(/United States/);
    expect(text("seller-protection", "redirected")).toMatch(/redirected to a different address/);
    // possible, not guaranteed
    expect(text("purchase-protection", "may_cover")).toMatch(/may result in coverage/);
    expect(text("purchase-protection", "sole_discretion")).toMatch(/sole discretion/);
    expect(text("seller-protection", "may_retain")).toMatch(/may result in you retaining/);
    // Friends and Family is excluded from both programs
    expect(text("purchase-protection", "friends_family")).toMatch(/friends and family/i);
    expect(text("seller-protection", "personal_payments")).toMatch(/friends and family/i);
    // timeframes, verbatim
    expect(text("dispute-filing-timeframes", "inr_180")).toMatch(
      /within 180 days of the date you sent the payment/,
    );
    expect(text("dispute-filing-timeframes", "snad_30_180")).toMatch(/within 30 days .* whichever is sooner/);
  });

  it("no record promises an outcome outside PayPal's own conditional wording", () => {
    for (const p of POLICY_RECORDS)
      for (const i of policyItems(p))
        expect(i.text, `${p.policyId}/${i.id}`).not.toMatch(
          /guaranteed refund|will always|you are covered\b/i,
        );
  });

  it("covers every required topic with an official source (Purchase and Seller Protection included)", () => {
    const topics = new Set(POLICY_RECORDS.map((p) => p.topic));
    for (const t of [
      "account_security_phishing",
      "unauthorized_transactions",
      "purchase_protection",
      "seller_protection",
      "disputes_resolution_center",
    ])
      expect(topics).toContain(t);
  });
});

/* ------------------------------------------------------------------------------------------------ mapping */

describe("deterministic scenario → policy mapping", () => {
  it.each(KEYS)("%s: every referenced policy exists, every PayPal step is a verified fact", (key) => {
    const g = SCENARIO_PLAYBOOKS[key];
    expect(g).toBeDefined();
    for (const id of [...g.policies.core, ...g.policies.whenPaid, ...g.policies.whenAffected])
      expect(getPolicy(id), `${key}: ${id}`).toBeDefined();
    for (const s of g.steps)
      if (s.kind === "paypal") {
        const p = getPolicy(s.policyId)!;
        expect(p.verificationStatus).toBe("verified");
        expect(policyItems(p).map((f) => f.id)).toContain(s.factId);
      }
    const v = view(key);
    expect(v.steps).toHaveLength(g.steps.length); // nothing dropped
    for (const s of v.steps.filter((x) => x.kind === "paypal"))
      expect(s.source?.lastVerified).toBe("2026-11-10");
  });

  it("selects policies from the outcome: seller vs buyer, paid, and affected", () => {
    expect(selectPolicyIds(SCENARIO_PLAYBOOKS["m3-s2"], { appropriate: true, paid: false })).toContain(
      "seller-protection",
    );
    expect(selectPolicyIds(SCENARIO_PLAYBOOKS["m3-s2"], { appropriate: true, paid: false })).not.toContain(
      "purchase-protection",
    );
    expect(selectPolicyIds(SCENARIO_PLAYBOOKS["m2-s2"], { appropriate: true, paid: true })).toContain(
      "purchase-protection",
    );
    expect(selectPolicyIds(SCENARIO_PLAYBOOKS["m2-s1"], { appropriate: true, paid: false })).not.toContain(
      "dispute-filing-timeframes",
    );
    expect(selectPolicyIds(SCENARIO_PLAYBOOKS["m2-s1"], { appropriate: false, paid: true })).toContain(
      "dispute-filing-timeframes",
    );
    expect(selectPolicyIds(SCENARIO_PLAYBOOKS["m1-s1"], { appropriate: false, paid: false })).toContain(
      "report-unauthorized-help",
    );
    // Same input → same output (no randomness, no AI).
    expect(selectPolicyIds(SCENARIO_PLAYBOOKS["m3-s1"], { appropriate: false, paid: true })).toEqual(
      selectPolicyIds(SCENARIO_PLAYBOOKS["m3-s1"], { appropriate: false, paid: true }),
    );
  });

  it("legitimate purchase guidance never implies the seller committed fraud", () => {
    const v = view("m2-s2");
    expect(v.whatHappened.scamStatus).toBe("legitimate");
    expect(v.limitations.map((l) => l.id)).toContain("legit_problem_not_fraud");
    const text = JSON.stringify([v.steps, v.whatHappened.framing, v.howPayPalMayHelp]).toLowerCase();
    expect(text).not.toMatch(/scam|fraudster|scammer/);
  });

  it("keeps the critical distinctions where they apply", () => {
    for (const k of ["m1-s1", "m2-s1", "m3-s1"] as const)
      expect(view(k).limitations.map((l) => l.id)).toContain("authorized_vs_unauthorized");
    expect(view("m3-s2").limitations.map((l) => l.id)).toEqual(
      expect.arrayContaining(["seller_payment_proof", "protection_not_guarantee"]),
    );
    expect(view("m1-s2").limitations.map((l) => l.id)).toContain("report_message_vs_transaction");
    for (const k of ["m2-s1", "m2-s2", "m3-s1"] as const)
      expect(view(k).limitations.map((l) => l.id)).toContain("sandbox_not_coverage");
    // Non-payment scenarios never mention Sandbox coverage.
    expect(view("m1-s1").limitations.map((l) => l.id)).not.toContain("sandbox_not_coverage");
    for (const k of KEYS) expect(view(k).limitations.map((l) => l.id)).toContain("educational_not_case");
  });

  it("no authored text invents deadlines, refund promises, statistics, or guarantees", () => {
    const authored = JSON.stringify([SCENARIO_PLAYBOOKS, DISTINCTIONS]);
    expect(authored).not.toMatch(/\d+\s*(business\s+)?(days?|hours?|weeks?|months?)/i);
    expect(authored).not.toMatch(
      /will (be )?refund|guaranteed refund|will reimburse|always (get|receive)|\d+\s?%/i,
    );
    expect(authored).not.toMatch(/you are (eligible|covered|entitled)|is covered by/i);
  });

  it("each outcome frames 'what happened' appropriately", () => {
    const ok = view("m2-s1", { appropriate: true });
    const bad = view("m2-s1", { appropriate: false, paid: true });
    expect(ok.whatHappened.framing).not.toBe(bad.whatHappened.framing);
    expect(bad.whatHappened.payment?.amountText).toBe("$300.00");
    expect(ok.whatHappened.payment).toBeNull();
  });
});

/* ------------------------------------------------------------------------------------------------ Gemini output */

const stepIds = () => view("m3-s2").steps.map((s) => s.id);
const good = (over: Record<string, unknown> = {}) => ({
  scenarioId: "m3-s2",
  note: "Holding the order until you could see the money yourself was a calm, smart move. That habit is your best defence as a seller.",
  emphasisStepIds: ["sign_in_check", "made_up_step"],
  ...over,
});

describe("Gemini note validation", () => {
  it("accepts a grounded note and drops unknown step ids", () => {
    expect(parsePlaybookNote(good(), { scenarioKey: "m3-s2", stepIds: stepIds() })).toEqual({
      note: good().note,
      emphasisStepIds: ["sign_in_check"],
    });
  });

  it.each([
    "PayPal Seller Protection will cover you if you ship to the right address, so you're fine.",
    "You can open a dispute and get a refund if this ever happens to you in real life again.",
    "You have one hundred and eighty days to report this, so don't wait too long to act on it.",
    "Report it within 3 days, and forward the message to phishing at the official address now.",
    "Visit www.example.com for more details about what to do next time with a buyer like this.",
    "Most people fall for this one, so don't feel bad about it at all — you did your very best.",
    "That was a gullible move, but you'll learn from it next time with practice and patience.",
    "You're eligible for reimbursement because the buyer lied to you about having paid already.",
  ])("rejects policy, deadlines, links, statistics, or mocking: %s", (note) => {
    expect(() => parsePlaybookNote(good({ note }), { scenarioKey: "m3-s2", stepIds: stepIds() })).toThrow();
  });

  it("rejects the wrong scenario or no valid step", () => {
    expect(() =>
      parsePlaybookNote(good({ scenarioId: "m1-s1" }), { scenarioKey: "m3-s2", stepIds: stepIds() }),
    ).toThrow();
    expect(() =>
      parsePlaybookNote(good({ emphasisStepIds: ["nope"] }), { scenarioKey: "m3-s2", stepIds: stepIds() }),
    ).toThrow();
  });

  it("constrains step ids in the JSON schema and sends no personal data in the prompt", () => {
    expect(JSON.stringify(playbookJsonSchema("m3-s2", stepIds()))).toContain("sign_in_check");
    const prompt = buildPlaybookPrompt(view("m3-s2"));
    expect(prompt).toContain("sign_in_check");
    expect(prompt).not.toMatch(/@example\.com|justification|income/i);
  });
});

/* ------------------------------------------------------------------------------------------------ service */

function gemini(reply: unknown | "fail" | null) {
  if (reply === null) return setGeminiDepsForTests(null);
  const deps: GeminiDeps = {
    model: "test-model",
    requestTimeoutMs: 5_000,
    now: () => Date.now(),
    random: () => 0.5,
    sleep: async () => {},
    generate: async () => {
      if (reply === "fail") throw Object.assign(new Error("unavailable"), { status: 503 });
      return { text: JSON.stringify(reply), finishReason: "STOP", inputTokens: 300, outputTokens: 80 };
    },
  };
  setGeminiDepsForTests(deps);
}

function attempt(state = "COMPLETED", decisionId = "hold_order") {
  return {
    attempt: {
      id: "a1",
      scenarioKey: "m3-s2",
      attemptNumber: 1,
      isPractice: false,
      state,
      pendingDecisionId: null,
      decisionId,
      justification: "I checked the order status in the seller hub before shipping anything.",
    },
    events: [],
    run: { currency: "USD", startingFundsMinor: 300_000 },
    payments: [],
    personalization: null,
  };
}

function rpcs() {
  const rows = (db.tables.attempt_recovery_playbooks ??= []);
  db.rpc.claim_recovery_playbook = (a) => {
    const r = rows.find((x) => x.attempt_id === a.p_attempt_id);
    if (r) return { data: r.status === "ready" ? "ready" : "busy" };
    rows.push({
      attempt_id: a.p_attempt_id,
      user_id: a.p_user_id,
      status: "pending",
      source: null,
      note: null,
      emphasis_step_ids: [],
    });
    return { data: "claimed" };
  };
  db.rpc.complete_recovery_playbook = (a) => {
    const r = rows.find((x) => x.attempt_id === a.p_attempt_id)!;
    Object.assign(r, {
      status: "ready",
      source: a.p_source,
      note: a.p_note,
      emphasis_step_ids: a.p_emphasis_step_ids,
    });
    return { data: "ready" };
  };
}

const recoveryRequests = () => getUsageSnapshot().categories.recovery.requests;
const supabase = () => fakeClient(db) as never;
const decisionM3S2 = () => SCENARIO_TEMPLATES["m3-s2"].evaluationRubric.correctDecisionIds[0]!;

describe("Playbook personalization request counts", () => {
  beforeEach(() => {
    db = createFakeDb();
    resetUsage();
    resetRateLimits();
    loadAttemptMock.mockReset();
    loadAttemptMock.mockResolvedValue(attempt("COMPLETED", decisionM3S2()));
  });
  afterEach(() => setGeminiDepsForTests(undefined));

  it("one Gemini call for the first visit, zero for every revisit", async () => {
    rpcs();
    gemini(good());
    const first = await personalizePlaybook(supabase(), USER, "a1");
    expect(first).toMatchObject({ status: "ready", source: "gemini" });
    expect(recoveryRequests()).toBe(1);
    await personalizePlaybook(supabase(), USER, "a1");
    const again = await loadPlaybook(supabase(), USER, "a1");
    expect(again.note).toMatchObject({ status: "ready", source: "gemini" });
    expect(recoveryRequests()).toBe(1);
    expect(db.tables.attempt_recovery_playbooks).toHaveLength(1);
  });

  it("a concurrent generation answers pending without calling Gemini", async () => {
    rpcs();
    gemini(good());
    db.tables.attempt_recovery_playbooks!.push({ attempt_id: "a1", user_id: USER, status: "pending" });
    expect(await personalizePlaybook(supabase(), USER, "a1")).toEqual({ status: "pending" });
    expect(recoveryRequests()).toBe(0);
  });

  it("invalid (policy-making) output → stored fallback; the authored Playbook is unchanged", async () => {
    rpcs();
    gemini(
      good({ note: "PayPal Seller Protection guarantees you a refund within ten days, no matter what." }),
    );
    const before = (await loadPlaybook(supabase(), USER, "a1")).playbook;
    const r = await personalizePlaybook(supabase(), USER, "a1");
    expect(r).toEqual({ status: "ready", source: "fallback" });
    expect(db.tables.attempt_recovery_playbooks![0]).toMatchObject({ source: "fallback", note: null });
    expect((await loadPlaybook(supabase(), USER, "a1")).playbook).toEqual(before);
  });

  it("Gemini down → fallback stored; Gemini not configured → no call, nothing stored", async () => {
    rpcs();
    gemini("fail");
    expect(await personalizePlaybook(supabase(), USER, "a1")).toEqual({
      status: "ready",
      source: "fallback",
    });
    db = createFakeDb();
    rpcs();
    gemini(null);
    expect(await personalizePlaybook(supabase(), USER, "a1")).toEqual({ status: "unavailable" });
    expect(db.calls.rpc).toEqual([]);
  });

  it("migration not applied → never calls Gemini", async () => {
    gemini(good());
    db.rpc.claim_recovery_playbook = () => ({ error: { code: "PGRST202", message: "function not found" } });
    expect(await personalizePlaybook(supabase(), USER, "a1")).toEqual({ status: "unavailable" });
    expect(recoveryRequests()).toBe(0);
  });

  it("unfinished attempts get no Playbook and no Gemini call", async () => {
    rpcs();
    gemini(good());
    loadAttemptMock.mockResolvedValue(attempt("FINALIZED", decisionM3S2()));
    await expect(personalizePlaybook(supabase(), USER, "a1")).rejects.toBeInstanceOf(NotCompletedError);
    await expect(loadPlaybook(supabase(), USER, "a1")).rejects.toBeInstanceOf(NotCompletedError);
    expect(recoveryRequests()).toBe(0);
    expect(db.calls.rpc).toEqual([]);
  });

  it("never touches attempts, scores, ledger, or payments (only the Playbook functions)", async () => {
    rpcs();
    gemini(good());
    await personalizePlaybook(supabase(), USER, "a1");
    expect(new Set(db.calls.rpc)).toEqual(new Set(["claim_recovery_playbook", "complete_recovery_playbook"]));
    expect(db.calls.upserts).toEqual([]);
  });
});
