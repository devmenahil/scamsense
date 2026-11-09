import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIVITY_TAGS, CONTEXT_TAGS } from "@/content/scenarios/templateSchema";
import { MODULES } from "@/content/modules";
import { DECISION_ASSESSMENTS } from "@/lib/evaluation/schema";

const sql = readFileSync(
  join(__dirname, "..", "..", "..", "supabase", "migrations", "20261112090000_hybrid_intelligence.sql"),
  "utf8",
);
const TABLES = [
  "profile_interpretations",
  "module_scenario_orders",
  "scenario_personalizations",
  "attempt_personalizations",
  "attempt_evaluations",
];

describe("Step 8 migration (drift and security)", () => {
  it("enables RLS with owner-only SELECT on every new table and grants nothing to browsers beyond that", () => {
    for (const t of TABLES) {
      expect(sql).toContain(`alter table public.${t} enable row level security`);
      const policy = sql.indexOf(`create policy "${t}_select_own" on public.${t}`);
      expect(policy, t).toBeGreaterThan(0);
      expect(sql.slice(policy, policy + 200)).toContain(
        "for select to authenticated using ((select auth.uid()) = user_id);",
      );
      expect(sql).toContain(
        `revoke all on table public.${t} from public, anon, authenticated, service_role;`,
      );
    }
    // The only browser-role grant: users may edit their own two new profile description columns (RLS still applies).
    const browserGrants =
      sql.match(/grant (insert|update|delete|all)[^;]*to (anon|authenticated)[^;]*;/g) ?? [];
    expect(browserGrants).toEqual([
      "grant update (custom_occupation, custom_activity) on table public.profiles to authenticated;",
    ]);
    expect(sql).not.toMatch(/grant [^;]*to anon/);
    expect(sql).not.toMatch(/grant execute[^;]*to (anon|authenticated)/);
  });

  it("mirrors the routing vocabulary and module scenarios", () => {
    for (const t of ACTIVITY_TAGS) expect(sql).toContain(`'${t}'`);
    for (const t of CONTEXT_TAGS) expect(sql).toContain(`'${t}'`);
    for (const m of MODULES) {
      const [a, b] = m.scenarios.map((s) => s.key);
      expect(sql).toContain(`array['${a}', '${b}'], array['${b}', '${a}']`);
    }
    for (const d of DECISION_ASSESSMENTS) expect(sql).toContain(`'${d}'`);
  });

  it("never stores Gemini points and completes only through complete_scenario_attempt", () => {
    expect(sql).not.toMatch(/gemini_points|ai_score/);
    expect(sql).toContain("public.complete_scenario_attempt(");
    expect(sql).toMatch(/module_scenario_orders_no_update/); // the routed order is write-once
  });
});
