import { z } from "zod";
import { COUNTRY_CODES } from "@/content/countries";
import {
  AGE_BRACKET_VALUES,
  CUSTOM_ACTIVITY_MAX,
  CUSTOM_GOAL_MAX,
  CUSTOM_OCCUPATION_MAX,
  CUSTOM_TEXT_MIN,
  DISPLAY_NAME_MAX,
  FINANCIAL_ACTIVITY_VALUES,
  FINANCIAL_GOAL_VALUES,
  GOAL_AMOUNT_MAX_MAJOR,
  INCOME_BRACKET_VALUES,
  OCCUPATION_VALUES,
  PAYMENT_EXPERIENCE_VALUES,
  type AgeBracket,
  type FinancialActivity,
  type FinancialGoal,
  type IncomeBracket,
  type Occupation,
  type PaymentExperience,
} from "@/content/profileOptions";
import { getCurrency, parseMajorToMinor, SUPPORTED_CURRENCY_CODES } from "@/lib/domain/currency";

/**
 * Profile validation shared by the browser forms and the API route handlers (the server always re-validates).
 * The Supabase `profiles` check constraints enforce the same rules a third time, so direct Data API writes cannot
 * store invalid values either.
 */

/** Blank optional strings from forms become null. */
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const displayNameSchema = z
  .string({ error: "Enter a display name." })
  .trim()
  .min(1, "Enter a display name.")
  .max(DISPLAY_NAME_MAX, `Keep your display name under ${DISPLAY_NAME_MAX} characters.`);

export const ageBracketSchema = z.preprocess(
  blankToNull,
  z.enum(AGE_BRACKET_VALUES, { error: "Choose an age bracket from the list." }).nullable(),
);

const occupationSchema = z.enum(OCCUPATION_VALUES, { error: "Choose the option that best describes you." });
const countrySchema = z.enum(COUNTRY_CODES, { error: "Choose your country of residence." });
const activitiesSchema = z
  .array(z.enum(FINANCIAL_ACTIVITY_VALUES, { error: "Choose activities from the list." }), {
    error: "Pick at least one activity.",
  })
  .min(1, "Pick at least one activity.")
  .max(FINANCIAL_ACTIVITY_VALUES.length)
  .refine((a) => new Set(a).size === a.length, "Each activity can be chosen once.");
const paymentExperienceSchema = z.enum(PAYMENT_EXPERIENCE_VALUES, {
  error: "Choose how often you use digital payments.",
});
const incomeBracketSchema = z.preprocess(
  blankToNull,
  z.enum(INCOME_BRACKET_VALUES, { error: "Choose an income bracket from the list." }).nullable(),
);
const financialGoalSchema = z.enum(FINANCIAL_GOAL_VALUES, { error: "Choose a financial goal." });
/**
 * Safe handling for free-text profile descriptions (Step 8): Unicode-normalized, control characters and markup/
 * template characters removed, whitespace collapsed. The text is still treated as UNTRUSTED data everywhere it is used
 * (never as instructions to Gemini, never logged).
 */
