import { describe, expect, it } from "vitest";
import {
  DEFAULT_CURRENCY,
  formatMoney,
  getCurrency,
  isSupportedCurrency,
  minorToMajorString,
  parseMajorToMinor,
  PAYPAL_CURRENCIES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_CURRENCY_CODES,
} from "./currency";

describe("currency allowlist", () => {
  it("defaults to USD and lists it first", () => {
    expect(DEFAULT_CURRENCY).toBe("USD");
    expect(SUPPORTED_CURRENCY_CODES[0]).toBe("USD");
  });

  it("matches PayPal's documented list of 24 REST currencies", () => {
    expect(PAYPAL_CURRENCIES).toHaveLength(24);
    expect(new Set(PAYPAL_CURRENCIES.map((c) => c.code)).size).toBe(24);
  });

  it("only enables PayPal-documented, non-in-country-only currencies", () => {
    for (const c of SUPPORTED_CURRENCIES) {
      expect(PAYPAL_CURRENCIES.find((p) => p.code === c.code)).toBeDefined();
      expect(c.inCountryOnly).toBe(false);
    }
  });

  it("records PayPal's zero-decimal currencies", () => {
    const zero = PAYPAL_CURRENCIES.filter((c) => c.minorUnitDigits === 0).map((c) => c.code);
    expect(zero.sort()).toEqual(["HUF", "JPY", "TWD"]);
  });

  it("rejects unsupported and malformed codes", () => {
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(isSupportedCurrency("JPY")).toBe(false); // documented by PayPal, not yet enabled
    expect(isSupportedCurrency("BTC")).toBe(false);
    expect(isSupportedCurrency("usd")).toBe(false);
    expect(isSupportedCurrency(42)).toBe(false);
    expect(() => getCurrency("XYZ")).toThrow();
  });
});

describe("money parsing without floats (R38)", () => {
  it("parses major-unit strings into integer minor units", () => {
    expect(parseMajorToMinor("1500", "USD")).toBe(150_000);
    expect(parseMajorToMinor("1,500.5", "USD")).toBe(150_050);
    expect(parseMajorToMinor(" 0.07 ", "EUR")).toBe(7);
    expect(parseMajorToMinor("0.1", "USD")).toBe(10);
  });

  it("rejects invalid input", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e5", "1.2.3", "$10"]) {
      expect(parseMajorToMinor(bad, "USD"), bad).toBeNull();
    }
  });

  it("round-trips through minorToMajorString", () => {
    expect(minorToMajorString(150_050, "USD")).toBe("1500.50");
    expect(minorToMajorString(7, "USD")).toBe("0.07");
    expect(parseMajorToMinor(minorToMajorString(123_456, "GBP"), "GBP")).toBe(123_456);
  });

  it("formats with the locale and currency", () => {
    expect(formatMoney(150_050, "USD")).toBe("$1,500.50");
    expect(formatMoney(150_050, "EUR", "de-DE")).toBe("1.500,50 €");
  });
});
