/**
 * Fixed reference exchange rates for converting the USD Training Funds baseline into other currencies (Step 5 review).
 *
 * SOURCE: European Central Bank, euro foreign exchange reference rates (daily XML feed)
 *   https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml
 * Reference date 2026-11-06, retrieved 2026-11-09. Values are copied exactly as published: units of each currency per
 * 1 EUR. A USD → X rate is the cross rate X_per_EUR / USD_per_EUR (computed with integer maths, never floats).
 *
 * These rates are FIXED on purpose (no live FX API in the MVP). They only size fictional educational Training Funds;
 * they are never presented as market rates or used for real money. To refresh them, replace the values and both
 * dates together from the same ECB publication.
 *
 * Only currencies the ECB publishes are listed. A currency without a rate here can never be enabled
 * (`exchangeRates.test.ts` enforces this for the enabled allowlist in src/lib/domain/currency.ts).
 */
export const EXCHANGE_RATE_SOURCE = {
  name: "European Central Bank euro foreign exchange reference rates",
  url: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
  referenceDate: "2026-11-06",
  retrievedOn: "2026-11-09",
} as const;

/** Units of currency per 1 EUR, as published (decimal strings, parsed without floating point). */
export const ECB_RATES_PER_EUR: Readonly<Record<string, string>> = {
  EUR: "1",
  USD: "1.1165",
  AUD: "1.6250",
  BRL: "6.1449",
  CAD: "1.5705",
  CHF: "0.9143",
  CNY: "7.4485",
  CZK: "24.350",
  DKK: "7.4752",
  GBP: "0.83415",
  HKD: "8.7505",
  HUF: "363.90",
  ILS: "3.5717",
  JPY: "176.77",
  MXN: "20.8828",
  MYR: "4.5319",
  NOK: "10.5260",
  NZD: "2.0141",
  PHP: "70.358",
  PLN: "4.3925",
  SEK: "11.0260",
  SGD: "1.4309",
  THB: "37.459",
  // TWD: not published by the ECB → cannot be enabled until a documented rate is added.
};
