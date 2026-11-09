import { describe, expect, it } from "vitest";
import { MODULES, SCENARIO_KEYS } from "@/content/modules";
import { FINANCIAL_ACTIVITY_VALUES, OCCUPATION_VALUES } from "@/content/profileOptions";
import { collectTokens } from "@/lib/scenario/tokens";
import { collectAnchors, SCENARIO_RENDERS } from "./renders";
import { SCENARIO_TEMPLATES, validateTemplateParts } from "./templates.server";
import {
  ACTIVITY_TAGS,
  authoredAnswerKeySchema,
  CONTEXT_TAGS,
  PROFILE_ACTIVITY_TAGS,
  PROFILE_CONTEXT_TAG,
  SCAM_CATEGORIES,
} from "./templateSchema";
import { INTERFACE_TYPES } from "./schema";

const templates = Object.values(SCENARIO_TEMPLATES);
const strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === "object") for (const x of Object.values(v)) strings(x, out);
  return out;
};

/** Words that would judge or hint during play (ARCHITECTURE §6). Checked against everything the player sees. */
const DENY = [
  /\bscam/i,
  /suspicious/i,
  /red flag/i,
  /\bfake\b/i,
  /fraud/i,
  /phishing/i,
  /\bwarning/i,
  /\bhint\b/i,
  /legit/i,
  /look-?alike/i,
  /spoof/i,
  /unfamiliar/i,
  /be careful/i,
  /genuine/i,
  /official/i,
];

/**
 * IDs reach the browser (anchors as data attributes, action/decision/message IDs in the payload), so they must
 * describe the element, never judge it (R10: no leaks through network payloads).
 */
const JUDGING_ID =
  /(official|genuine|real|fake|urgen|pressure|rush|claim|story|discourag|refus|generic|suspic|scam|fraud|(^|_)red(_|$)|flag|mismatch|lookalike|legit|unsafe|correct|wrong|trap)/;

function ids(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) for (const x of v) ids(x, out);
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if ((k === "id" || k.endsWith("Id") || k === "anchor" || k.endsWith("Anchor")) && typeof x === "string")
        out.push(x);
      else if (k.endsWith("Ids") && Array.isArray(x)) out.push(...(x as string[]));
      else ids(x, out);
    }
  }
  return out;
}

