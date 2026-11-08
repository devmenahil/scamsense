/**
 * Onboarding option lists (PRODUCT_SPEC §2.1, R2–R4). Adult brackets only: no option below 18 exists.
 * The currency list is a Phase 1 placeholder (USD only) until the PayPal Sandbox allowlist lands in Phase 2.
 */
export type Option = { value: string; label: string };

export const AGE_BRACKETS: readonly Option[] = [
  { value: "18-24", label: "18–24" },
  { value: "25-34", label: "25–34" },
  { value: "35-44", label: "35–44" },
  { value: "45-54", label: "45–54" },
  { value: "55-64", label: "55–64" },
  { value: "65+", label: "65 or older" },
];

export const LIFE_STAGES: readonly Option[] = [
  { value: "student", label: "Student" },
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "freelancer", label: "Freelancer" },
  { value: "small_business_owner", label: "Small-business owner" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
];

export const FINANCIAL_ACTIVITIES: readonly Option[] = [
  { value: "online_shopping", label: "Online shopping" },
  { value: "selling_online", label: "Selling online" },
  { value: "freelancing", label: "Freelancing / invoicing" },
  { value: "family_transfers", label: "Sending money to family" },
  { value: "paying_bills", label: "Paying bills" },
  { value: "investing", label: "Investing" },
  { value: "job_seeking", label: "Job seeking" },
];

export const PAYMENT_EXPERIENCE: readonly Option[] = [
  { value: "new", label: "New to digital payments" },
  { value: "occasional", label: "Occasional" },
  { value: "regular", label: "Regular" },
  { value: "very_experienced", label: "Very experienced" },
];

export const FINANCIAL_GOALS: readonly Option[] = [
  { value: "protect_savings", label: "Protect my savings" },
  { value: "shop_safely", label: "Shop and sell online safely" },
  { value: "grow_business", label: "Grow my business safely" },
  { value: "help_family", label: "Help my family avoid scams" },
  { value: "build_confidence", label: "Feel more confident with digital payments" },
  { value: "other", label: "Something else" },
];

export const INCOME_BRACKETS: readonly Option[] = [
  { value: "prefer_not", label: "Prefer not to say" },
  { value: "under_25k", label: "Under $25,000" },
  { value: "25k_50k", label: "$25,000–$49,999" },
  { value: "50k_100k", label: "$50,000–$99,999" },
  { value: "100k_plus", label: "$100,000 or more" },
];

/** Phase 1 placeholder. Replaced by the verified PayPal Sandbox allowlist (src/lib/domain/currency.ts) in Phase 2. */
export const CURRENCIES_PLACEHOLDER: readonly Option[] = [{ value: "USD", label: "USD: US dollar" }];
