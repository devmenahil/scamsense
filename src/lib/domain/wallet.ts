/**
 * Fictional training wallet (R18–R20, R38): pure ledger math. The wallet is an append-only list of entries per module
 * run, never a stored number that gets overwritten. The balance is always the sum of the run's entries.
 *
 *   MODULE_START  +startingFunds   one per module run (the R20 "reset": every module run starts fresh)
 *   PAYMENT       −amount          one per scored scenario attempt at most (no duplicate deductions)
 *
 * PAYMENT entries are classified only after the scenario is completed, so nothing about legitimacy is stored or
 * visible while it is being played (R10):
 *   pending     → recorded during play, not yet classified
 *   spending    → an ordinary purchase (the legitimate scenario)
 *   fraud_loss  → money lost to a scam in the story
 * Spending and fraud loss are always reported separately.
 *
 * The database (supabase/migrations/*_progression_wallet.sql) enforces the same invariants: unique MODULE_START per
 * run, unique PAYMENT per attempt and per idempotency key, balance never below zero, append-only rows.
 */

export type LedgerEntryType = "MODULE_START" | "PAYMENT";
export type PaymentClassification = "pending" | "spending" | "fraud_loss";

export interface LedgerEntry {
  entryType: LedgerEntryType;
  /** Signed minor units: positive for MODULE_START, negative for PAYMENT. */
  amountMinor: number;
  balanceAfterMinor: number;
  currency: string;
  attemptId: string | null;
  idempotencyKey: string | null;
  /** null for MODULE_START. */
  classification: PaymentClassification | null;
  createdAt?: string;
}

export type WalletErrorCode =
  | "not_started"
  | "already_started"
  | "invalid_amount"
  | "insufficient_funds"
  | "currency_mismatch"
  | "duplicate_attempt_payment";

export class WalletError extends Error {
  constructor(
    public readonly code: WalletErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WalletError";
  }
}

function assertAmount(amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new WalletError("invalid_amount", "Amount must be a positive whole number of minor units");
  }
}

export function balanceOf(entries: readonly LedgerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amountMinor, 0);
}

/** The opening entry of a module run. Throws if the run already has one (a module can only start once). */
export function planModuleStart(
  entries: readonly LedgerEntry[],
  startingFundsMinor: number,
  currency: string,
): LedgerEntry {
  if (entries.some((e) => e.entryType === "MODULE_START")) {
    throw new WalletError("already_started", "This module's training funds were already set up");
  }
  assertAmount(startingFundsMinor);
  return {
    entryType: "MODULE_START",
    amountMinor: startingFundsMinor,
    balanceAfterMinor: startingFundsMinor,
    currency,
    attemptId: null,
    idempotencyKey: null,
    classification: null,
  };
}

export type PaymentPlan = { status: "new"; entry: LedgerEntry } | { status: "duplicate"; entry: LedgerEntry };

/**
 * Plans a training-funds payment for a scenario attempt. Idempotent: replaying the same idempotency key returns the
 * existing entry instead of deducting twice. A second, different payment for the same attempt is rejected.
 */
export function planPayment(
  entries: readonly LedgerEntry[],
  payment: { attemptId: string; amountMinor: number; currency: string; idempotencyKey: string },
): PaymentPlan {
  const start = entries.find((e) => e.entryType === "MODULE_START");
  if (!start) throw new WalletError("not_started", "This module's training funds haven't been set up yet");

  const sameKey = entries.find((e) => e.idempotencyKey === payment.idempotencyKey);
  if (sameKey) return { status: "duplicate", entry: sameKey };
  if (entries.some((e) => e.entryType === "PAYMENT" && e.attemptId === payment.attemptId)) {
    throw new WalletError("duplicate_attempt_payment", "This scenario attempt has already been paid");
  }

  assertAmount(payment.amountMinor);
  if (payment.currency !== start.currency) {
    throw new WalletError("currency_mismatch", "Payments must use the module's training-funds currency");
  }
  const balance = balanceOf(entries);
  if (payment.amountMinor > balance) {
    throw new WalletError("insufficient_funds", "There aren't enough training funds left for this payment");
  }
  return {
    status: "new",
    entry: {
      entryType: "PAYMENT",
      amountMinor: -payment.amountMinor,
      balanceAfterMinor: balance - payment.amountMinor,
      currency: start.currency,
      attemptId: payment.attemptId,
      idempotencyKey: payment.idempotencyKey,
      classification: "pending",
    },
  };
}

export interface WalletSummary {
  currency: string;
  startingMinor: number;
  balanceMinor: number;
  /** Ordinary purchases (positive number). */
  spendingMinor: number;
  /** Money lost to scams in the story (positive number). Never merged with spending. */
  fraudLossMinor: number;
  /** Paid in a scenario that hasn't finished yet (positive number). */
  pendingMinor: number;
  paymentCount: number;
}

export function summarizeWallet(entries: readonly LedgerEntry[]): WalletSummary | null {
  const start = entries.find((e) => e.entryType === "MODULE_START");
  if (!start) return null;
  const totals = { spending: 0, fraud_loss: 0, pending: 0 } satisfies Record<PaymentClassification, number>;
  let paymentCount = 0;
  for (const e of entries) {
    if (e.entryType !== "PAYMENT") continue;
    paymentCount += 1;
    totals[e.classification ?? "pending"] += -e.amountMinor;
  }
  return {
    currency: start.currency,
    startingMinor: start.amountMinor,
    balanceMinor: balanceOf(entries),
    spendingMinor: totals.spending,
    fraudLossMinor: totals.fraud_loss,
    pendingMinor: totals.pending,
    paymentCount,
  };
}

/**
 * Checks a stored ledger (in chronological order) for consistency. Returns a list of problems; empty means valid.
 * Used by tests and available to reports as a safety check.
 */
export function verifyLedger(entries: readonly LedgerEntry[]): string[] {
  const problems: string[] = [];
  if (entries.length === 0) return problems;
  if (entries[0]!.entryType !== "MODULE_START") problems.push("first entry is not MODULE_START");
  if (entries.filter((e) => e.entryType === "MODULE_START").length > 1)
    problems.push("more than one MODULE_START");
  const attempts = new Set<string>();
  let running = 0;
  entries.forEach((e, i) => {
    running += e.amountMinor;
    if (e.balanceAfterMinor !== running)
      problems.push(`entry ${i}: balance_after does not match the running sum`);
    if (running < 0) problems.push(`entry ${i}: balance below zero`);
    if (e.currency !== entries[0]!.currency)
      problems.push(`entry ${i}: currency differs from the module run`);
    if (e.entryType === "PAYMENT") {
      if (e.amountMinor >= 0) problems.push(`entry ${i}: payment is not a debit`);
      if (!e.attemptId) problems.push(`entry ${i}: payment without an attempt`);
      else if (attempts.has(e.attemptId)) problems.push(`entry ${i}: duplicate payment for an attempt`);
      else attempts.add(e.attemptId);
    }
  });
  return problems;
}
