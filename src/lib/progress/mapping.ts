/**
 * Pure mapping between the Phase 3 tables (snake_case rows) and the domain records. Unknown keys/states are rejected
 * rather than guessed, so a schema drift fails loudly in tests instead of silently mis-scoring.
 */
import { MODULE_KEYS, SCENARIO_KEYS, type ModuleKey, type ScenarioKey } from "@/content/modules";
import type { RunRecord, ScoreRecord } from "@/lib/domain/progress";
import { ATTEMPT_STATES, type AttemptRecord, type AttemptState } from "@/lib/domain/progression";
import type { LedgerEntry, LedgerEntryType, PaymentClassification } from "@/lib/domain/wallet";

export const RUN_COLUMNS =
  "id, module_key, currency, starting_funds_minor, closing_balance_minor, started_at, completed_at";
export const ATTEMPT_COLUMNS = "id, module_run_id, scenario_key, attempt_number, state, completed_at";
export const LEDGER_COLUMNS =
  "id, module_run_id, attempt_id, entry_type, amount_minor, balance_after_minor, currency, classification, idempotency_key, created_at";
export const SCORE_COLUMNS = "attempt_id, is_replay, total_points";

type Bigint = number | string;

export interface RunRow {
  id: string;
  module_key: string;
  currency: string;
  starting_funds_minor: Bigint;
  closing_balance_minor: Bigint | null;
  started_at: string;
  completed_at: string | null;
}
export interface AttemptRow {
  id: string;
  module_run_id: string;
  scenario_key: string;
  attempt_number: number;
  state: string;
  completed_at: string | null;
}
export interface LedgerRow {
  id: Bigint;
  module_run_id: string;
  attempt_id: string | null;
  entry_type: string;
  amount_minor: Bigint;
  balance_after_minor: Bigint;
  currency: string;
  classification: string | null;
  idempotency_key: string | null;
  created_at: string;
}
export interface ScoreRow {
  attempt_id: string;
  is_replay: boolean;
  total_points: number;
}

/** bigint columns may arrive as JSON numbers or strings; amounts here are bounded far below 2^53. */
export function toSafeInt(v: Bigint): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isSafeInteger(n)) throw new Error("Expected a safe integer from the database");
  return n;
}

function oneOf<T extends string>(list: readonly T[], value: string, what: string): T {
  if (!(list as readonly string[]).includes(value)) throw new Error(`Unknown ${what} from the database`);
  return value as T;
}

export function rowToRun(r: RunRow): RunRecord {
  return {
    id: r.id,
    moduleKey: oneOf<ModuleKey>(MODULE_KEYS, r.module_key, "module key"),
    currency: r.currency,
    startingFundsMinor: toSafeInt(r.starting_funds_minor),
    closingBalanceMinor: r.closing_balance_minor === null ? null : toSafeInt(r.closing_balance_minor),
    startedAt: r.started_at,
    completedAt: r.completed_at,
  };
}

export function rowToAttempt(r: AttemptRow): AttemptRecord {
  return {
    id: r.id,
    scenarioKey: oneOf<ScenarioKey>(SCENARIO_KEYS, r.scenario_key, "scenario key"),
    attemptNumber: r.attempt_number,
    state: oneOf<AttemptState>(ATTEMPT_STATES, r.state, "attempt state"),
    completedAt: r.completed_at,
  };
}

export function rowToLedgerEntry(r: LedgerRow): LedgerEntry & { moduleRunId: string } {
  return {
    moduleRunId: r.module_run_id,
    entryType: oneOf<LedgerEntryType>(["MODULE_START", "PAYMENT"], r.entry_type, "ledger entry type"),
    amountMinor: toSafeInt(r.amount_minor),
    balanceAfterMinor: toSafeInt(r.balance_after_minor),
    currency: r.currency,
    attemptId: r.attempt_id,
    idempotencyKey: r.idempotency_key,
    classification:
      r.classification === null
        ? null
        : oneOf<PaymentClassification>(
            ["pending", "spending", "fraud_loss"],
            r.classification,
            "classification",
          ),
    createdAt: r.created_at,
  };
}

/** Replay scores are stored for the learner's own review but never count towards totals. */
export function scoredOnly(rows: readonly ScoreRow[]): ScoreRecord[] {
  return rows
    .filter((r) => !r.is_replay)
    .map((r) => ({ attemptId: r.attempt_id, totalPoints: r.total_points }));
}
