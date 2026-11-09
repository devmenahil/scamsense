/**
 * The full scenario TEMPLATE (Step 6 brief §5): the client-safe render plus the server-only answer key, evaluation
 * rubric, evidence definitions, payment configuration, and routing metadata.
 *
 * This file only defines SHAPES and vocabularies (nothing secret). The authored answer keys live in
 * `src/content/scenarios/<key>/answerKey.server.ts` (`import "server-only"`) and are never serialized to the browser
 * before an attempt is completed (R10, R15).
 */
import { z } from "zod";
import { FINANCIAL_ACTIVITY_VALUES, OCCUPATION_VALUES } from "@/content/profileOptions";
import { anchorSchema, idSchema, type ScenarioRender } from "./schema";

/* ------------------------------------------------------------------------------------- vocabularies */

/** The five approved categories (reference/scamSense level info.docx, PRODUCT_SPEC §3.2). */
export const SCAM_CATEGORIES = [
  "otp_social_engineering",
  "phishing_fake_websites",
  "fake_invoices_impersonation",
  "online_shopping_marketplace",
  "advance_fee_job_investment",
] as const;
export type ScamCategory = (typeof SCAM_CATEGORIES)[number];

/** Routing activity tags (Step 6 brief §6). */
export const ACTIVITY_TAGS = [
  "online_shopping",
  "online_selling",
  "freelancing",
  "sending_invoices",
  "receiving_invoices",
  "paying_invoices",
  "job_seeking",
  "subscriptions",
  "business_purchasing",
  "digital_wallet_usage",
  "account_security",
  "investments",
] as const;
export type ActivityTag = (typeof ACTIVITY_TAGS)[number];

/** Routing context tags (Step 6 brief §6). Never age-based: age does not determine digital literacy. */
export const CONTEXT_TAGS = [
  "student",
  "employed_professional",
  "freelancer",
  "business_owner",
  "self_employed",
  "job_seeker",
  "retired",
  "general_consumer",
] as const;
export type ContextTag = (typeof CONTEXT_TAGS)[number];

/**
 * How profile answers (src/content/profileOptions.ts) map onto routing tags, so the Step 8 routing engine compares
 * like with like. Pure data; every profile option is mapped (tested).
 */
export const PROFILE_ACTIVITY_TAGS: Record<
  (typeof FINANCIAL_ACTIVITY_VALUES)[number],
  readonly ActivityTag[]
> = {
  online_shopping: ["online_shopping"],
  online_selling: ["online_selling"],
  freelance_payments: ["freelancing"],
  sending_invoices: ["sending_invoices"],
  receiving_invoices: ["receiving_invoices", "paying_invoices"],
  job_applications: ["job_seeking"],
  business_purchases: ["business_purchasing"],
  subscription_payments: ["subscriptions"],
  investments: ["investments"],
  digital_wallet_usage: ["digital_wallet_usage", "account_security"],
  // "Other" has no fixed tags: its description is interpreted (exact label match, else Gemini) in src/lib/routing.
  other: [],
};
export const PROFILE_CONTEXT_TAG: Record<(typeof OCCUPATION_VALUES)[number], ContextTag> = {
  student: "student",
  employed_professional: "employed_professional",
  freelancer: "freelancer",
  business_owner: "business_owner",
  self_employed: "self_employed",
  job_seeker: "job_seeker",
  retired: "retired",
  other: "general_consumer",
};

/**
 * Profile fields Step 8 personalization may read. Free text (custom descriptions, goal) is sanitized, length-capped,
 * and passed to Gemini as untrusted data only. Never email, income, country, or anything about money.
 */
export const PERSONALIZATION_FIELDS = [
  "displayName",
  "occupation",
  "customOccupation",
  "financialActivities",
  "customActivity",
  "paymentExperience",
  "financialGoal",
  "customGoal",
  "ageBracket",
] as const;

/**
 * Recovery Playbook section IDs (the sections listed on /playbook). The verified content arrives in Phase 10; the
 * IDs are stable so scenarios can reference them now (R21, R30).
 */
export const RECOVERY_POLICY_IDS = [
  "unauthorized-activity",
  "disputes",
  "protection",
  "secure-account",
  "report-further",
] as const;

/* ------------------------------------------------------------------------------------- authored answer key */

const weight = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const textSchema = z.string().min(1).max(1200);

export const evidenceSchema = z.object({
  evidenceId: idSchema,
  /** The anchor (data-sim-anchor) of the element this evidence is about. Stable across personalization. */
  targetElementId: anchorSchema,
  evidenceType: z.enum(["red_flag", "worth_verifying", "positive_verification_evidence"]),
  title: textSchema,
  explanation: textSchema,
  educationalImportance: z.enum(["core", "supporting"]),
  associatedCorrectDecisionRules: z.array(idSchema).min(1),
  /** Weight in the 30-point reasoning score (R13). */
  weight,
  /** Phrases the deterministic fallback evaluator looks for in the explanation (Phase 6 / Step 8). */
  keywords: z.array(z.string().min(2).max(60)).min(2),
});
export type EvidenceDefinition = z.infer<typeof evidenceSchema>;

export const correctDecisionRuleSchema = z.object({
  ruleId: idSchema,
  description: textSchema,
  /** Decisions that satisfy this rule (all are "correct" for the 40-point decision component). */
  decisionIds: z.array(idSchema).min(1),
});

