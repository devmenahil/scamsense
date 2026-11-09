import { describe, expect, it } from "vitest";
import { MODULES } from "@/content/modules";
import { SCENARIO_TEMPLATES } from "@/content/scenarios/templates.server";
import { combineTags, predefinedTags, type RoutingProfile } from "@/lib/routing/profileTags";
import {
  applyScenarioOrder,
  bpToUnit,
  rankModuleScenarios,
  RoutingError,
  scoreScenario,
  type ResolvedProfileTags,
} from "./routing";

const routable = (moduleKey: string) => {
  const m = MODULES.find((x) => x.key === moduleKey)!;
  return m.scenarios.map((s) => ({
    key: s.key,
    moduleKey,
    activityTags: SCENARIO_TEMPLATES[s.key].activityTags,
    contextTags: SCENARIO_TEMPLATES[s.key].contextTags,
  }));
};

/** All three modules for a set of resolved tags: { moduleKey: [{scenario, A, C, E, D, total}] }. */
function rankAll(tags: ResolvedProfileTags) {
  return Object.fromEntries(
    MODULES.map((m) => [
      m.key,
      rankModuleScenarios(tags, routable(m.key)).map((s) => ({
        scenario: s.scenarioKey,
        A: bpToUnit(s.activityBp),
        C: bpToUnit(s.contextBp),
        E: bpToUnit(s.evidenceBp),
        D: bpToUnit(s.difficultyBp),
        total: bpToUnit(s.totalBp),
      })),
    ]),
  );
}

const order = (tags: ResolvedProfileTags) =>
  Object.fromEntries(
    MODULES.map((m) => [m.key, rankModuleScenarios(tags, routable(m.key)).map((s) => s.scenarioKey)]),
  );

const tagsFor = (p: RoutingProfile, mapped?: Parameters<typeof combineTags>[1]) =>
  combineTags(predefinedTags(p), mapped ?? null);

describe("deterministic relevance formula (Step 8 brief §6)", () => {
  it("is 0.50·A + 0.20·C + 0.15·E + 0.15·D with E = 0.5 and D = 1", () => {
    const s = scoreScenario(
      { activityTags: ["online_shopping"], contextTags: ["student"] },
      {
        key: "x",
        moduleKey: "m",
        activityTags: ["online_shopping", "digital_wallet_usage"],
        contextTags: ["student"],
      },
    );
    expect(s.activityBp).toBe(5_000); // 1 of 2 scenario activity tags
    expect(s.contextBp).toBe(10_000);
    expect(s.evidenceBp).toBe(5_000);
    expect(s.difficultyBp).toBe(10_000);
    // 0.5·0.5 + 0.2·1 + 0.15·0.5 + 0.15·1 = 0.675
    expect(bpToUnit(s.totalBp)).toBe(0.675);
  });

  it("keeps every component and the total within [0, 1]", () => {
    for (const tags of [
      { activityTags: [], contextTags: [] },
      {
        activityTags: ["online_shopping", "online_selling", "job_seeking"],
        contextTags: ["student", "freelancer"],
      },
    ] as ResolvedProfileTags[]) {
      for (const m of MODULES)
        for (const s of rankModuleScenarios(tags, routable(m.key)))
          for (const v of [s.activityBp, s.contextBp, s.evidenceBp, s.difficultyBp, s.totalBp]) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(10_000);
          }
    }
  });

  it("breaks ties by the stable scenario key and is reproducible", () => {
    const neutral = { activityTags: [], contextTags: ["general_consumer"] } as ResolvedProfileTags;
    expect(order(neutral)).toEqual(order(neutral));
    const m1 = rankModuleScenarios(neutral, routable("spot-the-trap"));
    expect(m1[0]!.totalBp).toBe(m1[1]!.totalBp);
    expect(m1.map((s) => s.scenarioKey)).toEqual(["m1-s1", "m1-s2"]);
  });

  it("only ranks exactly the two scenarios of ONE module", () => {
    const tags = { activityTags: [], contextTags: [] } as ResolvedProfileTags;
    const mixed = [routable("spot-the-trap")[0]!, routable("outsmart-the-scam")[0]!];
    expect(() => rankModuleScenarios(tags, mixed)).toThrow(RoutingError);
    expect(() => rankModuleScenarios(tags, routable("spot-the-trap").slice(0, 1))).toThrow(RoutingError);
    for (const m of MODULES) {
      const ranked = rankModuleScenarios(tags, routable(m.key))
        .map((s) => s.scenarioKey)
        .sort();
      expect(ranked).toEqual(m.scenarios.map((s) => s.key).sort()); // both stay mandatory
    }
  });

  it("applies a persisted order only when it names exactly the module's own scenarios", () => {
    const slots = [{ key: "m2-s1" }, { key: "m2-s2" }];
    expect(applyScenarioOrder(slots, ["m2-s2", "m2-s1"]).map((s) => s.key)).toEqual(["m2-s2", "m2-s1"]);
    expect(applyScenarioOrder(slots, ["m3-s1", "m2-s1"]).map((s) => s.key)).toEqual(["m2-s1", "m2-s2"]);
    expect(applyScenarioOrder(slots, ["m2-s2"]).map((s) => s.key)).toEqual(["m2-s1", "m2-s2"]);
    expect(applyScenarioOrder(slots, null).map((s) => s.key)).toEqual(["m2-s1", "m2-s2"]);
  });
});

