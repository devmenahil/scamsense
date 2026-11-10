/**
 * Reveal the Red Flags (Step 9): every authored evidence target can be found and opened in its own environment,
 * classifications are carried exactly, the learner's reasoning stays separate, and nothing is built before COMPLETED.
 */
import { describe, expect, it } from "vitest";
import { SCENARIO_KEYS, type ScenarioKey } from "@/content/modules";
import { SCENARIO_TEMPLATES } from "@/content/scenarios/templates.server";
import { buildClientView } from "@/lib/scenario/view";
import type { LoadedAttempt } from "@/lib/scenario/server";
import { collectAnchors, locateAnchors, reviewRecordedActions } from "./locate";
import { NotCompletedError, reviewFromLoaded } from "./server";
import { buildReviewView } from "./view";

const KEYS = SCENARIO_KEYS as readonly ScenarioKey[];

function loaded(key: ScenarioKey, state: string, decisionId: string, actions: string[] = []): LoadedAttempt {
  return {
    attempt: {
      id: `00000000-0000-4000-8000-00000000000${KEYS.indexOf(key)}`,
      scenarioKey: key,
      attemptNumber: 1,
      isPractice: false,
      state: state as LoadedAttempt["attempt"]["state"],
      pendingDecisionId: null,
      decisionId,
      justification: "I checked the details through a channel I already trusted before deciding.",
    },
    events: actions.map((a) => ({ eventType: "RECORD_ACTION", actionId: a })),
    run: { currency: "USD", startingFundsMinor: 300_000 },
    payments: [],
    personalization: null,
  };
}

