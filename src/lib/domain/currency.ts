/**
 * Centralized currency configuration (R4, R38). The single source of truth for every feature that touches money:
 * onboarding/profile, dashboard, scenario engine, fictional training wallet, PayPal Sandbox checkout, financial
 * impact calculations, and reports.
 *
 * SOURCE: PayPal REST API currency codes, https://developer.paypal.com/reference/currency-codes/
 * (page "Last updated: August 17, 2026", transcribed 2026-11-09). All 24 documented currencies are listed below with
 * PayPal's own restrictions. Nothing here is invented.
 *
 * ENABLED ALLOWLIST — USD ONLY (product decision, Step 5 review, 2026-11-09): which currencies the configured PayPal
 * Sandbox merchant and Checkout integration accept has NOT been verified yet (no PayPal credentials until Phase 5).
 * PayPal support must not be assumed, so USD is the only selectable currency until each other currency is tested
 * end to end in Sandbox. To enable one after that test:
 *   1. set `enabled: true` below (it must also have a reference rate in src/content/exchangeRates.ts), and
 *   2. add the code to the `profiles_preferred_currency_check` constraint in a new Supabase migration.
 * `currency.test.ts` fails if those two lists drift apart.
 *
 * Pure module: safe to import on the client and the server.
 */
import { formatMinorUnits } from "../format";

export interface CurrencyDefinition {
  /** ISO 4217 code, as used by PayPal. */
  code: string;
  /** English name as listed by PayPal. */
  name: string;
  /** Digits after the decimal point. PayPal marks HUF, JPY, TWD as zero-digit ("no decimal places or fractions"). */
  minorUnitDigits: 0 | 2;
  /** PayPal footnote: supported only for in-country PayPal accounts (BRL, CNY, MYR). */
  inCountryOnly: boolean;
  /** Offered to users. Only true once considered safe for the configured Sandbox merchant (see header). */
  enabled: boolean;
}

export const PAYPAL_CURRENCY_SOURCE = {
  url: "https://developer.paypal.com/reference/currency-codes/",
  pageLastUpdated: "2026-08-17",
  transcribedOn: "2026-11-09",
} as const;

export const DEFAULT_CURRENCY = "USD";

/** Every PayPal-documented REST currency. `enabled` marks the user-selectable allowlist (USD only for now). */
export const PAYPAL_CURRENCIES: readonly CurrencyDefinition[] = [
  { code: "AUD", name: "Australian dollar", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "BRL", name: "Brazilian real", minorUnitDigits: 2, inCountryOnly: true, enabled: false },
  { code: "CAD", name: "Canadian dollar", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "CNY", name: "Chinese Renminbi", minorUnitDigits: 2, inCountryOnly: true, enabled: false },
  { code: "CZK", name: "Czech koruna", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "DKK", name: "Danish krone", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "EUR", name: "Euro", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "HKD", name: "Hong Kong dollar", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "HUF", name: "Hungarian forint", minorUnitDigits: 0, inCountryOnly: false, enabled: false },
  { code: "ILS", name: "Israeli new shekel", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "JPY", name: "Japanese yen", minorUnitDigits: 0, inCountryOnly: false, enabled: false },
  { code: "MYR", name: "Malaysian ringgit", minorUnitDigits: 2, inCountryOnly: true, enabled: false },
  { code: "MXN", name: "Mexican peso", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "TWD", name: "New Taiwan dollar", minorUnitDigits: 0, inCountryOnly: false, enabled: false },
  { code: "NZD", name: "New Zealand dollar", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "NOK", name: "Norwegian krone", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "PHP", name: "Philippine peso", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "PLN", name: "Polish złoty", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "GBP", name: "Pound sterling", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "SGD", name: "Singapore dollar", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "SEK", name: "Swedish krona", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "CHF", name: "Swiss franc", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "THB", name: "Thai baht", minorUnitDigits: 2, inCountryOnly: false, enabled: false },
  { code: "USD", name: "US dollar", minorUnitDigits: 2, inCountryOnly: false, enabled: true },
];

/** Currencies users may choose, USD first, then alphabetical by code. */
export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] = PAYPAL_CURRENCIES.filter(
  (c) => c.enabled,
).sort((a, b) =>
  a.code === DEFAULT_CURRENCY ? -1 : b.code === DEFAULT_CURRENCY ? 1 : a.code.localeCompare(b.code),
);

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code) as [string, ...string[]];

export function isSupportedCurrency(code: unknown): code is string {
  return typeof code === "string" && SUPPORTED_CURRENCY_CODES.includes(code);
}

/**
 * Any PayPal-documented currency (enabled or not). For DISPLAY and arithmetic of stored amounts only, so records made
 * in a currency that is later disabled still render correctly. Never use it to validate a user's choice.
 */
export function getPayPalCurrency(code: string): CurrencyDefinition {
  const c = PAYPAL_CURRENCIES.find((x) => x.code === code);
  if (!c) throw new Error(`Not a PayPal currency: ${code}`);
  return c;
}

/** A user-selectable (enabled) currency. Throws for anything else: use this for validation. */
export function getCurrency(code: string): CurrencyDefinition {
  const c = SUPPORTED_CURRENCIES.find((x) => x.code === code);
  if (!c) throw new Error(`Unsupported currency: ${code}`);
  return c;
}

/** Select options for UI ("USD: US dollar"). */
export const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map((c) => ({
  value: c.code,
  label: `${c.code}: ${c.name}`,
}));

/**
 * Parses a user-typed major-unit amount ("1,250.50") into integer minor units WITHOUT floating-point arithmetic
 * (R38). Returns null for anything that is not a plain non-negative decimal with at most the currency's digits.
 */
export function parseMajorToMinor(input: string, currencyCode: string): number | null {
  const { minorUnitDigits } = getPayPalCurrency(currencyCode);
  const cleaned = input.trim().replace(/[,\s]/g, "");
  const pattern = minorUnitDigits === 0 ? /^\d{1,12}$/ : /^\d{1,12}(\.\d{1,2})?$/;
  if (!pattern.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const minor = Number(whole + fraction.padEnd(minorUnitDigits, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Inverse of parseMajorToMinor for prefilling inputs ("1250.50"). Integer string math only. */
export function minorToMajorString(minor: number, currencyCode: string): string {
  const { minorUnitDigits } = getPayPalCurrency(currencyCode);
  if (minorUnitDigits === 0) return String(minor);
  const s = String(minor).padStart(minorUnitDigits + 1, "0");
  return `${s.slice(0, -minorUnitDigits)}.${s.slice(-minorUnitDigits)}`;
}

/** Locale-aware display of an integer minor-unit amount in a supported currency. */
export function formatMoney(amountMinor: number, currencyCode: string, locale?: string): string {
  return formatMinorUnits(amountMinor, currencyCode, getPayPalCurrency(currencyCode).minorUnitDigits, locale);
}