describe("scenario catalogue", () => {
  it("has exactly six templates: two per module, matching the slot configuration (R5, R6)", () => {
    expect(Object.keys(SCENARIO_TEMPLATES).sort()).toEqual([...SCENARIO_KEYS].sort());
    for (const m of MODULES) {
      expect(templates.filter((t) => t.moduleId === m.key)).toHaveLength(2);
      for (const t of templates.filter((x) => x.moduleId === m.key)) {
        expect(t.difficulty.moduleDifficulty).toBe(m.difficulty);
      }
    }
  });

  it("covers all five scam categories and includes at least one legitimate scenario (R17)", () => {
    const covered = new Set(templates.flatMap((t) => [t.primaryCategory, ...t.secondaryCategoryTags]));
    expect([...covered].sort()).toEqual([...SCAM_CATEGORIES].sort());
    expect(templates.filter((t) => t.fixedScamStatus === "legitimate").map((t) => t.scenarioId)).toEqual([
      "m2-s2",
    ]);
  });

  it("uses all four reusable environments, with the required environment per scenario", () => {
    expect(new Set(templates.map((t) => t.interfaceType))).toEqual(new Set(INTERFACE_TYPES));
    const types = Object.fromEntries(templates.map((t) => [t.scenarioId, t.interfaceType]));
    expect(types).toMatchObject({
      "m1-s1": "chat_email",
      "m1-s2": "web_browser",
      "m2-s1": "invoice",
      "m2-s2": "marketplace",
      "m3-s1": "chat_email",
      "m3-s2": "marketplace",
    });
    const apps = (k: keyof typeof SCENARIO_RENDERS) => SCENARIO_RENDERS[k].apps.map((a) => a.type);
    expect(apps("m1-s1")).toContain("messages");
    expect(apps("m1-s2")).toEqual(expect.arrayContaining(["mail", "browser"]));
    expect(apps("m2-s2")).toContain("marketplace");
    expect(apps("m3-s1")).toEqual(expect.arrayContaining(["mail", "messages"]));
    expect(apps("m3-s2")).toEqual(expect.arrayContaining(["seller_hub", "mail", "wallet"]));
  });

  it("uses the confirmed neutral introductions (R9)", () => {
    expect(Object.fromEntries(templates.map((t) => [t.scenarioId, t.neutralIntroduction]))).toEqual({
      "m1-s1": "You receive a message about your payment account.",
      "m1-s2": "You receive a notification about your account.",
      "m2-s1": "A new invoice has arrived in your inbox.",
      "m2-s2": "You've found a laptop that fits your budget.",
      "m3-s1": "You've received an update about a job opportunity.",
      "m3-s2": "A buyer has contacted you about an item you're selling.",
    });
  });

  it("every answer key passes its cross-checks against the render", () => {
    for (const t of templates) {
      expect(() =>
        validateTemplateParts(
          t.render,
          authoredAnswerKeySchema.parse({
            ...t,
            scenarioKey: t.scenarioId,
            difficulty: t.difficulty,
            verificationActions: t.evaluationRubric.verificationActions.map((v) => ({
              actionId: v.id,
              weight: v.weight,
            })),
            unsafeActionIds: t.evaluationRubric.unsafeActionIds,
            payableDecisionIds: t.paymentConfiguration.payableDecisionIds,
            paymentOutcome: t.paymentConfiguration.outcome,
          }),
        ),
      ).not.toThrow();
    }
  });

  it("has a fixed correct outcome and a complete rubric per scenario (R13)", () => {
    for (const t of templates) {
      expect(t.evaluationRubric.correctDecisionIds.length, t.scenarioId).toBeGreaterThan(0);
      expect(t.evaluationRubric.evidence.length, t.scenarioId).toBeGreaterThanOrEqual(5);
      expect(t.evaluationRubric.verificationActions.length, t.scenarioId).toBeGreaterThan(0);
      expect(t.decisionOptions.length, t.scenarioId).toBeGreaterThanOrEqual(3);
      for (const id of t.evaluationRubric.correctDecisionIds) expect(t.decisionOptions).toContain(id);
      // Evidence uses all three classifications across the catalogue, not just "red flag" (R16).
    }
    const types = new Set(templates.flatMap((t) => t.evidenceDefinitions.map((e) => e.evidenceType)));
    expect(types).toEqual(new Set(["red_flag", "worth_verifying", "positive_verification_evidence"]));
  });

  it("a scam scenario's correct decisions never pay or share; the legitimate one's correct decision is to buy", () => {
    for (const t of templates) {
      const payable = t.paymentConfiguration.payableDecisionIds;
      if (t.fixedScamStatus === "fraudulent") {
        for (const id of t.evaluationRubric.correctDecisionIds) expect(payable).not.toContain(id);
        expect(t.evaluationRubric.unsafeActionIds.length, t.scenarioId).toBeGreaterThan(0);
      } else {
        expect(t.evaluationRubric.correctDecisionIds).toEqual(payable);
        expect(t.paymentConfiguration.outcome).toBe("spending");
      }
    }
  });

  it("M2-S2 is the marketplace laptop purchase with a pay decision for the Sandbox checkout (R12)", () => {
    const t = SCENARIO_TEMPLATES["m2-s2"];
    expect(t.paymentConfiguration.payableDecisionIds).toEqual(["place_order"]);
    expect(t.render.checkout).toBeDefined();
    const store = t.render.apps.find((a) => a.type === "marketplace");
    expect(store?.type === "marketplace" && store.checkout.decisionId).toBe("place_order");
  });

  it("evidence targets exist as anchors, and anchors outnumber evidence (anchors reveal nothing)", () => {
    for (const t of templates) {
      const anchors = collectAnchors(t.render.apps);
      for (const e of t.evidenceDefinitions)
        expect(anchors, `${t.scenarioId}/${e.evidenceId}`).toContain(e.targetElementId);
      expect(anchors.length, t.scenarioId).toBeGreaterThan(t.evidenceDefinitions.length);
    }
  });

  it("player-facing text contains no judgment words (R10)", () => {
    for (const t of templates) {
      const { scenarioKey, ...visible } = t.render;
      void scenarioKey;
      for (const s of strings(visible))
        for (const re of DENY) expect(s, `${t.scenarioId}: ${s}`).not.toMatch(re);
    }
  });

  it("IDs sent to the browser are neutral, and no evidence ID doubles as an anchor (R10)", () => {
    for (const t of templates) {
      for (const id of ids(t.render)) expect(id, `${t.scenarioId}: ${id}`).not.toMatch(JUDGING_ID);
      const anchors = new Set(collectAnchors(t.render.apps));
      for (const e of t.evidenceDefinitions) expect(anchors.has(e.evidenceId), e.evidenceId).toBe(false);
    }
  });

  it("every domain and email address is a reserved .example domain; phone numbers are fictional (R29)", () => {
    for (const t of templates) {
      for (const s of strings(t.render)) {
        for (const m of s.matchAll(/[a-z0-9.-]+@((?:[a-z0-9-]+\.)*[a-z0-9-]+)/gi))
          expect(m[1], s).toMatch(/\.example$/);
        for (const m of s.matchAll(/https?:\/\/([^/\s?]+)/gi)) expect(m[1], s).toMatch(/\.example$/);
        for (const m of s.matchAll(/\b((?:[a-z0-9-]+\.)+)(com|net|org|io|co|app|bank|pay|us|uk)\b/gi)) {
          throw new Error(`${t.scenarioId}: real-looking domain ${m[0]} in "${s}"`);
        }
        for (const m of s.matchAll(/555-?(\d{4})/g)) expect(Number(m[1]), s).toBeGreaterThanOrEqual(100);
        for (const m of s.matchAll(/555-?(\d{4})/g)) expect(Number(m[1]), s).toBeLessThanOrEqual(199);
      }
    }
  });

  it("never asks for credentials: no password, PIN, card-number or code input wording (R33)", () => {
    for (const t of templates) {
      for (const s of strings(t.render)) {
        expect(s, s).not.toMatch(/enter your (password|pin|card|code)|card number|cvv|routing number/i);
      }
    }
  });

  it("uses only known tokens", () => {
    for (const t of templates) {
      const known = new Set([
        "amount",
        "playerName",
        ...Object.keys(t.render.amountParts).flatMap((p) => [`amount.${p}`, `amount.minus.${p}`]),
        ...t.render.slots.map((s) => s.name),
      ]);
      for (const token of collectTokens(t.render))
        expect(known, `${t.scenarioId}: {{${token}}}`).toContain(token);
    }
  });

  it("carries routing metadata from the shared vocabularies (Step 8 personalization)", () => {
    for (const t of templates) {
      expect(t.activityTags.length).toBeGreaterThan(0);
      expect(t.contextTags.length).toBeGreaterThan(0);
      for (const a of t.activityTags) expect(ACTIVITY_TAGS).toContain(a);
      for (const c of t.contextTags) expect(CONTEXT_TAGS).toContain(c);
      expect(t.difficulty.requiredVerificationActions.length).toBeGreaterThan(0);
      expect(t.difficulty.numberOfDecisionPoints).toBeGreaterThanOrEqual(1);
      expect(t.evidenceReferences).toEqual([]); // no invented statistics or sources
      expect(t.supportedPersonalizationFields).not.toContain("ageBracket");
    }
    // Advanced scenarios have more decision points than beginner ones.
    const points = (k: keyof typeof SCENARIO_TEMPLATES) =>
      SCENARIO_TEMPLATES[k].difficulty.numberOfDecisionPoints;
    expect(points("m3-s1")).toBeGreaterThan(points("m1-s1"));
    expect(points("m3-s2")).toBeGreaterThan(points("m1-s2"));
  });

  it("maps every profile activity and occupation onto routing tags", () => {
    expect(Object.keys(PROFILE_ACTIVITY_TAGS).sort()).toEqual([...FINANCIAL_ACTIVITY_VALUES].sort());
    expect(Object.keys(PROFILE_CONTEXT_TAG).sort()).toEqual([...OCCUPATION_VALUES].sort());
    // Every profile activity reaches at least one scenario, except the documented MVP gaps (no investment or
    // invoice-sending storyline among the six; routing then falls back to the module's default order).
    const gaps = ["investments", "sending_invoices"];
    for (const [activity, tags] of Object.entries(PROFILE_ACTIVITY_TAGS)) {
      const reach = templates.filter((t) => t.activityTags.some((a) => tags.includes(a)));
      expect(reach.length > 0, activity).toBe(!gaps.includes(activity));
    }
  });

  it("decision and fallback texts never promise refunds or invent policy (R30)", () => {
    for (const t of templates) {
      for (const s of strings([t.fallbackContent, t.render.decisions])) {
        expect(s).not.toMatch(/guarantee|refund (is|will be) (issued|guaranteed)|\d+%|statistic/i);
      }
    }
  });
});
