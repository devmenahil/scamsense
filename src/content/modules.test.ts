import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BASIS_POINTS_PER_WHOLE } from "@/lib/domain/money";
import { getScenarioSlot, MODULES, prerequisiteModule, SCENARIO_KEYS } from "./modules";

/** Content validation for the module/slot configuration (R5, R6, R19). */
const slotSchema = z.object({
  key: z.string().regex(/^m[1-3]-s[12]$/),
  moduleKey: z.string(),
  position: z.union([z.literal(1), z.literal(2)]),
  title: z.string().min(1),
  paymentBasisPoints: z.number().int().min(1).max(BASIS_POINTS_PER_WHOLE),
});
const moduleSchema = z.object({
  key: z.string(),
  order: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string().min(1),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  badgeName: z.string().min(1),
  scenarios: z.tuple([slotSchema, slotSchema]),
});

describe("module configuration", () => {
  it("validates against the content schema", () => {
    for (const m of MODULES) expect(() => moduleSchema.parse(m)).not.toThrow();
  });

  it("has exactly three modules in order with the required titles and difficulties", () => {
    expect(MODULES.map((m) => [m.order, m.title, m.difficulty])).toEqual([
      [1, "Spot the Trap", "Beginner"],
      [2, "Trust Under Pressure", "Intermediate"],
      [3, "Outsmart the Scam", "Advanced"],
    ]);
  });

  it("has exactly two uniquely keyed slots per module that point back to their module", () => {
    expect(new Set(SCENARIO_KEYS).size).toBe(6);
    for (const m of MODULES) {
      expect(m.scenarios.map((s) => s.position)).toEqual([1, 2]);
      for (const s of m.scenarios) {
        expect(s.moduleKey).toBe(m.key);
        expect(s.key.startsWith(`m${m.order}-`)).toBe(true);
        expect(getScenarioSlot(s.key)).toBe(s);
      }
    }
  });

  it("uses the Step 5 payment percentages and never exceeds 100% per module", () => {
    expect(MODULES.flatMap((m) => m.scenarios.map((s) => s.paymentBasisPoints))).toEqual([
      500, 800, 1000, 1200, 1500, 2000,
    ]);
    for (const m of MODULES) {
      expect(m.scenarios.reduce((sum, s) => sum + s.paymentBasisPoints, 0)).toBeLessThanOrEqual(
        BASIS_POINTS_PER_WHOLE,
      );
    }
  });

  it("uses the official scenario titles and badge names", () => {
    expect(MODULES.map((m) => [m.badgeName, m.scenarios.map((s) => s.title)])).toEqual([
      ["Scam Spotter", ["The Security Check", "Your Account Needs Attention"]],
      ["Fraud Detective", ["An Invoice Has Arrived", "The Laptop Purchase"]],
      ["ScamSense Guardian", ["The Job Opportunity", "The Seller's Dilemma"]],
    ]);
  });

  it("chains prerequisites 1 → 2 → 3", () => {
    expect(prerequisiteModule("spot-the-trap")).toBeNull();
    expect(prerequisiteModule("trust-under-pressure")?.key).toBe("spot-the-trap");
    expect(prerequisiteModule("outsmart-the-scam")?.key).toBe("trust-under-pressure");
  });

  it("uses neutral slot labels that reveal nothing about a scenario (R9, R10)", () => {
    const deny = /scam|fraud|fake|suspicious|legit|safe|red flag|warning|trap/i;
    for (const s of MODULES.flatMap((m) => m.scenarios)) expect(s.title).not.toMatch(deny);
  });
});
