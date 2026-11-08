import { describe, expect, it } from "vitest";
import { formatMinorUnits } from "./format";

describe("formatMinorUnits", () => {
  it("formats two-decimal currencies from integer minor units", () => {
    expect(formatMinorUnits(50_000, "USD", 2)).toBe("$500.00");
    expect(formatMinorUnits(7_240, "USD", 2)).toBe("$72.40");
    expect(formatMinorUnits(5, "USD", 2)).toBe("$0.05");
  });

  it("formats zero-decimal currencies", () => {
    expect(formatMinorUnits(1_500, "JPY", 0)).toBe("¥1,500");
  });

  it("formats negatives with a minus sign", () => {
    expect(formatMinorUnits(-1_840, "USD", 2)).toBe("−$18.40");
  });

  it("rejects non-integer amounts", () => {
    expect(() => formatMinorUnits(12.5, "USD", 2)).toThrow();
  });
});
