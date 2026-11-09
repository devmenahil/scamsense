/**
 * Display formatting for money held as integer minor units (R38). No arithmetic happens here: the integer is split
 * into whole and fractional parts with BigInt-free integer math and only then handed to Intl for presentation.
 */
export function formatMinorUnits(
  amountMinor: number,
  currency: string,
  minorUnitDigits: number,
  /** BCP 47 locale for separators and symbol placement. Defaults to en-US for deterministic server output. */
  locale: string = "en-US",
): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error("amountMinor must be a safe integer");
  if (!Number.isInteger(minorUnitDigits) || minorUnitDigits < 0 || minorUnitDigits > 3) {
    throw new Error("minorUnitDigits must be 0–3");
  }
  const divisor = 10 ** minorUnitDigits;
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const whole = Math.trunc(abs / divisor);
  const fraction = abs % divisor;
  const decimalString =
    minorUnitDigits === 0 ? `${whole}` : `${whole}.${String(fraction).padStart(minorUnitDigits, "0")}`;
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnitDigits,
    maximumFractionDigits: minorUnitDigits,
  }).format(decimalString as `${number}`);
  return negative ? `−${formatted}` : formatted;
}
