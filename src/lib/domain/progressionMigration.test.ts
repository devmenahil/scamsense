import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULES, MODULE_KEYS } from "@/content/modules";
import { SCORE_WEIGHTS } from "./scoring";

/**
 * Guards against drift between src/content/modules.ts + the domain constants and the Phase 3 migration. If this fails
 * after changing modules, slots, states, or score weights, add a NEW migration (never edit an applied one).
 */
const sql = readFileSync(
  join(__dirname, "..", "..", "..", "supabase", "migrations", "20261109120000_progression_wallet.sql"),
  "utf8",
);

function constraintBody(name: string): string {
  const start = sql.indexOf(`constraint ${name}`);
  if (start < 0) throw new Error(`constraint ${name} not found`);
  const rest = sql.slice(start + name.length + 11);
  return rest.slice(0, rest.indexOf("\n  constraint "));
}
const quoted = (s: string) => [...s.matchAll(/'([^']+)'/g)].map((m) => m[1]!);

describe("progression migration matches the TypeScript configuration", () => {
  it("module keys", () => {
    expect(quoted(constraintBody("module_runs_module_key_check")).sort()).toEqual([...MODULE_KEYS].sort());
  });

  it("(module, scenario) pairs", () => {
    const flat = quoted(constraintBody("scenario_attempts_scenario_key_check"));
    const pairs = [];
    for (let i = 0; i < flat.length; i += 2) pairs.push(`${flat[i]}/${flat[i + 1]}`);
    expect(pairs.sort()).toEqual(MODULES.flatMap((m) => m.scenarios.map((s) => `${m.key}/${s.key}`)).sort());
  });

  it("scenario → module mapping and unlock chain inside the functions", () => {
    for (const m of MODULES) {
      expect(sql).toContain(`when 'm${m.order}' then '${m.key}'`);
      const prev = MODULES.find((x) => x.order === m.order - 1);
      if (prev) expect(sql).toContain(`when '${m.key}' then '${prev.key}'`);
    }
  });

  // Attempt states moved to the Step 6 migration: see scenarioStateMachineMigration.test.ts.

  it("score component ranges", () => {
    expect(constraintBody("scenario_scores_decision_check")).toContain(`(0, ${SCORE_WEIGHTS.decision})`);
    expect(constraintBody("scenario_scores_reasoning_check")).toContain(
      `between 0 and ${SCORE_WEIGHTS.reasoning}`,
    );
    expect(constraintBody("scenario_scores_verification_check")).toContain(
      `between 0 and ${SCORE_WEIGHTS.verification}`,
    );
    expect(constraintBody("scenario_scores_payment_safety_check")).toContain(
      `(0, ${SCORE_WEIGHTS.paymentSafety})`,
    );
  });

  it("never grants gameplay writes or functions to browser roles", () => {
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*to\s+(anon|authenticated)/i);
    expect(sql).not.toMatch(/grant\s+execute[^;]*to\s+[^;]*(anon|authenticated)/i);
    expect(sql).not.toMatch(/create policy[^;]*for\s+(insert|update|delete|all)/i);
  });
});
