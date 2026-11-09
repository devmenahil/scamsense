import type { Profile, ProfileDraft, ProfileInput } from "./schema";

/**
 * Pure mapping between the `public.profiles` row (snake_case) and the app's Profile shape. Kept separate from the
 * Supabase calls so it can be unit-tested.
 */

export const PROFILE_COLUMNS =
  "display_name, age_bracket, occupation, custom_occupation, country, custom_activity, financial_activities, payment_experience, income_bracket, " +
  "income_bracket_label, financial_goal, custom_goal, goal_amount_minor, preferred_currency, onboarding_completed, " +
  "created_at, updated_at";

/** The pre-Step-8 column list, used only while the Step 8 migration hasn't been applied yet. */
export const LEGACY_PROFILE_COLUMNS = PROFILE_COLUMNS.replace("custom_occupation, ", "").replace(
  "custom_activity, ",
  "",
);

/** Postgres "undefined column" / PostgREST "column not in schema cache": the Step 8 migration isn't applied. */
export function isMissingColumnError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

export interface ProfileRow {
  display_name: string;
  age_bracket: string | null;
  occupation: string | null;
  /** Added by the Step 8 migration; absent (undefined) only if a query omits it. */
  custom_occupation?: string | null;
  country: string | null;
  custom_activity?: string | null;
  financial_activities: string[] | null;
  payment_experience: string | null;
  income_bracket: string | null;
  income_bracket_label: string | null;
  financial_goal: string | null;
  custom_goal: string | null;
  /** bigint arrives as a number (safe: constrained to ≤ 1e9) or, from some drivers, a string. */
  goal_amount_minor: number | string | null;
  preferred_currency: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export function rowToProfile(row: ProfileRow): Profile {
  return {
    displayName: row.display_name,
    ageBracket: row.age_bracket as Profile["ageBracket"],
    occupation: row.occupation as Profile["occupation"],
    customOccupation: row.custom_occupation ?? null,
    country: row.country,
    customActivity: row.custom_activity ?? null,
    financialActivities: (row.financial_activities ?? []) as Profile["financialActivities"],
    paymentExperience: row.payment_experience as Profile["paymentExperience"],
    incomeBracket: row.income_bracket as Profile["incomeBracket"],
    incomeBracketLabel: row.income_bracket_label,
    financialGoal: row.financial_goal as Profile["financialGoal"],
    customGoal: row.custom_goal,
    goalAmountMinor: row.goal_amount_minor === null ? null : Number(row.goal_amount_minor),
    preferredCurrency: row.preferred_currency,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Full update (finish onboarding / edit profile). Never includes user_id: ownership comes from the session. */
export function inputToRow(input: ProfileInput) {
  return {
    display_name: input.displayName,
    ...(input.ageBracket !== undefined ? { age_bracket: input.ageBracket } : {}),
    occupation: input.occupation,
    custom_occupation: input.customOccupation,
    country: input.country,
    financial_activities: input.financialActivities,
    custom_activity: input.customActivity,
    payment_experience: input.paymentExperience,
    income_bracket: input.incomeBracket,
    financial_goal: input.financialGoal,
    custom_goal: input.customGoal,
    goal_amount_minor: input.goalAmountMinor,
    preferred_currency: input.preferredCurrency,
    onboarding_completed: true,
  };
}

/** Partial onboarding save (steps 1–2). Only provided keys are written. */
export function draftToRow(draft: ProfileDraft) {
  const row: Record<string, unknown> = {};
  if (draft.displayName !== undefined) row.display_name = draft.displayName;
  if (draft.occupation !== undefined) {
    row.occupation = draft.occupation;
    // The description travels with its option; it is cleared when "Other" is not selected.
    row.custom_occupation = draft.occupation === "other" ? (draft.customOccupation ?? null) : null;
  }
  if (draft.country !== undefined) row.country = draft.country;
  if (draft.financialActivities !== undefined) {
    row.financial_activities = draft.financialActivities;
    row.custom_activity = draft.financialActivities.includes("other") ? (draft.customActivity ?? null) : null;
  }
  if (draft.paymentExperience !== undefined) row.payment_experience = draft.paymentExperience;
  return row;
}

/** Which onboarding step a returning user should resume at (0-based). */
export function resumeStep(p: Profile): 0 | 1 | 2 {
  if (!p.occupation || !p.country || (p.occupation === "other" && !p.customOccupation)) return 0;
  if (
    p.financialActivities.length === 0 ||
    !p.paymentExperience ||
    (p.financialActivities.includes("other") && !p.customActivity)
  )
    return 1;
  return 2;
}
