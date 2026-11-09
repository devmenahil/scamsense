/**
 * The three ScamSense modules (R5–R7), each with exactly two scenario slots (R6). Titles and difficulty definitions
 * come from PRODUCT_SPEC §3.1 and the level info reference.
 *
 * Scenario titles and badge names are the product owner's official names (Step 5 review). Slot 1 / slot 2 follow
 * the order the owner listed them; Step 8 may rank which one is suggested first, but keys and amounts never move.
 * Payment percentages (5/8, 10/12, 15/20 %) are listed in the same order as the titles.
 *
 * PAYMENT CONFIGURATION (R19): each scenario slot carries the amount at stake as a percentage of the module's
 * starting training funds, in integer basis points (100 bp = 1%). These are the initial values from the Step 5 brief
 * and are meant to be tuned: change `paymentBasisPoints` here, nothing else. The scenario engine (never Gemini)
 * turns the percentage into an amount with `scenarioAmountMinor()` (src/lib/domain/trainingFunds.ts).
 * `modules.test.ts` checks the structure (3 modules × 2 slots, unique keys, per-module total ≤ 100%).
 *
 * Slot keys are stable, neutral identifiers (no hint of legitimacy). They are stored in the database
 * (`scenario_attempts.scenario_key`), so renaming one requires a migration.
 *
 * Pure data: safe to import on the client. Answer keys and evidence never live here (server-only files, Phase 4).
 */
export type ModuleKey = "spot-the-trap" | "trust-under-pressure" | "outsmart-the-scam";
export type ScenarioKey = "m1-s1" | "m1-s2" | "m2-s1" | "m2-s2" | "m3-s1" | "m3-s2";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export interface ScenarioSlot {
  key: ScenarioKey;
  moduleKey: ModuleKey;
  /** 1 or 2 within the module. Scenarios can be played in either order (PRODUCT_SPEC §3.1). */
  position: 1 | 2;
  /** Official scenario title (product owner, Step 5 review). Neutral: reveals nothing about legitimacy (R9, R10). */
  title: string;
  /** Amount at stake as basis points of the module's starting training funds. */
  paymentBasisPoints: number;
}

export interface ModuleDefinition {
  key: ModuleKey;
  order: 1 | 2 | 3;
  title: string;
  difficulty: Difficulty;
  focus: string;
  summary: string;
  /** Badge awarded when both scenarios are completed (R24). */
  badgeName: string;
  scenarios: readonly [ScenarioSlot, ScenarioSlot];
}

function slots(
  moduleKey: ModuleKey,
  order: 1 | 2 | 3,
  titles: [string, string],
  basisPoints: [number, number],
): readonly [ScenarioSlot, ScenarioSlot] {
  return [
    {
      key: `m${order}-s1` as ScenarioKey,
      moduleKey,
      position: 1,
      title: titles[0],
      paymentBasisPoints: basisPoints[0],
    },
    {
      key: `m${order}-s2` as ScenarioKey,
      moduleKey,
      position: 2,
      title: titles[1],
      paymentBasisPoints: basisPoints[1],
    },
  ];
}

export const MODULES: readonly ModuleDefinition[] = [
  {
    key: "spot-the-trap",
    order: 1,
    title: "Spot the Trap",
    difficulty: "Beginner",
    focus: "Awareness",
    summary: "Notice the obvious warning signs before you click, share, or pay.",
    badgeName: "Scam Spotter",
    scenarios: slots("spot-the-trap", 1, ["The Security Check", "Your Account Needs Attention"], [500, 800]),
  },
  {
    key: "trust-under-pressure",
    order: 2,
    title: "Trust Under Pressure",
    difficulty: "Intermediate",
    focus: "Recognition",
    summary: "Stay steady when urgency, impersonation, and familiar branding push you to act fast.",
    badgeName: "Fraud Detective",
    scenarios: slots(
      "trust-under-pressure",
      2,
      ["An Invoice Has Arrived", "The Laptop Purchase"],
      [1000, 1200],
    ),
  },
  {
    key: "outsmart-the-scam",
    order: 3,
    title: "Outsmart the Scam",
    difficulty: "Advanced",
    focus: "Critical thinking",
    summary: "Work through multi-step situations where the clues are subtle and mixed.",
    badgeName: "ScamSense Guardian",
    scenarios: slots("outsmart-the-scam", 3, ["The Job Opportunity", "The Seller's Dilemma"], [1500, 2000]),
  },
] as const;

export const MODULE_KEYS = MODULES.map((m) => m.key) as [ModuleKey, ...ModuleKey[]];
export const SCENARIO_SLOTS: readonly ScenarioSlot[] = MODULES.flatMap((m) => m.scenarios);
export const SCENARIO_KEYS = SCENARIO_SLOTS.map((s) => s.key) as [ScenarioKey, ...ScenarioKey[]];

export function getModule(key: string): ModuleDefinition | undefined {
  return MODULES.find((m) => m.key === key);
}

export function getScenarioSlot(key: string): ScenarioSlot | undefined {
  return SCENARIO_SLOTS.find((s) => s.key === key);
}

/** The module that must be completed before `key` unlocks, or null for Module 1. */
export function prerequisiteModule(key: ModuleKey): ModuleDefinition | null {
  const m = getModule(key);
  if (!m || m.order === 1) return null;
  return MODULES.find((x) => x.order === m.order - 1) ?? null;
}
