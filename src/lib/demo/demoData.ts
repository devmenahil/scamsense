/**
 * DEMONSTRATION DATA — Phase 1 page shells only.
 *
 * Nothing here is real progress, money, or evaluation. Every screen that renders this data shows the
 * <DemoNotice /> label. Phase 2+ replaces these values with server data (GET /api/progress etc.).
 * Amounts are integer minor units (R38).
 */
import type { ModuleKey } from "@/content/modules";

export type ModuleStatus = "locked" | "available" | "in_progress" | "completed";
export type ScenarioStatus = "not_started" | "in_progress" | "completed";

export interface DemoScenario {
  key: string;
  /** Neutral label only: no hint of legitimacy or red flags (R9, R10). */
  label: string;
  environment: string;
  introLine: string;
  status: ScenarioStatus;
}

export const DEMO_USER = {
  displayName: "Alex Rivera",
  ageBracket: "25–34",
  lifeStage: "Employed",
  paymentExperience: "Regular",
  financialGoal: "Build an emergency fund",
  financialActivities: ["Online shopping", "Paying bills", "Sending money to family"],
  incomeBracket: "Prefer not to say",
  currency: "USD",
} as const;

export const DEMO_WALLET = {
  currency: "USD",
  minorUnitDigits: 2,
  balanceMinor: 50_000,
  startingMinor: 50_000,
} as const;

export const DEMO_MODULE_STATUS: Record<ModuleKey, ModuleStatus> = {
  "spot-the-trap": "in_progress",
  "trust-under-pressure": "locked",
  "outsmart-the-scam": "locked",
};

export const DEMO_SCENARIOS: Record<ModuleKey, DemoScenario[]> = {
  "spot-the-trap": [
    {
      key: "demo-1a",
      label: "Scenario 1",
      environment: "Chat window",
      introLine: "A new chat conversation has started.",
      status: "completed",
    },
    {
      key: "demo-1b",
      label: "Scenario 2",
      environment: "Email inbox",
      introLine: "You've received a new message in your inbox.",
      status: "not_started",
    },
  ],
  "trust-under-pressure": [
    {
      key: "demo-2a",
      label: "Scenario 1",
      environment: "Email and invoice",
      introLine: "A new email has arrived.",
      status: "not_started",
    },
    {
      key: "demo-2b",
      label: "Scenario 2",
      environment: "Online store",
      introLine: "You're shopping online.",
      status: "not_started",
    },
  ],
  "outsmart-the-scam": [
    {
      key: "demo-3a",
      label: "Scenario 1",
      environment: "Seller dashboard",
      introLine: "You have a new order on your shop.",
      status: "not_started",
    },
    {
      key: "demo-3b",
      label: "Scenario 2",
      environment: "Job board and chat",
      introLine: "A recruiter has sent you a message.",
      status: "not_started",
    },
  ],
};

export const DEMO_ATTEMPT_ID = "demo";