describe("evidence target location (all six scenarios)", () => {
  it.each(KEYS)("%s: every evidence target is located in a real app of the render", (key) => {
    const t = SCENARIO_TEMPLATES[key];
    const locations = locateAnchors(t.render);
    const appIds = t.render.apps.map((a) => a.id);
    for (const e of t.evidenceDefinitions) {
      const loc = locations.get(e.targetElementId);
      expect(loc, `${key}/${e.evidenceId} → ${e.targetElementId}`).toBeDefined();
      expect(appIds).toContain(loc!.appId);
    }
  });

  it("uses the stable anchors (not text search) and opens the specific place", () => {
    const m2s2 = locateAnchors(SCENARIO_TEMPLATES["m2-s2"].render);
    expect(m2s2.get("product_reviews")?.target).toMatchObject({
      kind: "market",
      page: "product",
      productTab: "reviews",
    });
    expect(m2s2.get("seller_payment_policy")?.target).toMatchObject({ kind: "market", page: "seller" });
    expect(m2s2.get("displayed_domain")?.target).toMatchObject({ kind: "market", page: "home" });
    const m2s1 = locateAnchors(SCENARIO_TEMPLATES["m2-s1"].render);
    expect(m2s1.get("invoice_total")?.target).toMatchObject({ kind: "mail", documentIndex: 0 });
    const m3s2 = locateAnchors(SCENARIO_TEMPLATES["m3-s2"].render);
    expect(m3s2.get("order_status")?.target).toMatchObject({ kind: "hub", tab: "orders" });
    expect(m3s2.get("buyer_first_message")?.target).toMatchObject({ kind: "hub", tab: "messages" });
    const m1s1 = locateAnchors(SCENARIO_TEMPLATES["m1-s1"].render);
    // A branch message is gated by the reply that reveals it.
    expect(m1s1.get("callback_reply")?.requires.length).toBeGreaterThan(0);
  });

  it("collectAnchors finds every anchor key shape", () => {
    expect(collectAnchors({ anchor: "a", x: { fromAnchor: "b", list: [{ totalAnchor: "c" }] } })).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("the review reveals all content, the learner's own actions first", () => {
    const r = SCENARIO_TEMPLATES["m1-s1"].render;
    const all = reviewRecordedActions(r, ["check_sender_details"]);
    expect(all[0]).toBe("check_sender_details");
    for (const a of r.actions) expect(all).toContain(a.id);
  });
});

describe("review view", () => {
  it("supports all three classifications across the scenarios", () => {
    const kinds = new Set(
      KEYS.flatMap((k) =>
        reviewFromLoaded(
          loaded(k, "COMPLETED", SCENARIO_TEMPLATES[k].evaluationRubric.correctDecisionIds[0]!),
          "Alex",
          null,
        ).evidence.map((e) => e.kind),
      ),
    );
    expect([...kinds].sort()).toEqual(["positive", "red_flag", "verify"]);
  });

  it("explains the legitimate scenario fairly: positive evidence and checks, no red flags", () => {
    const v = reviewFromLoaded(loaded("m2-s2", "COMPLETED", "place_order"), "Alex", null);
    expect(v.scamStatus).toBe("legitimate");
    expect(v.decision.correct).toBe(true);
    expect(v.evidence.some((e) => e.kind === "red_flag")).toBe(false);
    expect(v.evidence.filter((e) => e.kind === "positive").length).toBeGreaterThan(0);
    expect(v.evidence.some((e) => e.kind === "verify")).toBe(true);
  });

  it("copies authoritative explanations from the answer key and numbers markers in order", () => {
    const t = SCENARIO_TEMPLATES["m2-s1"];
    const v = reviewFromLoaded(loaded("m2-s1", "COMPLETED", "pay_invoice"), "Alex", null);
    expect(v.evidence.map((e) => e.number)).toEqual(t.evidenceDefinitions.map((_, i) => i + 1));
    v.evidence.forEach((e, i) => {
      expect(e.explanation).toBe(t.evidenceDefinitions[i]!.explanation);
      expect(e.anchor).toBe(t.evidenceDefinitions[i]!.targetElementId);
    });
    expect(v.decision.correct).toBe(false);
  });

  it("keeps the learner's reasoning separate (mentioned / missed / not mentioned)", () => {
    const t = SCENARIO_TEMPLATES["m1-s1"];
    const [a, b, c] = t.evidenceDefinitions.map((e) => e.evidenceId);
    const v = buildReviewView({
      attemptId: "x",
      template: t,
      render: t.render,
      module: { key: "spot-the-trap", title: "Spot the Trap", order: 1 },
      attemptNumber: 2,
      isPractice: true,
      decisionId: "block_report",
      learnerActions: [],
      evaluation: {
        source: "gemini",
        recognizedEvidenceIds: [a!],
        missedEvidenceIds: [b!],
        unsupportedAssumptions: ["x"],
      },
    });
    expect(v.evidence.find((e) => e.id === a)!.reasoning).toBe("mentioned");
    expect(v.evidence.find((e) => e.id === b)!.reasoning).toBe("missed");
    expect(v.evidence.find((e) => e.id === c)!.reasoning).toBe("not_mentioned");
    expect(v.isPractice).toBe(true);
    // Explanations never change with the reasoning.
    expect(v.evidence.find((e) => e.id === a)!.explanation).toBe(t.evidenceDefinitions[0]!.explanation);
  });

  it("flags evidence the learner never opened (content behind a reply they didn't choose)", () => {
    const v = reviewFromLoaded(loaded("m1-s1", "COMPLETED", "block_report", []), "Alex", null);
    const gated = v.evidence.find((e) => e.anchor === "callback_reply")!;
    expect(gated.seenDuringAttempt).toBe(false);
    const always = v.evidence.find((e) => e.anchor === "sender_number")!;
    expect(always.seenDuringAttempt).toBe(true);
  });

  it("shows the exact narrative that was played (same tokens and personalization)", () => {
    const l = loaded("m2-s2", "COMPLETED", "place_order");
    const v = reviewFromLoaded(l, "Alex Rivera", null);
    expect(v.render).toEqual(buildClientView({ ...l, displayName: "Alex Rivera" }).render);
  });

  it.each(["INTRO", "ACTIVE", "EXPLANATION_REQUIRED", "PAYMENT_PENDING", "FINALIZED", "RECOVERY_AVAILABLE"])(
    "refuses to build a review before COMPLETED (%s): hidden evidence stays on the server",
    (state) => {
      expect(() => reviewFromLoaded(loaded("m1-s1", state, "block_report"), "Alex", null)).toThrow(
        NotCompletedError,
      );
    },
  );
});
