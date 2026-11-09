import { describe, expect, it } from "vitest";
import { PAYPAL_CURRENCIES, SUPPORTED_CURRENCIES } from "@/lib/domain/currency";
import { hasReferenceRate, parseRate } from "@/lib/domain/exchange";
import { ECB_RATES_PER_EUR, EXCHANGE_RATE_SOURCE } from "./exchangeRates";

describe("exchange-rate configuration", () => {
  it("documents its official source and dates", () => {
    expect(EXCHANGE_RATE_SOURCE.url).toMatch(/^https:\/\/www\.ecb\.europa\.eu\//);
    expect(EXCHANGE_RATE_SOURCE.referenceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("every enabled currency has a valid reference rate", () => {
    for (const c of SUPPORTED_CURRENCIES) expect(hasReferenceRate(c.code), c.code).toBe(true);
  });

  it("only lists PayPal currencies (plus the EUR base) with parseable rates", () => {
    const paypal = new Set(PAYPAL_CURRENCIES.map((c) => c.code));
    for (const [code, rate] of Object.entries(ECB_RATES_PER_EUR)) {
      expect(paypal.has(code), code).toBe(true);
      expect(() => parseRate(rate)).not.toThrow();
    }
  });
});