export function cleanCustomText(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const cleaned = v
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[<>{}\[\]`\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned === "" ? null : cleaned;
}

/** Optional free text: blank → null; max length enforced. Whether it is REQUIRED is decided per "Other" option. */
function customTextSchema(max: number) {
  return z
    .preprocess(
      (v) => (v === undefined ? null : cleanCustomText(v)),
      z.string().max(max, `Keep it under ${max} characters.`).nullable(),
    )
    .optional()
    .transform((v) => v ?? null);
}
const customGoalSchema = customTextSchema(CUSTOM_GOAL_MAX);
const customOccupationSchema = customTextSchema(CUSTOM_OCCUPATION_MAX);
const customActivitySchema = customTextSchema(CUSTOM_ACTIVITY_MAX);

/** A required "Other" description must be a meaningful phrase: at least a few characters including letters. */
export function isMeaningfulCustomText(v: string | null | undefined): boolean {
  return typeof v === "string" && v.length >= CUSTOM_TEXT_MIN && /\p{L}.*\p{L}/u.test(v);
}

type OtherFields = {
  occupation?: string;
  customOccupation?: string | null;
  financialActivities?: readonly string[];
  customActivity?: string | null;
  financialGoal?: string;
  customGoal?: string | null;
};

/** "Other" ⇒ a short description is required (Step 8 brief §2). Only checks the fields present in the value. */
function requireOtherDescriptions(v: OtherFields, ctx: z.RefinementCtx) {
  if (v.occupation === "other" && !isMeaningfulCustomText(v.customOccupation)) {
    ctx.addIssue({
      code: "custom",
      path: ["customOccupation"],
      message: "Briefly describe your occupation or life stage.",
    });
  }
  if (v.financialActivities?.includes("other") && !isMeaningfulCustomText(v.customActivity)) {
    ctx.addIssue({
      code: "custom",
      path: ["customActivity"],
      message: "Briefly describe your other financial activity.",
    });
  }
  if (v.financialGoal === "other" && !isMeaningfulCustomText(v.customGoal)) {
    ctx.addIssue({ code: "custom", path: ["customGoal"], message: "Briefly describe your goal." });
  }
}
export const currencySchema = z.enum(SUPPORTED_CURRENCY_CODES, {
  error: "Choose a currency from the list. Other currencies aren't supported yet.",
});
/** Major-unit amount as typed by the user ("1,500" / "1500.50"), converted to minor units below. */
const goalAmountInputSchema = z.preprocess(blankToNull, z.string().max(20).nullable());

/** Step 1 — About you. */
const aboutStepShape = z.object({
  displayName: displayNameSchema,
  occupation: occupationSchema,
  customOccupation: customOccupationSchema,
  country: countrySchema,
});
export const aboutStepSchema = aboutStepShape.superRefine(requireOtherDescriptions);

/** Step 2 — Your financial activities. */
const activitiesStepShape = z.object({
  financialActivities: activitiesSchema,
  customActivity: customActivitySchema,
  paymentExperience: paymentExperienceSchema,
});
export const activitiesStepSchema = activitiesStepShape.superRefine(requireOtherDescriptions);

/** Step 3 — Your financial goals. */
const goalsStepShape = z.object({
  incomeBracket: incomeBracketSchema,
  financialGoal: financialGoalSchema,
  customGoal: customGoalSchema,
  goalAmount: goalAmountInputSchema,
  preferredCurrency: currencySchema,
});
export const goalsStepSchema = goalsStepShape.superRefine(requireOtherDescriptions);

/**
 * Full profile (PUT /api/profile): finishing onboarding and edits on My Profile. Converts the goal amount into
 * integer minor units of the chosen currency without floating-point math (R38).
 */
export const profileInputSchema = aboutStepShape
  .extend(activitiesStepShape.shape)
  .extend(goalsStepShape.shape)
  .extend({ ageBracket: ageBracketSchema.optional() })
  .strict()
  .superRefine(requireOtherDescriptions)
  .transform((v, ctx) => {
    let goalAmountMinor: number | null = null;
    if (v.goalAmount !== null) {
      goalAmountMinor = parseMajorToMinor(v.goalAmount, v.preferredCurrency);
      const max = GOAL_AMOUNT_MAX_MAJOR * 10 ** getCurrency(v.preferredCurrency).minorUnitDigits;
      if (goalAmountMinor === null || goalAmountMinor <= 0 || goalAmountMinor > max) {
        ctx.addIssue({
          code: "custom",
          path: ["goalAmount"],
          message:
            getCurrency(v.preferredCurrency).minorUnitDigits === 0
              ? "Enter a whole number greater than zero, without decimals."
              : "Enter an amount greater than zero, like 1500 or 1500.50.",
        });
        return z.NEVER;
      }
    }
    return {
      displayName: v.displayName,
      ageBracket: v.ageBracket,
      occupation: v.occupation,
      // A description is only kept while its "Other" option is selected.
      customOccupation: v.occupation === "other" ? v.customOccupation : null,
      country: v.country,
      financialActivities: v.financialActivities,
      customActivity: v.financialActivities.includes("other") ? v.customActivity : null,
      paymentExperience: v.paymentExperience,
      incomeBracket: v.incomeBracket,
      financialGoal: v.financialGoal,
      customGoal: v.customGoal,
      preferredCurrency: v.preferredCurrency,
      goalAmountMinor,
    };
  });
export type ProfileInput = z.output<typeof profileInputSchema>;

/**
 * Partial save while onboarding is in progress (PATCH /api/profile): steps 1–2 are saved as the user moves on, so a
 * refresh or a later sign-in resumes where they left off. Step 3 finishes through the full PUT.
 */
export const profileDraftSchema = aboutStepShape
  .extend(activitiesStepShape.shape)
  .partial()
  .strict()
  .superRefine(requireOtherDescriptions)
  .transform((v) => ({
    ...v,
    ...(v.occupation !== undefined && v.occupation !== "other" ? { customOccupation: null } : {}),
    ...(v.financialActivities !== undefined && !v.financialActivities.includes("other")
      ? { customActivity: null }
      : {}),
  }));
export type ProfileDraft = z.output<typeof profileDraftSchema>;

/** Profile as returned to the browser (camelCase, no internal ids). */
export interface Profile {
  displayName: string;
  ageBracket: AgeBracket | null;
  occupation: Occupation | null;
  /** Description when occupation is "other" (Step 8). */
  customOccupation: string | null;
  country: string | null;
  financialActivities: FinancialActivity[];
  /** Description when financial activities include "other" (Step 8). */
  customActivity: string | null;
  paymentExperience: PaymentExperience | null;
  incomeBracket: IncomeBracket | null;
  incomeBracketLabel: string | null;
  financialGoal: FinancialGoal | null;
  customGoal: string | null;
  goalAmountMinor: number | null;
  preferredCurrency: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Turns Zod issues into `{ field: firstMessage }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
