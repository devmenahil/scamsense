import { describe, expect, it } from "vitest";
import {
  balanceOf,
  planModuleStart,
  planPayment,
  summarizeWallet,
  verifyLedger,
  WalletError,
  type LedgerEntry,
} from "./wallet";

const started = (): LedgerEntry[] => [planModuleStart([], 300_000, "USD")];

function pay(entries: LedgerEntry[], attemptId: string, amountMinor: number, key = `key-${attemptId}`) {
  const plan = planPayment(entries, { attemptId, amountMinor, currency: "USD", idempotencyKey: key });
  if (plan.status === "new") entries.push(plan.entry);
  return plan;
}

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof WalletError ? e.code : "other";
  }
  return "no error";
};

describe("training wallet ledger", () => {
  it("opens a module with a single MODULE_START credit", () => {
    const entries = started();
    expect(entries[0]).toMatchObject({
      entryType: "MODULE_START",
      amountMinor: 300_000,
      balanceAfterMinor: 300_000,
    });
    expect(codeOf(() => planModuleStart(entries, 300_000, "USD"))).toBe("already_started");
    expect(codeOf(() => planModuleStart([], 0, "USD"))).toBe("invalid_amount");
  });

  it("debits payments as new ledger rows and derives the balance from the sum", () => {
    const entries = started();
    pay(entries, "a1", 15_000);
    pay(entries, "a2", 24_000);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.balanceAfterMinor)).toEqual([300_000, 285_000, 261_000]);
    expect(balanceOf(entries)).toBe(261_000);
    expect(verifyLedger(entries)).toEqual([]);
  });

  it("prevents duplicate deductions: same idempotency key returns the original entry", () => {
    const entries = started();
    const first = pay(entries, "a1", 15_000, "order-123");
    const again = pay(entries, "a1", 15_000, "order-123");
    expect(first.status).toBe("new");
    expect(again).toEqual({ status: "duplicate", entry: first.entry });
    expect(balanceOf(entries)).toBe(285_000);
  });

  it("prevents a second, different payment for the same attempt", () => {
    const entries = started();
    pay(entries, "a1", 15_000, "order-1");
    expect(codeOf(() => pay(entries, "a1", 15_000, "order-2"))).toBe("duplicate_attempt_payment");
  });

  it("never goes below zero and validates amounts and currency", () => {
    const entries = started();
    expect(codeOf(() => pay(entries, "a1", 300_001))).toBe("insufficient_funds");
    expect(codeOf(() => pay(entries, "a1", 0))).toBe("invalid_amount");
    expect(codeOf(() => pay(entries, "a1", 10.5))).toBe("invalid_amount");
    expect(
      codeOf(() =>
        planPayment(entries, { attemptId: "a1", amountMinor: 1, currency: "EUR", idempotencyKey: "k" }),
      ),
    ).toBe("currency_mismatch");
    expect(
      codeOf(() => planPayment([], { attemptId: "a", amountMinor: 1, currency: "USD", idempotencyKey: "k" })),
    ).toBe("not_started");
    pay(entries, "a1", 300_000);
    expect(balanceOf(entries)).toBe(0);
  });

  it("keeps ordinary spending separate from fraudulent loss, and pending until classified", () => {
    const entries = started();
    pay(entries, "a1", 15_000);
    pay(entries, "a2", 24_000);
    pay(entries, "a3", 1_000);
    entries[1] = { ...entries[1]!, classification: "fraud_loss" };
    entries[2] = { ...entries[2]!, classification: "spending" };
    expect(summarizeWallet(entries)).toEqual({
      currency: "USD",
      startingMinor: 300_000,
      balanceMinor: 260_000,
      spendingMinor: 24_000,
      fraudLossMinor: 15_000,
      pendingMinor: 1_000,
      paymentCount: 3,
    });
    expect(summarizeWallet([])).toBeNull();
  });

  it("each module run is independent: a new run starts fresh (R20)", () => {
    const m1 = started();
    pay(m1, "a1", 100_000);
    const m2 = [planModuleStart([], 300_000, "USD")];
    expect(balanceOf(m2)).toBe(300_000);
    expect(balanceOf(m1)).toBe(200_000); // history preserved
  });

  it("verifyLedger flags tampered histories", () => {
    const entries = started();
    pay(entries, "a1", 15_000);
    expect(verifyLedger([{ ...entries[0]!, balanceAfterMinor: 1 }])).toContain(
      "entry 0: balance_after does not match the running sum",
    );
    expect(verifyLedger([entries[1]!])).toContain("first entry is not MODULE_START");
    expect(verifyLedger([...entries, entries[1]!]).join()).toContain("duplicate payment");
  });
});
