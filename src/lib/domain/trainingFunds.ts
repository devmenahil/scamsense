/**
 * Training-funds calculations (R18–R20, R38). Deterministic and pure: the scenario engine and API routes call these;
 * Gemini never does (R32).
 *
 * Pipeline: income bracket → USD baseline (whole dollars) → fixed reference rate → whole units of the module currency
 * (stored in minor units on the module run) → scenario amount = slot % of that, rounded to the currency's PayPal
 * minor unit. The currency is snapshotted when the module starts and never changes during that module.
 */
import { getScenarioSlot } from "@/content/modules";
import { INCOME_BRACKET_VALUES, type IncomeBracket } from "@/content/profileOptions";
import { DEFAULT_TRAINING_BUDGET_USD, TRAINING_BUDGET_USD_BY_INCOME } from "@/content/trainingFunds";
import { DEFAULT_CURRENCY, isSupportedCurrency } from "./currency";
import { convertWholeUsdToWholeUnits } from "./exchange";
import { MoneyError, percentOfMinor } from "./money";

export interface StartingFunds {
  currency: string;
  startingFundsMinor: number;
  /** The USD baseline the amount was converted from, in whole US dollars (for transparency and reports). */
  baselineUsd: number;
  /** How the baseline was chosen ("Based on your income range" / "Default budget"). */
  basis: "income_bracket" | "default";
}

function isIncomeBracket(v: unknown): v is IncomeBracket {
  return typeof v === "string" && (INCOME_BRACKET_VALUES as readonly string[]).includes(v);
}

/** The USD baseline for an (optional) income bracket. */
export function baselineUsdFor(incomeBracket: string | null | undefined): {
  baselineUsd: number;
  basis: StartingFunds["basis"];
} {
  const known = isIncomeBracket(incomeBracket) && incomeBracket !== "prefer_not_to_say";
  return known
    ? { baselineUsd: TRAINING_BUDGET_USD_BY_INCOME[incomeBracket as IncomeBracket], basis: "income_bracket" }
    : { baselineUsd: DEFAULT_TRAINING_BUDGET_USD, basis: "default" };
}

/**
 * Starting funds in a given currency, WITHOUT checking the user-selectable allowlist (the currency only needs a
 * reference rate). Used by `calculateStartingFunds` and by tests that prove conversions for future currencies.
 */
export function startingFundsIn(incomeBracket: string | null | undefined, currency: string): StartingFunds {
  const { baselineUsd, basis } = baselineUsdFor(incomeBracket);
  return {
    currency,
    startingFundsMinor: convertWholeUsdToWholeUnits(baselineUsd, currency),
    baselineUsd,
    basis,
  };
}

/**
 * The starting training funds for a module that starts now, from the profile's optional income bracket and saved
 * preferred currency. A currency that isn't on the server allowlist falls back to USD (never trusted from a client).
 * The result is snapshotted on the module run, so later profile edits only affect modules that start afterwards.
 */
export function calculateStartingFunds(profile: {
  incomeBracket: string | null | undefined;
  preferredCurrency: string | null | undefined;
}): StartingFunds {
  const currency = isSupportedCurrency(profile.preferredCurrency)
    ? profile.preferredCurrency
    : DEFAULT_CURRENCY;
  return startingFundsIn(profile.incomeBracket, currency);
}

/** The amount at stake in a scenario: its configured percentage of the module run's starting funds. */
export function scenarioAmountMinor(scenarioKey: string, moduleStartingFundsMinor: number): number {
  const slot = getScenarioSlot(scenarioKey);
  if (!slot) throw new MoneyError(`Unknown scenario: ${scenarioKey}`);
  return percentOfMinor(moduleStartingFundsMinor, slot.paymentBasisPoints);
}
