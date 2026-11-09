import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COUNTRY_CODES } from "@/content/countries";
import {
  AGE_BRACKET_VALUES,
  FINANCIAL_ACTIVITY_VALUES,
  FINANCIAL_GOAL_VALUES,
  INCOME_BRACKETS,
  INCOME_BRACKET_VALUES,
  OCCUPATION_VALUES,
  PAYMENT_EXPERIENCE_VALUES,
} from "@/content/profileOptions";
import { SUPPORTED_CURRENCY_CODES } from "@/lib/domain/currency";

/**
 * Guards against drift between the TypeScript option lists and the database check constraints. If this fails after
 * changing a list, add a NEW migration that updates the constraint (never edit an applied migration).
 * The latest migration that mentions a constraint wins.
 */
const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "supabase", "migrations");
const sql = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
  .join("\n");

function constraintValues(name: string): string[] {
  const start = sql.lastIndexOf(`constraint ${name}`);
  if (start < 0) throw new Error(`constraint ${name} not found`);
  const rest = sql.slice(start + name.length + 11);
  // A constraint body ends at the next constraint, the end of CREATE TABLE, or the end of an ALTER statement.
  const end = Math.min(...["\n  constraint ", "\n);", ";"].map((t) => rest.indexOf(t)).filter((i) => i >= 0));
  return [...rest.slice(0, end).matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

const sorted = (a: readonly string[]) => [...a].sort();

describe("profiles migration matches the TypeScript option lists", () => {
  it.each([
    ["profiles_age_bracket_check", AGE_BRACKET_VALUES],
    ["profiles_occupation_check", OCCUPATION_VALUES],
    ["profiles_financial_activities_check", FINANCIAL_ACTIVITY_VALUES],
    ["profiles_payment_experience_check", PAYMENT_EXPERIENCE_VALUES],
    ["profiles_income_bracket_check", INCOME_BRACKET_VALUES],
    ["profiles_financial_goal_check", FINANCIAL_GOAL_VALUES],
    ["profiles_preferred_currency_check", SUPPORTED_CURRENCY_CODES],
    ["profiles_country_check", COUNTRY_CODES],
  ] as const)("%s", (name, values) => {
    expect(sorted(constraintValues(name))).toEqual(sorted(values));
  });

  it("derives the same income bracket labels as the app", () => {
    for (const b of INCOME_BRACKETS) expect(sql).toContain(`when '${b.value}' then '${b.label}'`);
  });

  it("enables RLS, scopes policies to the owner, and grants nothing to anon", () => {
    expect(sql).toMatch(/alter table public\.profiles enable row level security/);
    expect(sql).toMatch(/using \(\(select auth\.uid\(\)\) = user_id\)/);
    expect(sql).toMatch(/revoke all on table public\.profiles from public, anon, authenticated/);
    expect(sql).not.toMatch(/grant [^;]* to anon/);
    expect(sql).not.toMatch(/grant (insert|delete|all)[^;]*profiles/);
    expect(sql).not.toMatch(/\bpassword\s+text/i);
  });

  it("has 249 ISO 3166-1 country codes", () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
  });
});
