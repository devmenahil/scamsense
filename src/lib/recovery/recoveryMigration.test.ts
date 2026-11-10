/** Step 9 migration guard: RLS read-own, no browser writes, service_role-only functions, completed attempts only. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20261114090000_recovery_playbooks.sql", import.meta.url),
  "utf8",
);

describe("recovery playbook migration", () => {
  it("enables RLS with a read-own policy and grants browsers SELECT only", () => {
    expect(sql).toMatch(/alter table public\.attempt_recovery_playbooks enable row level security/);
    expect(sql).toMatch(/for select to authenticated using \(\(select auth\.uid\(\)\) = user_id\)/);
    expect(sql).toMatch(/revoke all on table public\.attempt_recovery_playbooks from anon, authenticated/);
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*attempt_recovery_playbooks[^;]*authenticated/i);
  });

  it("functions run only as service_role and the claim requires a COMPLETED, owned attempt", () => {
    for (const fn of ["claim_recovery_playbook", "complete_recovery_playbook"]) {
      expect(sql).toMatch(
        new RegExp(`revoke all on function public\\.${fn}\\([^;]*from public, anon, authenticated`),
      );
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^;]*to service_role`));
    }
    expect(sql).toMatch(/where id = p_attempt_id and user_id = p_user_id for update/);
    expect(sql).toMatch(/if v_attempt\.state <> 'COMPLETED' then/);
  });

  it("is per attempt (originals and replays separately) and a ready row is final", () => {
    expect(sql).toMatch(/attempt_id\s+uuid\s+primary key/);
    expect(sql).toMatch(/references public\.scenario_attempts \(id, user_id, module_run_id\)/);
    expect(sql).toMatch(/raise exception 'recovery_playbook_final'/);
  });
});