/** Optional references to verified fraud research (Step 6 brief §6). Empty until a real source is cited. */
export const evidenceReferenceSchema = z.object({
  title: textSchema,
  publisher: textSchema,
  url: z.string().url(),
  accessedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const authoredAnswerKeySchema = z.object({
  scenarioKey: z.enum(["m1-s1", "m1-s2", "m2-s1", "m2-s2", "m3-s1", "m3-s2"]),
  primaryCategory: z.enum(SCAM_CATEGORIES),
  secondaryCategoryTags: z.array(z.enum(SCAM_CATEGORIES)).default([]),
  learningObjectives: z.array(textSchema).min(2),
  activityTags: z.array(z.enum(ACTIVITY_TAGS)).min(1),
  contextTags: z.array(z.enum(CONTEXT_TAGS)).min(1),
  difficulty: z.object({
    recommendedExperienceLevel: z.enum(["new", "occasional", "frequent"]),
    interactionComplexity: z.enum(["low", "medium", "high"]),
    numberOfDecisionPoints: z.number().int().min(1).max(10),
  }),
  evidenceReferences: z.array(evidenceReferenceSchema).default([]),
  /** Fixed ground truth (R13). "legitimate" scenarios exist (R17). */
  fixedScamStatus: z.enum(["fraudulent", "legitimate"]),
  fixedCorrectDecisionRules: z.array(correctDecisionRuleSchema).min(1),
  evidenceDefinitions: z.array(evidenceSchema).min(3),
  /** Verification behaviour for the 20-point component, by action ID with weights. */
  verificationActions: z.array(z.object({ actionId: idSchema, weight })).min(1),
  /** Decisions/actions that are unsafe payment or credential behaviour (10-point component). */
  unsafeActionIds: z.array(idSchema),
  /** Decision IDs that start a PayPal Sandbox checkout when chosen (R12). */
  payableDecisionIds: z.array(idSchema),
  /** What the payment means in the debrief: spending (legitimate purchase) or a loss to the scam. */
  paymentOutcome: z.enum(["spending", "fraud_loss", "none"]),
  recoveryPolicyIds: z.array(z.enum(RECOVERY_POLICY_IDS)).min(1),
  /** Deterministic text used when Gemini is unavailable (R27). Never policy, statistics, or refund promises (R30). */
  fallbackContent: z.object({
    outcomeByDecision: z.record(idSchema, textSchema),
    feedbackCorrect: textSchema,
    feedbackIncorrect: textSchema,
    safestNextStep: textSchema,
    keyLessons: z.array(textSchema).min(2),
  }),
});
export type AuthoredAnswerKey = z.infer<typeof authoredAnswerKeySchema>;
export type AuthoredAnswerKeyInput = z.input<typeof authoredAnswerKeySchema>;

/* ------------------------------------------------------------------------------------- assembled template */

export interface ScenarioTemplate {
  scenarioId: ScenarioRender["scenarioKey"];
  moduleId: string;
  title: string;
  interfaceType: ScenarioRender["interfaceType"];
  neutralIntroduction: string;
  difficulty: {
    moduleDifficulty: "Beginner" | "Intermediate" | "Advanced";
    recommendedExperienceLevel: AuthoredAnswerKey["difficulty"]["recommendedExperienceLevel"];
    interactionComplexity: AuthoredAnswerKey["difficulty"]["interactionComplexity"];
    numberOfDecisionPoints: number;
    /** The verification actions the rubric rewards (derived from the answer key). */
    requiredVerificationActions: string[];
  };
  primaryCategory: ScamCategory;
  secondaryCategoryTags: ScamCategory[];
  learningObjectives: string[];
  activityTags: ActivityTag[];
  contextTags: ContextTag[];
  supportedPersonalizationFields: readonly (typeof PERSONALIZATION_FIELDS)[number][];
  personalizationSlots: ScenarioRender["slots"];
  evidenceReferences: z.infer<typeof evidenceReferenceSchema>[];
  allowedActions: string[];
  investigationActions: string[];
  decisionOptions: string[];
  conversationBranches: string[];
  fixedScamStatus: AuthoredAnswerKey["fixedScamStatus"];
  fixedCorrectDecisionRules: AuthoredAnswerKey["fixedCorrectDecisionRules"];
  evidenceDefinitions: EvidenceDefinition[];
  evaluationRubric: {
    correctDecisionIds: string[];
    evidence: { id: string; weight: 1 | 2 | 3 }[];
    verificationActions: { id: string; weight: 1 | 2 | 3 }[];
    unsafeActionIds: string[];
  };
  paymentConfiguration: {
    payableDecisionIds: string[];
    /** Basis points of the module's starting Training Funds (src/content/modules.ts, R19). */
    basisPoints: number;
    amountSource: "module_starting_funds";
    outcome: AuthoredAnswerKey["paymentOutcome"];
  };
  recoveryPolicyIds: AuthoredAnswerKey["recoveryPolicyIds"];
  completionRequirements: {
    requiresFinalDecision: true;
    requiresExplanation: true;
    explanationMinChars: number;
    explanationMaxChars: number;
    /** A pay decision must resolve its checkout (captured, or cancelled and then finalized) before evaluation. */
    payDecisionsRequireCheckoutResolution: boolean;
  };
  fallbackContent: AuthoredAnswerKey["fallbackContent"] & {
    personalizationDefaults: Record<string, string>;
  };
  render: ScenarioRender;
}
