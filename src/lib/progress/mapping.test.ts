import { describe, expect, it } from "vitest";
import { rowToAttempt, rowToLedgerEntry, rowToRun, scoredOnly, toSafeInt } from "./mapping";

describe("progress row mapping", () => {
  it("maps runs and accepts bigint values as strings", () => {
    expect(
      rowToRun({
        id: "r1",
        module_key: "spot-the-trap",
        currency: "USD",
        starting_funds_minor: "300000",
        closing_balance_minor: null,
        started_at: "t",
        completed_at: null,
      }),
    ).toEqual({
      id: "r1",
      moduleKey: "spot-the-trap",
      currency: "USD",
      startingFundsMinor: 300_000,
      closingBalanceMinor: null,
      startedAt: "t",
      completedAt: null,
    });
  });

  it("rejects unknown keys, states, and unsafe integers instead of guessing", () => {
    const attempt = {
      id: "a",
      module_run_id: "r",
      scenario_key: "m1-s1",
      attempt_number: 1,
      state: "EXPLORING",
      completed_at: null,
    };
    expect(rowToAttempt(attempt).state).toBe("EXPLORING");
    expect(() => rowToAttempt({ ...attempt, state: "WON" })).toThrow();
    expect(() => rowToAttempt({ ...attempt, scenario_key: "m4-s1" })).toThrow();
    expect(() => toSafeInt("12.5")).toThrow();
    expect(() => toSafeInt("9007199254740993")).toThrow();
  });

  it("maps ledger entries with their classification", () => {
    const e = rowToLedgerEntry({
      id: "7",
      module_run_id: "r",
      attempt_id: "a",
      entry_type: "PAYMENT",
      amount_minor: -15000,
      balance_after_minor: 285000,
      currency: "USD",
      classification: "pending",
      idempotency_key: "k",
      created_at: "t",
    });
    expect(e).toMatchObject({ moduleRunId: "r", amountMinor: -15_000, classification: "pending" });
    expect(() =>
      rowToLedgerEntry({
        id: 1,
        module_run_id: "r",
        attempt_id: null,
        entry_type: "REFUND",
        amount_minor: 1,
        balance_after_minor: 1,
        currency: "USD",
        classification: null,
        idempotency_key: null,
        created_at: "t",
      }),
    ).toThrow();
  });

  it("excludes replay scores from totals", () => {
    expect(
      scoredOnly([
        { attempt_id: "a", is_replay: false, total_points: 70 },
        { attempt_id: "b", is_replay: true, total_points: 100 },
      ]),
    ).toEqual([{ attemptId: "a", totalPoints: 70 }]);
  });
});
