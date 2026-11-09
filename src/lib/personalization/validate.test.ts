import { describe, expect, it } from "vitest";
import { SCENARIO_KEYS, type ScenarioKey } from "@/content/modules";
import { JUDGMENT_PATTERNS } from "@/content/scenarios/neutrality";
import { SCENARIO_RENDERS, collectAnchors } from "@/content/scenarios/renders";
import { SCENARIO_TEMPLATES } from "@/content/scenarios/templates.server";
import { buildClientView } from "@/lib/scenario/view";
import { checkIntroLine, INTRO_RULES } from "./intro";
import { authoredDomainLabels, validatePersonalization, validateSlotValue } from "./validate";

/** Plausible validated outputs for two different learners (student saving for a laptop / freelance digital artist). */
const SAMPLES: Record<ScenarioKey, { student: Record<string, string>; artist: Record<string, string> }> = {
  "m1-s1": {
    student: {
      friendName: "Leila",
      friendMessage: "Are we still meeting at the library to finish the group project?",
      friendReply: "Yes, see you there after class!",
      recentMerchant: "Campus Bookstore",
    },
    artist: {
      friendName: "Theo",
      friendMessage: "Loved the character sketches you sent over this morning!",
      friendReply: "Thank you! Final colours coming tomorrow.",
      recentMerchant: "Brushwork Art Supplies",
    },
  },
  "m1-s2": {
    student: {
      otherSenderName: "Westbrook College Library",
      otherDomain: "westbrook-college",
      otherSubject: "Your study room booking is confirmed",
      otherPreview: "Room C is reserved for your group on Thursday…",
      otherBody: "Room C is reserved for your group on Thursday afternoon. Enjoy your study session!",
      incomeLabel: "Campus job",
    },
    artist: {
      otherSenderName: "Northside Illustrators Guild",
      otherDomain: "illustrators-guild",
      otherSubject: "New prompts for this month's sketch challenge",
      otherPreview: "This month's theme is quiet city mornings…",
      otherBody: "This month's theme is quiet city mornings. Share your favourite piece with the group!",
      incomeLabel: "Client transfer – Aria Studio",
    },
  },
  "m2-s1": {
    student: {
      workspaceName: "Coursework and thesis drafts",
      otherSenderName: "Quad Corner Cafe",
      otherDomain: "quadcorner",
      otherSubject: "Your order is ready at the counter",
      otherPreview: "A chai latte and a muffin, ready to go…",
      otherBody: "A chai latte and a muffin, ready to go.",
    },
    artist: {
      workspaceName: "Client artwork and project files",
      otherSenderName: "Palette and Paper",
      otherDomain: "paletteandpaper",
      otherSubject: "Your sketchbook order is ready for pickup",
      otherPreview: "Your new sketchbook is waiting at the counter…",
      otherBody: "Your new sketchbook is waiting at the counter.",
    },
  },
  "m2-s2": {
    student: { laptopUse: "coursework and online lectures" },
    artist: { laptopUse: "digital illustration and client calls" },
  },
  "m3-s1": {
    student: {
      jobTitle: "Remote Student Support Assistant",
      otherSenderName: "Westbrook Careers Office",
      otherDomain: "westbrook-careers",
      otherSubject: "Résumé workshop this Friday",
      otherPreview: "Bring a draft of your résumé to our workshop…",
      otherBody: "Bring a draft of your résumé to our workshop this Friday. Coffee is on us!",
    },
    artist: {
      jobTitle: "Remote Creative Operations Coordinator",
      otherSenderName: "Canvas Collective",
      otherDomain: "canvas-collective",
      otherSubject: "Open studio night next week",
      otherPreview: "Join us for an open studio night…",
      otherBody: "Join us for an open studio night next week and bring a piece you're proud of.",
    },
  },
  "m3-s2": {
    student: { itemName: "compact camera with spare lens", earlierBuyerName: "Nadia Brooks" },
    artist: { itemName: "mirrorless camera for product photos", earlierBuyerName: "Owen Carter" },
  },
};

const run = { currency: "USD", startingFundsMinor: 300_000 };
const attempt = (key: ScenarioKey) => ({
  id: "00000000-0000-4000-8000-000000000001",
  scenarioKey: key,
  attemptNumber: 1,
  isPractice: false,
  state: "ACTIVE" as const,
  pendingDecisionId: null,
  decisionId: null,
  justification: null,
});

