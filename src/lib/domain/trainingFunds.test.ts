import { describe, expect, it } from "vitest";
import { MODULES } from "@/content/modules";
import { INCOME_BRACKET_VALUES } from "@/content/profileOptions";
import { DEFAULT_TRAINING_BUDGET_USD, TRAINING_BUDGET_USD_BY_INCOME } from "@/content/trainingFunds";
import { formatMoney } from "./currency";
import { convertUsdMinor, parseRate } from "./exchange";
import { formatBasisPoints, MoneyError, percentOfMinor } from "./money";
import { calculateStartingFunds, scenarioAmountMinor, startingFundsIn } from "./trainingFunds";

describe("money helpers (integer minor units only, R38)", () => {
  it("takes percentages in basis points with half-up rounding to a whole minor unit", () => {
    expect(percentOfMinor(300_000, 500)).toBe(15_000);
    expect(percentOfMinor(1_000, 1250)).toBe(125);
    expect(percentOfMinor(5, 1000)).toBe(1); // 0.5 → 1 (half-up)
    expect(percentOfMinor(4, 1000)).toBe(0); // 0.4 → 0
    expect(percentOfMinor(33_333, 1500)).toBe(5_000); // 4999.95 → 5000
    expect(percentOfMinor(12_345, 0)).toBe(0);
    expect(percentOfMinor(12_345, 10_000)).toBe(12_345);
  });

  it("rejects non-integer, negative, or out-of-range inputs", () => {
    expect(() => percentOfMinor(100.5, 500)).toThrow(MoneyError);
    expect(() => percentOfMinor(-100, 500)).toThrow(MoneyError);
    expect(() => percentOfMinor(100, 10_001)).toThrow(MoneyError);
    expect(() => percentOfMinor(100, 12.5)).toThrow(MoneyError);
    expect(() => percentOfMinor(Number.MAX_SAFE_INTEGER, 5000)).toThrow(MoneyError);
  });

  it("formats basis points for display", () => {
    expect(formatBasisPoints(500)).toBe("5%");
    expect(formatBasisPoints(1250)).toBe("12.5%");
    expect(formatBasisPoints(1205)).toBe("12.05%");
  });
});

describe("starting training budget (approved USD baseline)", () => {
  it("uses the US$3,000 default when income is skipped or not shared", () => {
    expect(DEFAULT_TRAINING_BUDGET_USD).toBe(3000);
    for (const incomeBracket of [null, undefined, "prefer_not_to_say", "not-a-bracket"]) {
      expect(calculateStartingFunds({ incomeBracket, preferredCurrency: "USD" })).toEqual({
        currency: "USD",
        startingFundsMinor: 300_000,
        baselineUsd: 3000,
        basis: "default",
      });
    }
  });

  it("maps every income bracket to its approved baseline", () => {
    expect(TRAINING_BUDGET_USD_BY_INCOME).toEqual({
      prefer_not_to_say: 3_000,
      under_1000: 500,
      "1000_2499": 1_750,
      "2500_4999": 3_750,
      "5000_9999": 7_500,
      "10000_plus": 10_000,
    });
    const expected: Record<string, number> = {
      under_1000: 50_000,
      "1000_2499": 175_000,
      "2500_4999": 375_000,
      "5000_9999": 750_000,
      "10000_plus": 1_000_000,
    };
    for (const [incomeBracket, minor] of Object.entries(expected)) {
      expect(calculateStartingFunds({ incomeBracket, preferredCurrency: "USD" })).toEqual({
        currency: "USD",
        startingFundsMinor: minor,
        baselineUsd: minor / 100,
        basis: "income_bracket",
      });
    }
  });

  it("covers every income bracket with a positive whole amount that grows with the bracket", () => {
    const amounts = INCOME_BRACKET_VALUES.filter((v) => v !== "prefer_not_to_say").map(
      (v) => TRAINING_BUDGET_USD_BY_INCOME[v],
    );
    expect(amounts.every((a) => Number.isSafeInteger(a) && a > 0)).toBe(true);
    expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
  });

  it("only uses server-allowlisted currencies (USD only until PayPal merchant verification)", () => {
    for (const preferredCurrency of ["GBP", "EUR", "XYZ", null, "usd"]) {
      expect(calculateStartingFunds({ incomeBracket: null, preferredCurrency }).currency).toBe("USD");
    }
  });
});