describe("realistic profiles (Step 8 brief §24)", () => {
  it("Profile A — student, online shopping + job applications, laptop goal", () => {
    const tags = tagsFor({
      occupation: "student",
      customOccupation: null,
      financialActivities: ["online_shopping", "job_applications"],
      customActivity: null,
    });
    expect(tags).toEqual({ activityTags: ["job_seeking", "online_shopping"], contextTags: ["student"] });
    const ranked = rankAll(tags);
    expect(ranked["trust-under-pressure"]![0]).toEqual({
      scenario: "m2-s2",
      A: 0.5,
      C: 1,
      E: 0.5,
      D: 1,
      total: 0.675,
    });
    expect(order(tags)).toEqual({
      "spot-the-trap": ["m1-s1", "m1-s2"],
      "trust-under-pressure": ["m2-s2", "m2-s1"],
      "outsmart-the-scam": ["m3-s1", "m3-s2"],
    });
  });

  it("Profile B — freelancer, freelance payments + receiving invoices", () => {
    const tags = tagsFor({
      occupation: "freelancer",
      customOccupation: null,
      financialActivities: ["freelance_payments", "receiving_invoices"],
      customActivity: null,
    });
    expect(tags.activityTags).toEqual(["freelancing", "paying_invoices", "receiving_invoices"]);
    expect(order(tags)["trust-under-pressure"]).toEqual(["m2-s1", "m2-s2"]); // the invoice comes first
    expect(order(tags)["outsmart-the-scam"]).toEqual(["m3-s1", "m3-s2"]);
  });

  it("Profile C — business owner, business purchases + sending invoices", () => {
    const tags = tagsFor({
      occupation: "business_owner",
      customOccupation: null,
      financialActivities: ["business_purchases", "sending_invoices"],
      customActivity: null,
    });
    expect(order(tags)["trust-under-pressure"]).toEqual(["m2-s1", "m2-s2"]); // supplier-style invoice first
    expect(order(tags)["outsmart-the-scam"]).toEqual(["m3-s2", "m3-s1"]); // business owner context: seller
  });

  it("Profile D — custom digital artist: Gemini-mapped tags flow through the same formula", () => {
    const profile: RoutingProfile = {
      occupation: "other",
      customOccupation: "Digital artist selling commissions.",
      financialActivities: ["other"],
      customActivity: "I accept payments for commissioned artwork through social platforms.",
    };
    expect(predefinedTags(profile)).toEqual({ activityTags: [], contextTags: [] });
    // A validated interpretation (what the classifier may return for this text).
    const tags = tagsFor(profile, {
      status: "mapped",
      source: "gemini",
      activityTags: ["online_selling", "freelancing", "digital_wallet_usage"],
      contextTags: ["freelancer"],
      contextSummary: "sells digital art commissions online",
    });
    expect(order(tags)["outsmart-the-scam"]).toEqual(["m3-s2", "m3-s1"]); // selling scenario first
  });

  it("Profile E — a custom goal adds no routing tags", () => {
    const p: RoutingProfile = {
      occupation: "student",
      customOccupation: null,
      financialActivities: ["online_shopping"],
      customActivity: null,
    };
    // financialGoal/customGoal are not routing inputs at all (not even part of RoutingProfile).
    expect(tagsFor(p)).toEqual({ activityTags: ["online_shopping"], contextTags: ["student"] });
    expect(order(tagsFor(p))["trust-under-pressure"]).toEqual(["m2-s2", "m2-s1"]);
  });

  it("Profile F — ambiguous 'Something else.' gets neutral context, nothing invented", () => {
    const tags = tagsFor({
      occupation: "other",
      customOccupation: "Something else.",
      financialActivities: ["digital_wallet_usage"],
      customActivity: null,
    });
    expect(tags.contextTags).toEqual(["general_consumer"]);
    for (const m of MODULES) expect(order(tags)[m.key]).toHaveLength(2);
  });

  it("never uses age, income, country, or goal (the formula's inputs are activity and context tags only)", () => {
    expect(
      Object.keys(
        predefinedTags({
          occupation: "retired",
          customOccupation: null,
          financialActivities: [],
          customActivity: null,
        }),
      ).sort(),
    ).toEqual(["activityTags", "contextTags"]);
  });
});