const view = (key: ScenarioKey, slots?: Record<string, string>) =>
  buildClientView({
    attempt: attempt(key),
    events: [],
    run,
    displayName: "Sam Rivera",
    personalization: slots ? { slots, source: "gemini" } : null,
  });

/** Everything in a render that isn't narrative: structure, ids, anchors, decisions, actions, amounts. */
function skeleton(v: ReturnType<typeof view>) {
  const r = v.render;
  const money = JSON.stringify(r).match(/US\$[\d,]+(\.\d\d)?|\$[\d,]+(\.\d\d)?/g) ?? [];
  return {
    interfaceType: r.interfaceType,
    apps: r.apps.map((a) => [a.type, a.id]),
    anchors: collectAnchors(r.apps).sort(),
    actions: r.actions.map((a) => [a.id, a.kind, a.requires ?? []]),
    // Decision summaries may mention a personalized item name; ids, kinds, intents, and gating may not change.
    decisions: r.decisions.map((d) => [d.id, d.kind, d.intent, d.requires ?? []]),
    checkout: r.checkout,
    money: money.sort(),
  };
}

describe("personalization of all six scenarios (Step 8 brief §8–§10, §25)", () => {
  it("every scenario declares narrative slots", () => {
    for (const key of SCENARIO_KEYS) expect(SCENARIO_RENDERS[key].slots.length, key).toBeGreaterThan(0);
  });

  it.each(SCENARIO_KEYS)("%s: two profiles get different narratives with identical ground truth", (key) => {
    const render = SCENARIO_RENDERS[key];
    const template = SCENARIO_TEMPLATES[key];
    const results = (["student", "artist"] as const).map((who) => {
      const v = validatePersonalization(render, { slots: SAMPLES[key][who] });
      expect(v.rejected, `${key}/${who}: ${v.rejected.join(",")}`).toEqual([]);
      return view(key, v.slots);
    });
    const authored = view(key);

    // The narrative really changes, and differs between the two learners.
    expect(JSON.stringify(results[0]!.render)).not.toBe(JSON.stringify(authored.render));
    expect(JSON.stringify(results[0]!.render)).not.toBe(JSON.stringify(results[1]!.render));

    for (const v of results) {
      // Same interface, apps, anchors, actions, decisions, checkout, and amounts as the authored scenario.
      expect(skeleton(v)).toEqual(skeleton(authored));
      // Every evidence target is still present.
      const anchors = collectAnchors(v.render.apps);
      for (const e of template.evidenceDefinitions)
        expect(anchors, e.evidenceId).toContain(e.targetElementId);
      // No hints or judgments, and nothing from the answer key in the payload.
      const json = JSON.stringify(v);
      // Player-facing story text (the module key "outsmart-the-scam" is an internal id, not shown text).
      const shown = JSON.stringify({ intro: v.introLine, render: v.render });
      for (const re of JUDGMENT_PATTERNS) expect(shown).not.toMatch(re);
      for (const e of template.evidenceDefinitions) expect(json).not.toContain(e.evidenceId);
      expect(json).not.toContain(template.fixedScamStatus);
      expect(v.personalized).toBe(true);
    }
  });

  it("an authored-default (fallback) view is not labelled as personalized", () => {
    expect(view("m1-s1").personalized).toBe(false);
  });
});

describe("generated values are validated", () => {
  const render = SCENARIO_RENDERS["m1-s2"];
  const labels = authoredDomainLabels(render);
  const slot = (name: string) => render.slots.find((s) => s.name === name)!;

  it("collects the scenario's own domains (including the required look-alike)", () => {
    expect(labels).toEqual(expect.arrayContaining(["spasebank", "spacebank"]));
  });

  it.each([
    ["otherBody", "Your account was suspended, verify your login now."],
    ["otherBody", "This is a scam, be careful!"],
    ["otherBody", "Your balance is $500."],
    ["otherBody", "Visit https://westbrook.example for details."],
    ["otherBody", "Pay the fee with PayPal today."],
    ["otherSenderName", "Space Bank Security Team"],
    ["otherSenderName", "Chase"],
    ["otherSenderName", "R2-D2 Fan Club 2025"],
    ["otherDomain", "spacebank-alerts"],
    ["otherDomain", "Westbrook College"],
    ["otherDomain", "paypal-help"],
    ["otherSubject", "x".repeat(61)],
    ["otherSubject", "Line one\nLine two"],
  ])("rejects %s = %j", (name, value) => {
    expect(validateSlotValue(slot(name), value, labels)).toBeNull();
  });

  it("falls back per slot and drops unknown keys", () => {
    const v = validatePersonalization(render, {
      slots: { ...SAMPLES["m1-s2"].student, otherDomain: "spasebank", injected: "<script>" },
    });
    expect(v.slots.otherDomain).toBeUndefined();
    expect(v.slots).not.toHaveProperty("injected");
    expect(v.rejected).toEqual(["otherDomain"]);
    expect(v.slots.otherSubject).toBe(SAMPLES["m1-s2"].student.otherSubject);
  });

  it("shows a validated personalized intro instead of the authored one", () => {
    const v = buildClientView({
      attempt: attempt("m2-s2"),
      events: [],
      run,
      displayName: "Sam",
      personalization: {
        slots: SAMPLES["m2-s2"].student,
        introLine: "You're browsing an online marketplace for a laptop for your coursework.",
        source: "gemini",
      },
    });
    expect(v.introLine).toBe("You're browsing an online marketplace for a laptop for your coursework.");
  });
});