describe("currency conversion of the USD baseline (fixed ECB reference rates)", () => {
  // Expected values computed independently with Python Decimal from the same published rates.
  it.each([
    ["GBP", [2241, 374, 1307, 2802, 5603, 7471]],
    ["EUR", [2687, 448, 1567, 3359, 6717, 8957]],
    ["AUD", [4366, 728, 2547, 5458, 10916, 14554]],
    ["CAD", [4220, 703, 2462, 5275, 10550, 14066]],
    ["JPY", [474975, 79163, 277069, 593719, 1187438, 1583251]],
    ["HUF", [977788, 162965, 570376, 1222235, 2444469, 3259292]],
  ] as const)("%s never reuses the USD number and rounds to whole units", (code, wholeUnits) => {
    const brackets = [null, "under_1000", "1000_2499", "2500_4999", "5000_9999", "10000_plus"];
    const digits = code === "JPY" || code === "HUF" ? 0 : 2;
    brackets.forEach((b, i) => {
      const f = startingFundsIn(b, code);
      expect(f.startingFundsMinor).toBe(wholeUnits[i]! * 10 ** digits);
      expect(f.startingFundsMinor).not.toBe(f.baselineUsd * 100);
    });
  });

  it("converts minor units half-up at the target precision", () => {
    expect(convertUsdMinor(1999, "GBP")).toBe(1493);
    expect(convertUsdMinor(12_345, "JPY")).toBe(19_545);
    expect(convertUsdMinor(12_345, "USD")).toBe(12_345);
    expect(() => convertUsdMinor(-1, "GBP")).toThrow(MoneyError);
    expect(() => convertUsdMinor(100, "TWD")).toThrow(MoneyError); // no ECB rate
  });

  it("produces valid PayPal amounts for every scenario in a converted module", () => {
    for (const code of ["GBP", "EUR", "JPY", "HUF"]) {
      const start = startingFundsIn("2500_4999", code).startingFundsMinor;
      for (const m of MODULES) {
        const amounts = m.scenarios.map((s) => scenarioAmountMinor(s.key, start));
        expect(amounts.every((a) => Number.isSafeInteger(a) && a > 0)).toBe(true);
        expect(amounts.reduce((x, y) => x + y, 0)).toBeLessThanOrEqual(start);
      }
    }
  });

  it("parses published rates without floating point", () => {
    expect(parseRate("1.1165")).toBe(BigInt(1_116_500));
    expect(parseRate("363.90")).toBe(BigInt(363_900_000));
    expect(() => parseRate("1e3")).toThrow(MoneyError);
    expect(() => parseRate("0")).toThrow(MoneyError);
  });
});

describe("scenario payment amounts (percent of the module's starting funds)", () => {
  it("applies the configured Step 5 percentages", () => {
    const start = 300_000; // US$3,000
    expect(
      ["m1-s1", "m1-s2", "m2-s1", "m2-s2", "m3-s1", "m3-s2"].map((k) => scenarioAmountMinor(k, start)),
    ).toEqual([15_000, 24_000, 30_000, 36_000, 45_000, 60_000]);
    expect(formatMoney(scenarioAmountMinor("m3-s2", start), "USD")).toBe("$600.00");
  });

  it("rounds to the currency's minor unit for odd budgets", () => {
    expect(scenarioAmountMinor("m2-s2", 175_003)).toBe(21_000); // 21000.36 → 21000
    expect(scenarioAmountMinor("m3-s1", 175_003)).toBe(26_250); // 26250.45 → 26250
  });

  it("never lets a module's scenarios spend more than its starting funds", () => {
    for (const start of [1, 99, 50_000, 175_003, 1_000_000]) {
      for (const m of MODULES) {
        const total = m.scenarios.reduce((s, sc) => s + scenarioAmountMinor(sc.key, start), 0);
        expect(total).toBeLessThanOrEqual(start);
      }
    }
  });

  it("rejects unknown scenarios", () => {
    expect(() => scenarioAmountMinor("m9-s9", 1000)).toThrow(MoneyError);
  });
});
