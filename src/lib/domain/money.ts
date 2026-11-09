/**
 * Integer money arithmetic (R38). Every amount is a safe integer in the currency's minor units; no floating-point
 * value ever represents money. Percentages are integer basis points (1% = 100 bp).
 *
 * Pure module: safe on the client and the server.
 */
export const BASIS_POINTS_PER_WHOLE = 10_000;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function assertMinorUnits(amountMinor: number, label = "amount"): void {
  if (!Number.isSafeInteger(amountMinor))
    throw new MoneyError(`${label} must be a safe integer (minor units)`);
}

/**
 * `baseMinor × basisPoints / 10 000`, rounded half-up to a whole minor unit, using integer arithmetic only.
 * Rounding to the currency's own minor unit is exactly PayPal's amount precision for that currency (2 decimals for
 * USD/EUR/…, 0 for HUF/JPY/TWD), because minor-unit digits come from the PayPal currency table.
 */
export function percentOfMinor(baseMinor: number, basisPoints: number): number {
  assertMinorUnits(baseMinor, "baseMinor");
  if (baseMinor < 0) throw new MoneyError("baseMinor must not be negative");
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > BASIS_POINTS_PER_WHOLE) {
    throw new MoneyError("basisPoints must be an integer from 0 to 10000");
  }
  const product = baseMinor * basisPoints;
  assertMinorUnits(product, "intermediate product");
  return Math.floor((product + BASIS_POINTS_PER_WHOLE / 2) / BASIS_POINTS_PER_WHOLE);
}

/** Display helper for basis points ("12%", "12.5%"). Integer string math only. */
export function formatBasisPoints(basisPoints: number): string {
  const whole = Math.trunc(basisPoints / 100);
  const fraction = basisPoints % 100;
  if (fraction === 0) return `${whole}%`;
  return `${whole}.${String(fraction).padStart(2, "0").replace(/0$/, "")}%`;
}
