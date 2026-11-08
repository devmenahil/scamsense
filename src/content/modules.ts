/**
 * The three ScamSense modules (R5–R7). Titles and difficulty definitions come from PRODUCT_SPEC §3.1 and the level
 * info reference. Starting training funds are still an open product question (PRODUCT_SPEC §12) and are added in
 * Phase 3 — they are deliberately absent here.
 */
export type ModuleKey = "spot-the-trap" | "trust-under-pressure" | "outsmart-the-scam";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export interface ModuleDefinition {
  key: ModuleKey;
  order: 1 | 2 | 3;
  title: string;
  difficulty: Difficulty;
  focus: string;
  summary: string;
}

export const MODULES: readonly ModuleDefinition[] = [
  {
    key: "spot-the-trap",
    order: 1,
    title: "Spot the Trap",
    difficulty: "Beginner",
    focus: "Awareness",
    summary: "Notice the obvious warning signs before you click, share, or pay.",
  },
  {
    key: "trust-under-pressure",
    order: 2,
    title: "Trust Under Pressure",
    difficulty: "Intermediate",
    focus: "Recognition",
    summary: "Stay steady when urgency, impersonation, and familiar branding push you to act fast.",
  },
  {
    key: "outsmart-the-scam",
    order: 3,
    title: "Outsmart the Scam",
    difficulty: "Advanced",
    focus: "Critical thinking",
    summary: "Work through multi-step situations where the clues are subtle and mixed.",
  },
] as const;

export function getModule(key: string): ModuleDefinition | undefined {
  return MODULES.find((m) => m.key === key);
}
