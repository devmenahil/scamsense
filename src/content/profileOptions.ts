/**
 * Profile option lists (PRODUCT_SPEC §2.1, R3). Every option has a STABLE machine-readable `value` that is stored in
 * Supabase and used by later phases (deterministic scenario routing, narrative personalization, goal-based humor,
 * training-fund calculations). Labels are display text only and may change; values must not.
 *
 * Changing or adding a value requires a matching Supabase migration: the `profiles` check constraints mirror these
 * lists, and `profileOptions.test.ts` fails if they drift apart.
 *
 * None of these values is used to infer digital literacy or fraud susceptibility (PRODUCT_SPEC §2.1).
 */
export type Option<V extends string = string> = { value: V; label: string };

function values<const T extends readonly Option[]>(opts: T) {
  return opts.map((o) => o.value) as unknown as [T[number]["value"], ...T[number]["value"][]];
}

export function labelFor(options: readonly Option[], value: string | null | undefined): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? null;
}

/** Optional at sign-up. Adult brackets only; there is no option below 18. */
export const AGE_BRACKETS = [
  { value: "18_24", label: "18–24" },
  { value: "25_34", label: "25–34" },
  { value: "35_44", label: "35–44" },
  { value: "45_54", label: "45–54" },
  { value: "55_64", label: "55–64" },
  { value: "65_plus", label: "65 or older" },
] as const satisfies readonly Option[];
export const AGE_BRACKET_VALUES = values(AGE_BRACKETS);
export type AgeBracket = (typeof AGE_BRACKETS)[number]["value"];

export const OCCUPATIONS = [
  { value: "student", label: "Student" },
  { value: "employed_professional", label: "Employed professional" },
  { value: "freelancer", label: "Freelancer" },
  { value: "business_owner", label: "Business owner" },
  { value: "self_employed", label: "Self-employed" },
  { value: "job_seeker", label: "Job seeker" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];
export const OCCUPATION_VALUES = values(OCCUPATIONS);
export type Occupation = (typeof OCCUPATIONS)[number]["value"];

/** Primary input for the future scenario-routing engine (Step 8). */
export const FINANCIAL_ACTIVITIES = [
  { value: "online_shopping", label: "Online shopping" },
  { value: "online_selling", label: "Online selling" },
  { value: "freelance_payments", label: "Freelance payments" },
  { value: "sending_invoices", label: "Sending invoices" },
  { value: "receiving_invoices", label: "Receiving invoices" },
  { value: "job_applications", label: "Job applications" },
  { value: "business_purchases", label: "Business purchases" },
  { value: "subscription_payments", label: "Subscription payments" },
  { value: "investments", label: "Investments" },
  { value: "digital_wallet_usage", label: "General digital wallet usage" },
] as const satisfies readonly Option[];
export const FINANCIAL_ACTIVITY_VALUES = values(FINANCIAL_ACTIVITIES);
export type FinancialActivity = (typeof FINANCIAL_ACTIVITIES)[number]["value"];

export const PAYMENT_EXPERIENCE = [
  { value: "new", label: "New to digital payments" },
  { value: "occasional", label: "Occasionally use digital payments" },
  { value: "frequent", label: "Frequently use digital payments" },
] as const satisfies readonly Option[];
export const PAYMENT_EXPERIENCE_VALUES = values(PAYMENT_EXPERIENCE);
export type PaymentExperience = (typeof PAYMENT_EXPERIENCE)[number]["value"];

export const FINANCIAL_GOALS = [
  { value: "buying_laptop", label: "Buying a laptop" },
  { value: "vacation_travel", label: "Vacation or travel" },
  { value: "building_savings", label: "Building savings" },
  { value: "education", label: "Education" },
  { value: "business_growth", label: "Starting or growing a business" },
  { value: "paying_off_debt", label: "Paying off debt" },
  { value: "other", label: "Other / custom goal" },
] as const satisfies readonly Option[];
export const FINANCIAL_GOAL_VALUES = values(FINANCIAL_GOALS);
export type FinancialGoal = (typeof FINANCIAL_GOALS)[number]["value"];

/**
 * Optional MONTHLY income brackets. Never an exact amount. Ranges are expressed in US dollars so the identifiers
 * stay stable across currencies; a later phase maps the identifier to an illustrative fictional training budget.
 * (Open question in PRODUCT_SPEC §12: whether brackets should be localized per currency.)
 */
export const INCOME_BRACKETS = [
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "under_1000", label: "Under US$1,000 a month" },
  { value: "1000_2499", label: "US$1,000–2,499 a month" },
  { value: "2500_4999", label: "US$2,500–4,999 a month" },
  { value: "5000_9999", label: "US$5,000–9,999 a month" },
  { value: "10000_plus", label: "US$10,000 or more a month" },
] as const satisfies readonly Option[];
export const INCOME_BRACKET_VALUES = values(INCOME_BRACKETS);
export type IncomeBracket = (typeof INCOME_BRACKETS)[number]["value"];

export const DISPLAY_NAME_MAX = 60;
export const CUSTOM_GOAL_MAX = 120;
/** Upper bound for the optional goal amount, in major units (sanity limit, not a financial judgment). */
export const GOAL_AMOUNT_MAX_MAJOR = 10_000_000;
