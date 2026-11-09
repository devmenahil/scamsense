import { describe, expect, it } from "vitest";
import { buildProgressSnapshot, type RunRecord } from "./progress";
import type { AttemptRecord } from "./progression";
import { planModuleStart, planPayment, type LedgerEntry } from "./wallet";

const profile = { incomeBracket: null, preferredCurrency: "USD" };

function runWithLedger(id: string, moduleKey: RunRecord["moduleKey"], completedAt: string | null = null) {
  const run: RunRecord = {
    id,
    moduleKey,
    currency: "USD",
    startingFundsMinor: 300_000,
    closingBalanceMinor: null,
    startedAt: "2026-11-10T09:00:00Z",
    completedAt,
  };
  const ledger: LedgerEntry[] = [planModuleStart([], 300_000, "USD")];
  return { run, ledger };
}

const done = (id: string, scenarioKey: AttemptRecord["scenarioKey"], n = 1): AttemptRecord => ({
  id,
  scenarioKey,
  attemptNumber: n,
  state: "COMPLETED",
  completedAt: `2026-11-10T1${n}:00:00Z`,
});

describe("progress snapshot", () => {
  it("previews Module 1 training funds before it starts (nothing stored yet)", () => {
    const s = buildProgressSnapshot({ attempts: [], runs: [], ledger: [], scores: [], profile });
    expect(s.currentWallet).toEqual({
      kind: "preview",
      moduleKey: "spot-the-trap",
      funds: { currency: "USD", startingFundsMinor: 300_000, baselineUsd: 3000, basis: "default" },
    });
    expect(s.totalPoints).toBe(0);
    expect(s.maxPoints).toBe(600);
  });

  it("shows the active module's ledger-derived balance and keeps earlier modules' history", () => {
    const m1 = runWithLedger("run-1", "spot-the-trap", "2026-11-10T12:00:00Z");
    const plan = planPayment(m1.ledger, {
      attemptId: "a1",
      amountMinor: 15_000,
      currency: "USD",
      idempotencyKey: "k1",
    });
    if (plan.status === "new") m1.ledger.push({ ...plan.entry, classification: "fraud_loss" });
    const m2 = runWithLedger("run-2", "trust-under-pressure");
    const s = buildProgressSnapshot({
      attempts: [done("a1", "m1-s1"), done("a2", "m1-s2")],
      runs: [m1.run, m2.run],
      ledger: [
        ...m1.ledger.map((e) => ({ ...e, moduleRunId: "run-1" })),
        ...m2.ledger.map((e) => ({ ...e, moduleRunId: "run-2" })),
      ],
      scores: [
        { attemptId: "a1", totalPoints: 55 },
        { attemptId: "a2", totalPoints: 90 },
      ],
      profile,
    });
    expect(s.currentWallet).toMatchObject({ kind: "active", moduleKey: "trust-under-pressure" });
    expect(s.currentWallet?.kind === "active" && s.currentWallet.summary.balanceMinor).toBe(300_000);
    expect(s.modules["spot-the-trap"].wallet).toMatchObject({
      balanceMinor: 285_000,
      fraudLossMinor: 15_000,
    });
    expect(s.modules["spot-the-trap"].ledger).toHaveLength(2);
    expect(s.modules["spot-the-trap"]).toMatchObject({ points: 145, maxPoints: 200, scoredScenarios: 2 });
    expect(s.modules["spot-the-trap"].badgeEarnedAt).toBe("2026-11-10T12:00:00Z");
    expect(s.modules["trust-under-pressure"].badgeEarnedAt).toBeNull();
    expect(s.totalPoints).toBe(145);
  });

  it("counts only the first completed attempt of each scenario towards the score", () => {
    const s = buildProgressSnapshot({
      attempts: [done("first", "m1-s1", 1), done("replay", "m1-s1", 2)],
      runs: [],
      ledger: [],
      scores: [
        { attemptId: "first", totalPoints: 40 },
        { attemptId: "replay", totalPoints: 100 },
      ],
      profile,
    });
    expect(s.totalPoints).toBe(40);
  });

  it("previews the next module's funds from the profile (income bracket; only allowlisted currencies)", () => {
    const s = buildProgressSnapshot({
      attempts: [done("a1", "m1-s1"), done("a2", "m1-s2")],
      runs: [],
      ledger: [],
      scores: [],
      profile: { incomeBracket: "5000_9999", preferredCurrency: "GBP" },
    });
    expect(s.currentWallet).toEqual({
      kind: "preview",
      moduleKey: "trust-under-pressure",
      // GBP is not selectable until PayPal merchant verification, so the server uses USD.
      funds: { currency: "USD", startingFundsMinor: 750_000, baselineUsd: 7500, basis: "income_bracket" },
    });
  });
});
