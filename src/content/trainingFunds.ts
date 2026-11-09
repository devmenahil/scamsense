import type { IncomeBracket } from "./profileOptions";

/**
 * Starting Training Funds per module: a USD BASELINE in whole US dollars (approved by the product owner, Step 5 review).
 * These are fictional educational Training Funds (R18). They never represent the user's actual income, disposable
 * income, bank balance, or financial capacity, and they are never used to judge the user.
 *
 *   • income skipped or "prefer not to say" → US$3,000
 *   • otherwise roughly one month at the bracket's midpoint (lower bound for the open-ended top bracket)
 *
 * For any other currency the baseline is converted at the fixed reference rates in ./exchangeRates.ts and rounded to
 * whole units of that currency (src/lib/domain/trainingFunds.ts). The same number is never reused across currencies.
 */
export const DEFAULT_TRAINING_BUDGET_USD = 3_000;

export const TRAINING_BUDGET_USD_BY_INCOME: Readonly<Record<IncomeBracket, number>> = {
  prefer_not_to_say: DEFAULT_TRAINING_BUDGET_USD,
  under_1000: 500,
  "1000_2499": 1_750,
  "2500_4999": 3_750,
  "5000_9999": 7_500,
  "10000_plus": 10_000,
};
