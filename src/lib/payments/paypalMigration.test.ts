import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCENARIO_SLOTS } from "@/content/modules";
import { checkoutIdempotencyKey } from "./checkout";

const sql = readFileSync(
  join(__dirname, "..", "..", "..", "supabase", "migrations", "20261111090000_paypal_checkout.sql"),
  "utf8",
);

describe("PayPal checkout migration stays in sync with the TypeScript rules", () => {
  it("mirrors every scenario's payment percentage", () => {
    const body = sql.slice(sql.indexOf("scenario_payment_basis_points(p_scenario_key text)"));
    for (const slot of SCENARIO_SLOTS) {
      expect(body, slot.key).toContain(`when '${slot.key}' then ${slot.paymentBasisPoints}`);
    }
  });

  it("re-derives the amount with the same half-up integer rounding and the same request-id format", () => {
    expect(sql).toContain("v_expected := (v_run.starting_funds_minor * v_bp + 5000) / 10000;");
    expect(checkoutIdempotencyKey("ID", 3)).toBe("scamsense-ID-checkout-3");
    expect(sql).toContain("'scamsense-' || p_attempt_id::text || '-checkout-' || v_sequence::text");
  });

  it("pins the environment to sandbox and prevents duplicate orders, captures, and deductions", () => {
    expect(sql).toContain("check (environment = 'sandbox')");
    for (const guard of [
      "unique (request_id)",
      "unique (paypal_order_id)",
      "unique (paypal_capture_id)",
      "unique (attempt_id, checkout_sequence)",
      "on public.payment_transactions (attempt_id) where status = 'CAPTURED'",
      "on public.payment_transactions (attempt_id) where status in ('CREATED', 'PENDING')",
      "(not is_practice or ledger_entry_id is null)",
    ]) {
      expect(sql, guard).toContain(guard);
    }
  });

  it("lets browsers read their own rows only and gives the write functions to service_role alone", () => {
    expect(sql).toContain("for select to authenticated using ((select auth.uid()) = user_id)");
    expect(sql).toContain(
      "revoke all on table public.payment_transactions from public, anon, authenticated, service_role",
    );
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*payment_transactions/i);
    for (const fn of ["record_payment_order", "record_payment_capture", "update_payment_order"]) {
      expect(sql).toMatch(
        new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\)\\s+from public, anon, authenticated`),
      );
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`));
    }
  });
});
