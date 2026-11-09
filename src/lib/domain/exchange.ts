/**
 * USD → currency conversion for the Training Funds baseline (Step 5 review). Integer/BigInt arithmetic only (R38):
 * rates are parsed from their published decimal strings into scaled integers, and every result is rounded half-up.
 *
 * Pure module: safe on the client and the server.
 */
import { ECB_RATES_PER_EUR } from "@/content/exchangeRates";
import { getPayPalCurrency } from "./currency";
import { MoneyError } from "./money";

const RATE_SCALE_DIGITS = 6;

/** "1.1165" → BigInt(1116500) (× 10^6). Rejects anything that isn't a plain positive decimal with ≤ 6 fraction digits. */
export function parseRate(rate: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(rate)) throw new MoneyError(`Invalid rate: ${rate}`);
  const [whole, fraction = ""] = rate.split(".");
  const scaled = BigInt(whole + fraction.padEnd(RATE_SCALE_DIGITS, "0"));
  if (scaled <= BigInt(0)) throw new MoneyError("Rates must be positive");
  return scaled;
}

export function hasReferenceRate(currencyCode: string): boolean {
  return currencyCode in ECB_RATES_PER_EUR;
}

function rateOf(currencyCode: string): bigint {
  const r = ECB_RATES_PER_EUR[currencyCode];
  if (!r) throw new MoneyError(`No reference rate for ${currencyCode}`);
  return parseRate(r);
}

/** a / b rounded half-up, for non-negative BigInts. */
function divRound(a: bigint, b: bigint): bigint {
  return (BigInt(2) * a + b) / (BigInt(2) * b);
}

/**
 * Converts an amount in USD minor units (cents) into the target currency's minor units at the fixed reference rate,
 * rounded half-up to the target's PayPal precision. USD → USD is exact.
 */
export function convertUsdMinor(usdMinor: number, targetCode: string): number {
  if (!Number.isSafeInteger(usdMinor) || usdMinor < 0)
    throw new MoneyError("usdMinor must be a non-negative integer");
  if (targetCode === "USD") return usdMinor;
  const digits = BigInt(getPayPalCurrency(targetCode).minorUnitDigits);
  // target_minor = usd_minor / 100 × (target/EUR ÷ USD/EUR) × 10^digits
  const numerator = BigInt(usdMinor) * rateOf(targetCode) * BigInt(10) ** digits;
  const denominator = rateOf("USD") * BigInt(100);
  const result = Number(divRound(numerator, denominator));
  if (!Number.isSafeInteger(result)) throw new MoneyError("Converted amount is out of range");
  return result;
}

/**
 * Converts whole US dollars into WHOLE units of the target currency (rounded half-up), returned in minor units.
 * Used for starting budgets so they read as round, easy numbers (e.g. US$3,000 → £2,241).
 */
export function convertWholeUsdToWholeUnits(wholeUsd: number, targetCode: string): number {
  if (!Number.isSafeInteger(wholeUsd) || wholeUsd < 0)
    throw new MoneyError("wholeUsd must be a non-negative integer");
  const digits = getPayPalCurrency(targetCode).minorUnitDigits;
  const unit = 10 ** digits;
  if (targetCode === "USD") return wholeUsd * unit;
  const wholeTarget = Number(divRound(BigInt(wholeUsd) * rateOf(targetCode), rateOf("USD")));
  const minor = wholeTarget * unit;
  if (!Number.isSafeInteger(minor)) throw new MoneyError("Converted amount is out of range");
  return minor;
}
