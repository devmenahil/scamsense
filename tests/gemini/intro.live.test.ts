/**
 * Focused LIVE check of Gemini-personalized introductions (owner decision 13): ONE real personalization request per
 * scenario (6 total), through the production prompt and validators. Run alone with:
 *   npx vitest run --config vitest.gemini.config.mts tests/gemini/intro.live.test.ts
 */
import { existsSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { SCENARIO_KEYS } = await import("@/content/modules");
const { SCENARIO_RENDERS } = await import("@/content/scenarios/renders");
const { generateJson, isGeminiConfigured } = await import("@/lib/ai/gemini");
const { getUsageSnapshot } = await import("@/lib/ai/usage");
const { buildPersonalizationPrompt, PERSONALIZATION_SYSTEM, personalizationJsonSchema } =
  await import("@/lib/personalization/prompt");
const { parsePersonalizationOutput } = await import("@/lib/personalization/server");

const PROFILES = {
  student: {
    occupation: "student",
    customOccupation: null,
    financialActivities: ["online_shopping", "job_applications"],
    customActivity: null,
    paymentExperience: "occasional",
    financialGoal: "buying_laptop",
    customGoal: null,
    ageBracket: "18_24",
    contextSummary: null,
  },
  artist: {
    occupation: "other",
    customOccupation: "Digital artist selling commissions.",
    financialActivities: ["other"],
    customActivity: "I accept payments for commissioned artwork through social platforms.",
    paymentExperience: "frequent",
    financialGoal: "other",
    customGoal: "Saving for a professional drawing tablet.",
    ageBracket: "25_34",
    contextSummary: "sells commissioned artwork through social media platforms",
  },
};

describe.skipIf(!isGeminiConfigured())("live personalized intros", () => {
  it("generates accurate, personalized, neutral intros for all six scenarios", async () => {
    const report: Record<string, unknown>[] = [];
    for (const [i, key] of SCENARIO_KEYS.entries()) {
      const who = i % 2 === 0 ? "student" : "artist";
      const render = SCENARIO_RENDERS[key];
      if (i > 0) await new Promise((r) => setTimeout(r, 5_500));
      const r = await generateJson({
        category: "personalization",
        rateKey: "live-intro",
        systemInstruction: PERSONALIZATION_SYSTEM,
        prompt: buildPersonalizationPrompt(render, PROFILES[who], "US$300.00"),
        jsonSchema: personalizationJsonSchema(render),
        parse: (raw) => {
          const v = parsePersonalizationOutput(render, raw);
          // Keep the raw intro for the report even when it was rejected.
          return { ...v, rawIntro: (raw as { introLine?: string }).introLine ?? null };
        },
        maxOutputTokens: 900,
        temperature: 0.8,
        thinking: "minimal",
      });
      expect(r.ok, `${key}: ${r.ok ? "" : r.reason}`).toBe(true);
      if (!r.ok) continue;
      report.push({
        scenario: key,
        profile: who,
        accepted: r.value.introLine !== null,
        intro: r.value.introLine ?? render.introLine,
        generated: r.value.rawIntro,
        rejection: r.value.introRejection,
      });
    }
    if (process.env.GEMINI_LIVE_REPORT)
      writeFileSync(
        process.env.GEMINI_LIVE_REPORT,
        JSON.stringify({ report, usage: getUsageSnapshot() }, null, 2),
      );
    console.info(JSON.stringify(report, null, 2));
    // Every shown intro is either validated or the authored fallback; most should be accepted.
    expect(report.filter((x) => x.accepted).length).toBeGreaterThanOrEqual(4);
  }, 180_000);
});