describe("personalized neutral intros (owner decision 13)", () => {
  const ok = (key: ScenarioKey, intro: string, slots: Record<string, string> = {}) =>
    checkIntroLine(SCENARIO_RENDERS[key], intro, slots);

  it.each([
    ["m1-s1", "You receive a text message about your TandemPay account while sketching for a client."],
    ["m1-s2", "You receive an email notification about your Space Bank account between classes."],
    ["m2-s1", "A new invoice from Brightline Cloud has arrived in your inbox for your coursework storage."],
    ["m2-s2", "You're browsing an online marketplace for a laptop for your digital art."],
    ["m3-s1", "You've received an update about a remote job opportunity after your recent application."],
    ["m3-s2", "A buyer has messaged you about the compact camera you listed for sale."],
  ] as const)("accepts an accurate, neutral intro for %s", (key, intro) => {
    expect(ok(key, intro, SAMPLES[key].student)).toEqual({ ok: true, value: intro });
  });

  it.each([
    ["m2-s2", "You found a laptop from a local seller that fits your budget.", "wrong_setting"],
    ["m2-s2", "You're looking at a laptop that fits your budget.", "missing_setting"],
    ["m1-s1", "You receive an email about your payment account.", "wrong_setting"],
    ["m1-s2", "You receive a text message about your bank account.", "wrong_setting"],
    ["m3-s2", "You bought a camera from a buyer on an online listing.", "wrong_setting"],
    ["m2-s1", "A suspicious invoice has arrived in your inbox.", "spoiler"],
    ["m3-s1", "You've received a job offer that asks for an equipment deposit.", "spoiler"],
    ["m1-s1", "You receive a text message asking for your code about your account.", "spoiler"],
    ["m1-s2", "You should check this email about your bank account.", "spoiler"],
    ["m2-s2", "You're browsing an online marketplace for a laptop on Amazon.", "real_brand"],
    ["m2-s2", "You're browsing an online marketplace for a laptop from Zephyr Electronics.", "unknown_name"],
    ["m2-s1", "A new invoice for $300 has arrived in your inbox.", "digits_or_links"],
    ["m3-s1", "Great news! You've received a job offer.", "shape"],
    ["m3-s1", "You've received a job offer. It looks exciting.", "shape"],
  ] as const)("rejects %s: %j (%s)", (key, intro, reason) => {
    expect(ok(key, intro)).toEqual({ ok: false, reason });
  });

  it("allows names from the personalized details and rejects invented ones", () => {
    const intro = "You receive a text message about your TandemPay account after chatting with Leila.";
    expect(ok("m1-s1", intro, { friendName: "Leila" }).ok).toBe(true);
    expect(ok("m1-s1", intro, { friendName: "Theo" })).toEqual({ ok: false, reason: "unknown_name" });
  });

  it("falls back to the authored intro when the generated one is rejected", () => {
    const v = validatePersonalization(SCENARIO_RENDERS["m2-s2"], {
      slots: SAMPLES["m2-s2"].student,
      introLine: "You found a laptop from a local seller.",
    });
    expect(v).toMatchObject({ introLine: null, introRejection: "wrong_setting" });
    expect(v.rejected).toContain("introLine");
    expect(v.slots).toEqual(SAMPLES["m2-s2"].student); // slots unaffected
  });

  it("every scenario has authoritative intro facts that never state the truth", () => {
    for (const key of SCENARIO_KEYS) {
      expect(INTRO_RULES[key].facts.length).toBeGreaterThan(40);
      for (const re of JUDGMENT_PATTERNS) expect(INTRO_RULES[key].facts).not.toMatch(re);
    }
  });
});
